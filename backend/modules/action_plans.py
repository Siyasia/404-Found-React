import copy
import json
from datetime import date, datetime

import fastapi
from fastapi import HTTPException
from fastapi.params import Depends
from pydantic import BaseModel

import state
from modules.datatypes import ActionPlanInfo, GameProfile, UserInfo
from modules.game import row_to_profile
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

COINS_PER_COMPLETION = 20

BADGE_DEFINITIONS = [
    {
        "id": "first_completion",
        "coins": 0,
        "condition": lambda stats: (stats.get("totalCompletions", 0) >= 1),
    },
    {
        "id": "completions_5",
        "coins": 0,
        "condition": lambda stats: (stats.get("totalCompletions", 0) >= 5),
    },
    {
        "id": "streak_3",
        "coins": 0,
        "condition": lambda stats: (stats.get("current", 0) >= 3),
    },
    {
        "id": "streak_7",
        "coins": 50,
        "condition": lambda stats: (stats.get("current", 0) >= 7),
    },
    {
        "id": "longest_streak_30",
        "coins": 150,
        "condition": lambda stats: (stats.get("longest", 0) >= 30),
    },
    {
        "id": "streak_14",
        "coins": 75,
        "condition": lambda stats: False,
    },
    {
        "id": "streak_21",
        "coins": 100,
        "condition": lambda stats: False,
    },
    {
        "id": "streak_30_milestone",
        "coins": 150,
        "condition": lambda stats: False,
    },
]


class ActionPlanDateMutationRequest(BaseModel):
    actionPlanId: int
    dateISO: str


def _safe_json_object(value, default=None):
    if default is None:
        default = {}
    if value is None:
        return dict(default)
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return dict(default)


def _safe_json_array(value, default=None):
    if default is None:
        default = []
    if value is None:
        return list(default)
    if isinstance(value, list):
        return list(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    return list(default)


def _get_badge_definition_map():
    return {badge["id"]: badge for badge in BADGE_DEFINITIONS}


def _sum_badge_coins(badge_ids):
    defs = _get_badge_definition_map()
    total = 0
    for badge_id in _safe_json_array(badge_ids, []):
        total += int(defs.get(badge_id, {}).get("coins", 0) or 0)
    return total


def _evaluate_badge_ids(stats):
    earned = []
    for badge in BADGE_DEFINITIONS:
        try:
            if badge["condition"](stats):
                earned.append(badge["id"])
        except Exception:
            continue
    return earned


def _normalize_milestones(value):
    out = []
    for milestone in _safe_json_array(value, []):
        if not isinstance(milestone, dict):
            continue
        days = int(milestone.get("days") or 0)
        coins = max(0, int(milestone.get("coins") or 0))
        badge = str(milestone.get("badge") or "").strip()
        if days > 0:
            out.append({
                "days": days,
                "coins": coins,
                "badge": badge,
            })
    out.sort(key=lambda item: item["days"])
    return out


def _row_to_goal_minimal(row):
    data = dict(row)
    if data.get("milestoneRewards"):
        try:
            data["milestoneRewards"] = json.loads(data["milestoneRewards"])
        except Exception:
            data["milestoneRewards"] = []
    else:
        data["milestoneRewards"] = []
    return data


def _parse_iso_date(date_iso: str) -> date:
    try:
        return datetime.strptime(date_iso, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="dateISO must be YYYY-MM-DD")


def _validate_completion_date(date_iso: str) -> date:
    parsed = _parse_iso_date(date_iso)
    today = date.today()
    if parsed > today:
        raise HTTPException(status_code=400, detail="Cannot mark future dates complete")
    return parsed


def _normalize_completed_dates(value):
    raw = _safe_json_object(value, {})
    normalized = {}
    for key, val in raw.items():
        if isinstance(key, str) and key:
            normalized[key] = bool(val)
    return normalized


def _is_child_of_parent(db, child_id, parent_id) -> bool:
    row = db.execute(
        "SELECT id FROM children WHERE id = ? AND parentId = ?",
        (str(child_id), str(parent_id)),
    ).fetchone()
    return row is not None


def _can_user_manage_action_plan(db, user, plan_row) -> bool:
    assignee_id = str(plan_row["assigneeId"] or "")
    current_user_id = str(user.id)

    if current_user_id == assignee_id:
        return True

    if getattr(user, "role", None) == "parent":
        return _is_child_of_parent(db, assignee_id, current_user_id)

    return False


def _ensure_game_profile(db, user_id):
    if not db.try_execute(*SQLHelper.get_game_profile(user_id)):
        raise HTTPException(status_code=500, detail="Failed to read game profile")

    row = db.cursor().fetchone()
    if row is not None:
        return row

    payload = GameProfile(id=int(user_id), coins=0, inventory=[], meta={})
    if not db.try_execute(*SQLHelper.create_game_profile(payload, user_id)):
        raise HTTPException(status_code=500, detail="Failed to create missing game profile")

    db.write()

    if not db.try_execute(*SQLHelper.get_game_profile(user_id)):
        raise HTTPException(status_code=500, detail="Failed to reload created game profile")

    row = db.cursor().fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create missing game profile")

    return row


def _normalize_badge_sources(value):
    raw = _safe_json_object(value, {})
    normalized = {}
    for badge_id, plan_ids in raw.items():
        if not badge_id:
            continue
        normalized[str(badge_id)] = [
            str(plan_id)
            for plan_id in _safe_json_array(plan_ids, [])
            if str(plan_id).strip()
        ]
    return normalized


def _read_reward_state_from_plan_meta(meta):
    meta = _safe_json_object(meta, {})
    return {
        "awardedMilestones": [int(x) for x in _safe_json_array(meta.get("awardedMilestones"), [])],
        "rewardedCompletionDates": _safe_json_object(meta.get("rewardedCompletionDates"), {}),
        "earnedBadges": [str(x) for x in _safe_json_array(meta.get("earnedBadges"), []) if str(x).strip()],
        "badgeEarnedDates": _safe_json_object(meta.get("badgeEarnedDates"), {}),
        "completionCoinsTotal": int(meta.get("completionCoinsTotal") or 0),
        "milestoneCoinsTotal": int(meta.get("milestoneCoinsTotal") or 0),
        "planRewardCoinsTotal": int(meta.get("planRewardCoinsTotal") or 0),
    }


def _compute_basic_streak_stats(completed_dates: dict):
    completed_keys = sorted([k for k, v in completed_dates.items() if v is True])
    total = len(completed_keys)

    if total == 0:
        return {
            "currentStreak": 0,
            "bestStreak": 0,
            "totalCompletions": 0,
        }

    parsed_dates = []
    for key in completed_keys:
        try:
            parsed_dates.append(datetime.strptime(key, "%Y-%m-%d").date())
        except Exception:
            continue

    if not parsed_dates:
        return {
            "currentStreak": 0,
            "bestStreak": 0,
            "totalCompletions": 0,
        }

    parsed_dates = sorted(set(parsed_dates))

    best = 1
    run = 1
    for i in range(1, len(parsed_dates)):
        delta = (parsed_dates[i] - parsed_dates[i - 1]).days
        if delta == 1:
            run += 1
            best = max(best, run)
        else:
            run = 1

    today = date.today()
    current = 0
    date_set = set(parsed_dates)
    cursor = today
    while cursor in date_set:
        current += 1
        cursor = cursor.fromordinal(cursor.toordinal() - 1)

    return {
        "currentStreak": current,
        "bestStreak": best,
        "totalCompletions": total,
    }


def _build_plan_reward_state(plan_row, goal_row, completed_dates, old_meta, event_date_iso):
    stats = _compute_basic_streak_stats(completed_dates)
    stat_view = {
        "current": int(stats["currentStreak"]),
        "longest": int(stats["bestStreak"]),
        "totalCompletions": int(stats["totalCompletions"]),
    }

    milestones = _normalize_milestones(goal_row.get("milestoneRewards") if goal_row else [])
    awarded_milestones = [m["days"] for m in milestones if stat_view["longest"] >= m["days"]]
    milestone_badges = [m["badge"] for m in milestones if stat_view["longest"] >= m["days"] and m.get("badge")]

    earned_badges = sorted(set(_evaluate_badge_ids(stat_view) + milestone_badges))

    previous_state = _read_reward_state_from_plan_meta(old_meta)
    previous_badge_dates = _safe_json_object(previous_state.get("badgeEarnedDates"), {})

    badge_earned_dates = {}
    for badge_id in earned_badges:
        badge_earned_dates[badge_id] = previous_badge_dates.get(badge_id) or event_date_iso

    rewarded_completion_dates = {}
    for key, val in completed_dates.items():
        if val is True:
            rewarded_completion_dates[key] = True

    completion_coins_total = len(rewarded_completion_dates) * COINS_PER_COMPLETION
    milestone_coins_total = sum(
        int(m.get("coins") or 0)
        for m in milestones
        if m["days"] in awarded_milestones
    )

    plan_reward_coins_total = completion_coins_total + milestone_coins_total

    return {
        "currentStreak": int(stats["currentStreak"]),
        "bestStreak": int(stats["bestStreak"]),
        "totalCompletions": int(stats["totalCompletions"]),
        "awardedMilestones": awarded_milestones,
        "rewardedCompletionDates": rewarded_completion_dates,
        "earnedBadges": earned_badges,
        "badgeEarnedDates": badge_earned_dates,
        "completionCoinsTotal": completion_coins_total,
        "milestoneCoinsTotal": milestone_coins_total,
        "planRewardCoinsTotal": plan_reward_coins_total,
    }


def _apply_badge_source_delta(profile_meta, plan_id, old_badges, new_badges, event_date_iso):
    profile_meta = _safe_json_object(profile_meta, {})
    badge_sources = _normalize_badge_sources(profile_meta.get("badgeSources"))
    badge_earned_dates = _safe_json_object(profile_meta.get("badgeEarnedDates"), {})

    plan_id_str = str(plan_id)
    old_set = set([str(b) for b in _safe_json_array(old_badges, []) if str(b).strip()])
    new_set = set([str(b) for b in _safe_json_array(new_badges, []) if str(b).strip()])

    globally_added = []
    globally_removed = []

    for badge_id in old_set - new_set:
        existing_sources = [str(x) for x in badge_sources.get(badge_id, []) if str(x).strip()]
        next_sources = [src for src in existing_sources if src != plan_id_str]
        if next_sources:
            badge_sources[badge_id] = next_sources
        else:
            badge_sources.pop(badge_id, None)
            badge_earned_dates.pop(badge_id, None)
            globally_removed.append(badge_id)

    for badge_id in new_set - old_set:
        existing_sources = [str(x) for x in badge_sources.get(badge_id, []) if str(x).strip()]
        was_empty = len(existing_sources) == 0
        if plan_id_str not in existing_sources:
            existing_sources.append(plan_id_str)
        badge_sources[badge_id] = existing_sources

        if not badge_earned_dates.get(badge_id):
            badge_earned_dates[badge_id] = event_date_iso

        if was_empty:
            globally_added.append(badge_id)

    for badge_id in new_set & old_set:
        existing_sources = [str(x) for x in badge_sources.get(badge_id, []) if str(x).strip()]
        if plan_id_str not in existing_sources:
            existing_sources.append(plan_id_str)
        badge_sources[badge_id] = existing_sources
        if not badge_earned_dates.get(badge_id):
            badge_earned_dates[badge_id] = event_date_iso

    earned_badges = sorted([
        badge_id for badge_id, sources in badge_sources.items()
        if len([src for src in sources if str(src).strip()]) > 0
    ])

    next_meta = dict(profile_meta)
    next_meta["badgeSources"] = badge_sources
    next_meta["earnedBadges"] = earned_badges
    next_meta["badgeEarnedDates"] = badge_earned_dates

    return {
        "meta": next_meta,
        "earnedBadges": earned_badges,
        "badgeEarnedDates": badge_earned_dates,
        "globallyAddedBadges": globally_added,
        "globallyRemovedBadges": globally_removed,
    }


@router.post("/action-plan/create")
def action_plan_create(info: ActionPlanInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        info.createdById = info.createdById or user.id
        info.createdByName = info.createdByName or user.name
        info.createdByRole = info.createdByRole or user.role
        info.createdAt = info.createdAt or int(__import__("time").time())
        if db.try_execute(*SQLHelper.action_plan_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        ap_id = db.created_id()
    return {"id": ap_id}


@router.get("/action-plan/delete/{plan_id}")
def action_plan_delete(plan_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_get(plan_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()

        if row is None:
            response.status_code = 404
            return {"error": "Action plan not found"}

        if not _can_user_manage_action_plan(db, user, row):
            response.status_code = 403
            return {"error": "Not allowed to delete this action plan"}

        if db.try_execute(*SQLHelper.action_plan_delete(plan_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"success": True}


@router.get("/action-plan/get/{plan_id}")
def action_plan_get(plan_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_get(plan_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()

        if row is None:
            response.status_code = 404
            return {"error": "Action plan not found"}

        if not _can_user_manage_action_plan(db, user, row):
            response.status_code = 403
            return {"error": "Not allowed to view this action plan"}

    response.status_code = 200
    return {"plan": row_to_plan(row)}


@router.post("/action-plan/update")
def action_plan_update(info: ActionPlanInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "plan id required in payload"}

    plan_id = info.id
    updates = info.model_dump(exclude_unset=True)
    updates.pop("id", None)

    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_get(plan_id)):
            response.status_code = 500
            return response

        existing = db.cursor().fetchone()
        if existing is None:
            response.status_code = 404
            return {"error": "Action plan not found"}

        if not _can_user_manage_action_plan(db, user, existing):
            response.status_code = 403
            return {"error": "Not allowed to update this action plan"}

        sql_and_params = SQLHelper.action_plan_update_partial(updates, plan_id)
        if db.try_execute(*sql_and_params):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response

    return {"id": plan_id}


@router.get("/action-plan/list")
def action_plan_list(response: fastapi.Response, goalId: int = None, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()

    out = []
    for row in rows:
        plan = row_to_plan(row)
        if goalId is not None and plan.get("goalId") != goalId:
            continue
        out.append(plan)

    response.status_code = 200
    return {"plans": out}


@router.post("/action-plan/delete-by-goal")
def action_plan_delete_by_goal(info: dict, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    goal_id = info.get("goalId")
    if goal_id is None:
        response.status_code = 400
        return {"error": "goalId required"}

    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_list_by_goal(goal_id)):
            response.status_code = 500
            return response

        rows = db.cursor().fetchall()
        for row in rows:
            if not _can_user_manage_action_plan(db, user, row):
                response.status_code = 403
                return {"error": "Not allowed to delete action plans for this goal"}

        if db.try_execute(*SQLHelper.action_plan_delete_by_goal(goal_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response

    return {"removed": True}


@router.post("/action-plan/complete")
def complete_action_plan(
    payload: ActionPlanDateMutationRequest,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    _validate_completion_date(payload.dateISO)

    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_get(payload.actionPlanId)):
            response.status_code = 500
            return response

        plan_row = db.cursor().fetchone()
        if plan_row is None:
            response.status_code = 404
            return {"error": "Action plan not found"}

        if not _can_user_manage_action_plan(db, user, plan_row):
            response.status_code = 403
            return {"error": "Not allowed to modify this action plan"}

        goal_row = None
        if plan_row["goalId"] is not None:
            if not db.try_execute(*SQLHelper.goal_get(plan_row["goalId"])):
                response.status_code = 500
                return response
            raw_goal = db.cursor().fetchone()
            if raw_goal is not None:
                goal_row = _row_to_goal_minimal(raw_goal)

        assignee_id = plan_row["assigneeId"]
        if assignee_id is None:
            response.status_code = 400
            return {"error": "Action plan is missing assigneeId"}

        profile_row = _ensure_game_profile(db, assignee_id)
        profile = row_to_profile(profile_row)

        completed_dates = _normalize_completed_dates(plan_row["completedDates"])
        completed_dates[payload.dateISO] = True

        old_plan_state = _read_reward_state_from_plan_meta(plan_row["meta"])
        new_plan_state = _build_plan_reward_state(
            plan_row,
            goal_row,
            completed_dates,
            plan_row["meta"],
            payload.dateISO,
        )

        plan_coin_delta = int(new_plan_state["planRewardCoinsTotal"]) - int(old_plan_state["planRewardCoinsTotal"])

        badge_delta = _apply_badge_source_delta(
            profile.get("meta", {}),
            payload.actionPlanId,
            old_plan_state["earnedBadges"],
            new_plan_state["earnedBadges"],
            payload.dateISO,
        )

        badge_coin_delta = (
            _sum_badge_coins(badge_delta["globallyAddedBadges"])
            - _sum_badge_coins(badge_delta["globallyRemovedBadges"])
        )

        total_coin_delta = plan_coin_delta + badge_coin_delta
        next_coins = max(0, int(profile.get("coins") or 0) + total_coin_delta)

        merged_plan_meta = _safe_json_object(plan_row["meta"], {})
        merged_plan_meta.update({
            "currentStreak": new_plan_state["currentStreak"],
            "bestStreak": new_plan_state["bestStreak"],
            "totalCompletions": new_plan_state["totalCompletions"],
            "awardedMilestones": new_plan_state["awardedMilestones"],
            "rewardedCompletionDates": new_plan_state["rewardedCompletionDates"],
            "earnedBadges": new_plan_state["earnedBadges"],
            "badgeEarnedDates": new_plan_state["badgeEarnedDates"],
            "completionCoinsTotal": new_plan_state["completionCoinsTotal"],
            "milestoneCoinsTotal": new_plan_state["milestoneCoinsTotal"],
            "planRewardCoinsTotal": new_plan_state["planRewardCoinsTotal"],
        })

        if not db.try_execute(
            *SQLHelper.action_plan_update_progress(
                payload.actionPlanId,
                completed_dates,
                new_plan_state["currentStreak"],
                new_plan_state["bestStreak"],
                new_plan_state["totalCompletions"],
                merged_plan_meta,
            )
        ):
            response.status_code = 500
            return response

        if not db.try_execute(
            *SQLHelper.profile_update_partial_for_user(
                {
                    "coins": next_coins,
                    "meta": badge_delta["meta"],
                },
                assignee_id,
            )
        ):
            response.status_code = 500
            return {"error": "Failed to persist assignee game profile"}

        db.write()

        if not db.try_execute(*SQLHelper.action_plan_get(payload.actionPlanId)):
            response.status_code = 500
            return response
        updated_row = db.cursor().fetchone()

        if not db.try_execute(*SQLHelper.get_game_profile(assignee_id)):
            response.status_code = 500
            return response
        updated_profile_row = db.cursor().fetchone()

    updated_plan = row_to_plan(updated_row)
    updated_profile = row_to_profile(updated_profile_row)

    response.status_code = 200
    return {
        "success": True,
        "actionPlanId": updated_plan["id"],
        "assigneeId": updated_plan.get("assigneeId"),
        "assigneeName": updated_plan.get("assigneeName"),
        "completedDates": updated_plan.get("completedDates", {}),
        "current": updated_plan.get("currentStreak", 0),
        "currentStreak": updated_plan.get("currentStreak", 0),
        "longest": updated_plan.get("bestStreak", 0),
        "bestStreak": updated_plan.get("bestStreak", 0),
        "totalCompletions": updated_plan.get("totalCompletions", 0),
        "earnedBadges": updated_profile.get("meta", {}).get("earnedBadges", []),
        "newBadges": badge_delta["globallyAddedBadges"],
        "badgeEarnedDates": updated_profile.get("meta", {}).get("badgeEarnedDates", {}),
        "coinsEarned": max(0, plan_coin_delta),
        "badgeCoinsEarned": max(0, badge_coin_delta),
        "milestoneCoinsEarned": max(
            0,
            int(new_plan_state["milestoneCoinsTotal"]) - int(old_plan_state["milestoneCoinsTotal"]),
        ),
        "totalCoins": int(updated_profile.get("coins") or 0),
        "awardedMilestones": new_plan_state["awardedMilestones"],
        "plan": updated_plan,
        "profile": updated_profile,
        "completedDateISO": payload.dateISO,
    }


@router.post("/action-plan/incomplete")
def incomplete_action_plan(
    payload: ActionPlanDateMutationRequest,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    _parse_iso_date(payload.dateISO)

    with Database() as db:
        if not db.try_execute(*SQLHelper.action_plan_get(payload.actionPlanId)):
            response.status_code = 500
            return response

        plan_row = db.cursor().fetchone()
        if plan_row is None:
            response.status_code = 404
            return {"error": "Action plan not found"}

        if not _can_user_manage_action_plan(db, user, plan_row):
            response.status_code = 403
            return {"error": "Not allowed to modify this action plan"}

        goal_row = None
        if plan_row["goalId"] is not None:
            if not db.try_execute(*SQLHelper.goal_get(plan_row["goalId"])):
                response.status_code = 500
                return response
            raw_goal = db.cursor().fetchone()
            if raw_goal is not None:
                goal_row = _row_to_goal_minimal(raw_goal)

        assignee_id = plan_row["assigneeId"]
        if assignee_id is None:
            response.status_code = 400
            return {"error": "Action plan is missing assigneeId"}

        profile_row = _ensure_game_profile(db, assignee_id)
        profile = row_to_profile(profile_row)

        completed_dates = _normalize_completed_dates(plan_row["completedDates"])
        completed_dates.pop(payload.dateISO, None)

        old_plan_state = _read_reward_state_from_plan_meta(plan_row["meta"])
        new_plan_state = _build_plan_reward_state(
            plan_row,
            goal_row,
            completed_dates,
            plan_row["meta"],
            payload.dateISO,
        )

        plan_coin_delta = int(new_plan_state["planRewardCoinsTotal"]) - int(old_plan_state["planRewardCoinsTotal"])

        badge_delta = _apply_badge_source_delta(
            profile.get("meta", {}),
            payload.actionPlanId,
            old_plan_state["earnedBadges"],
            new_plan_state["earnedBadges"],
            payload.dateISO,
        )

        badge_coin_delta = (
            _sum_badge_coins(badge_delta["globallyAddedBadges"])
            - _sum_badge_coins(badge_delta["globallyRemovedBadges"])
        )

        total_coin_delta = plan_coin_delta + badge_coin_delta
        next_coins = max(0, int(profile.get("coins") or 0) + total_coin_delta)

        merged_plan_meta = _safe_json_object(plan_row["meta"], {})
        merged_plan_meta.update({
            "currentStreak": new_plan_state["currentStreak"],
            "bestStreak": new_plan_state["bestStreak"],
            "totalCompletions": new_plan_state["totalCompletions"],
            "awardedMilestones": new_plan_state["awardedMilestones"],
            "rewardedCompletionDates": new_plan_state["rewardedCompletionDates"],
            "earnedBadges": new_plan_state["earnedBadges"],
            "badgeEarnedDates": new_plan_state["badgeEarnedDates"],
            "completionCoinsTotal": new_plan_state["completionCoinsTotal"],
            "milestoneCoinsTotal": new_plan_state["milestoneCoinsTotal"],
            "planRewardCoinsTotal": new_plan_state["planRewardCoinsTotal"],
        })

        if not db.try_execute(
            *SQLHelper.action_plan_update_progress(
                payload.actionPlanId,
                completed_dates,
                new_plan_state["currentStreak"],
                new_plan_state["bestStreak"],
                new_plan_state["totalCompletions"],
                merged_plan_meta,
            )
        ):
            response.status_code = 500
            return response

        if not db.try_execute(
            *SQLHelper.profile_update_partial_for_user(
                {
                    "coins": next_coins,
                    "meta": badge_delta["meta"],
                },
                assignee_id,
            )
        ):
            response.status_code = 500
            return {"error": "Failed to persist assignee game profile"}

        db.write()

        if not db.try_execute(*SQLHelper.action_plan_get(payload.actionPlanId)):
            response.status_code = 500
            return response
        updated_row = db.cursor().fetchone()

        if not db.try_execute(*SQLHelper.get_game_profile(assignee_id)):
            response.status_code = 500
            return response
        updated_profile_row = db.cursor().fetchone()

    updated_plan = row_to_plan(updated_row)
    updated_profile = row_to_profile(updated_profile_row)

    response.status_code = 200
    return {
        "success": True,
        "actionPlanId": updated_plan["id"],
        "assigneeId": updated_plan.get("assigneeId"),
        "assigneeName": updated_plan.get("assigneeName"),
        "completedDates": updated_plan.get("completedDates", {}),
        "current": updated_plan.get("currentStreak", 0),
        "currentStreak": updated_plan.get("currentStreak", 0),
        "longest": updated_plan.get("bestStreak", 0),
        "bestStreak": updated_plan.get("bestStreak", 0),
        "totalCompletions": updated_plan.get("totalCompletions", 0),
        "earnedBadges": updated_profile.get("meta", {}).get("earnedBadges", []),
        "newBadges": badge_delta["globallyAddedBadges"],
        "badgeEarnedDates": updated_profile.get("meta", {}).get("badgeEarnedDates", {}),
        "coinsEarned": min(0, plan_coin_delta),
        "badgeCoinsEarned": min(0, badge_coin_delta),
        "milestoneCoinsEarned": min(
            0,
            int(new_plan_state["milestoneCoinsTotal"]) - int(old_plan_state["milestoneCoinsTotal"]),
        ),
        "totalCoins": int(updated_profile.get("coins") or 0),
        "awardedMilestones": new_plan_state["awardedMilestones"],
        "plan": updated_plan,
        "profile": updated_profile,
        "incompletedDateISO": payload.dateISO,
    }


def row_to_plan(row) -> dict:
    data = dict(row)

    if data.get("schedule"):
        try:
            data["schedule"] = json.loads(data["schedule"])
        except Exception:
            pass

    if data.get("frequency"):
        try:
            data["frequency"] = json.loads(data["frequency"])
        except Exception:
            pass

    if data.get("completedDates"):
        try:
            data["completedDates"] = json.loads(data["completedDates"])
        except Exception:
            data["completedDates"] = {}
    else:
        data["completedDates"] = {}

    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            data["meta"] = {}
    else:
        data["meta"] = {}

    meta = data.get("meta") or {}

    data["currentStreak"] = int(data.get("currentStreak") or meta.get("currentStreak") or data.get("streak") or 0)
    data["bestStreak"] = int(data.get("bestStreak") or meta.get("bestStreak") or 0)
    data["totalCompletions"] = int(data.get("totalCompletions") or meta.get("totalCompletions") or 0)

    data["awardedMilestones"] = meta.get("awardedMilestones", [])
    data["rewardedCompletionDates"] = meta.get("rewardedCompletionDates", {})
    data["earnedBadges"] = meta.get("earnedBadges", [])
    data["badgeEarnedDates"] = meta.get("badgeEarnedDates", {})

    return data
