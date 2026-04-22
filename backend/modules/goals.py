import json
import time
from typing import Any, Optional

import fastapi
from fastapi import HTTPException
from fastapi.params import Depends
from pydantic import BaseModel, Field

import state
from modules.action_plans import row_to_plan
from modules.datatypes import ActionPlanInfo, GoalInfo, UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()


class GoalBundleSaveRequest(BaseModel):
    goalId: Optional[int] = None
    goal: dict[str, Any]
    actionPlans: list[dict[str, Any]] = Field(default_factory=list)


GOAL_UPDATE_FIELDS = {
    "title",
    "goal",
    "goalType",
    "whyItMatters",
    "startDate",
    "endDate",
    "assigneeId",
    "assigneeName",
    "triggers",
    "replacements",
    "makeItEasier",
    "savingFor",
    "rewardGoalTitle",
    "rewardGoalCostCoins",
    "milestoneRewards",
    "createdAt",
    "createdById",
    "createdByName",
    "createdByRole",
    "location",
    "meta",
}

ACTION_PLAN_UPDATE_FIELDS = {
    "goalId",
    "title",
    "notes",
    "assigneeId",
    "assigneeName",
    "schedule",
    "frequency",
    "frequencyLabel",
    "completedDates",
    "streak",
    "createdAt",
    "createdById",
    "createdByName",
    "createdByRole",
    "meta",
}


def _row_value(row, key, default=None):
    try:
        return row[key]
    except Exception:
        return default


def _is_parent_of_child(db, child_id, parent_id) -> bool:
    if child_id is None or parent_id is None:
        return False
    row = db.execute(
        "SELECT id FROM children WHERE id = ? AND parentId = ?",
        (str(child_id), str(parent_id)),
    ).fetchone()
    return row is not None


def _is_parent(user) -> bool:
    return str(getattr(user, "role", "") or "").lower() == "parent"


def _can_manage_assignee(db, user, assignee_id) -> bool:
    if assignee_id is None:
        return False
    if str(assignee_id) == str(user.id):
        return True
    if _is_parent(user):
        return _is_parent_of_child(db, assignee_id, user.id)
    return False


def _can_manage_goal(db, user, goal_row) -> bool:
    assignee_id = _row_value(goal_row, "assigneeId")
    creator_id = _row_value(goal_row, "createdById")
    if str(assignee_id) == str(user.id) or str(creator_id) == str(user.id):
        return True
    if _is_parent(user):
        return _is_parent_of_child(db, assignee_id, user.id)
    return False


def _incoming_plan_id(plan: dict) -> str:
    value = plan.get("id")
    if value is None:
        return ""
    return str(value).strip()


def _validate_schedule(schedule):
    if not isinstance(schedule, dict):
        raise HTTPException(status_code=400, detail="Each action plan needs a schedule")

    repeat = str(schedule.get("repeat") or schedule.get("frequency") or "").strip()
    if not repeat:
        raise HTTPException(status_code=400, detail="Each action plan needs a schedule repeat")

    if repeat.upper() in ("CUSTOM", "CUSTOM_DOW"):
        days = schedule.get("daysOfWeek")
        if not isinstance(days, list) or not days:
            raise HTTPException(status_code=400, detail="Custom schedules need daysOfWeek")

    if repeat.upper() in ("INTERVAL", "INTERVAL_DAYS"):
        try:
            interval = int(schedule.get("intervalDays") or 0)
        except Exception:
            interval = 0
        if interval <= 0:
            raise HTTPException(status_code=400, detail="Interval schedules need intervalDays")


def _sanitize_goal_payload(goal_payload: dict, user: UserInfo) -> GoalInfo:
    if not isinstance(goal_payload, dict):
        raise HTTPException(status_code=400, detail="goal must be an object")

    payload = dict(goal_payload)
    if payload.get("type") and not payload.get("goalType"):
        payload["goalType"] = payload.get("type")
    payload.pop("type", None)

    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Goal title is required")
    payload["title"] = title

    payload["createdById"] = payload.get("createdById") or user.id
    payload["createdByName"] = payload.get("createdByName") or user.name
    payload["createdByRole"] = payload.get("createdByRole") or user.role
    payload["createdAt"] = payload.get("createdAt") or int(time.time())

    return GoalInfo(**payload)


def _sanitize_action_plan_payload(plan_payload: dict, goal_id: int, user: UserInfo) -> ActionPlanInfo:
    if not isinstance(plan_payload, dict):
        raise HTTPException(status_code=400, detail="actionPlans must contain objects")

    payload = dict(plan_payload)
    payload["goalId"] = goal_id

    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Action plan title is required")
    payload["title"] = title

    schedule = payload.get("schedule") or payload.get("frequency")
    _validate_schedule(schedule)
    payload["schedule"] = schedule
    payload["frequency"] = payload.get("frequency") or schedule

    payload["createdById"] = payload.get("createdById") or user.id
    payload["createdByName"] = payload.get("createdByName") or user.name
    payload["createdByRole"] = payload.get("createdByRole") or user.role
    payload["createdAt"] = payload.get("createdAt") or int(time.time())

    return ActionPlanInfo(**payload)


def _goal_updates_from_info(info: GoalInfo) -> dict:
    data = info.model_dump(exclude_unset=True)
    data.pop("id", None)
    data.pop("type", None)
    return {key: value for key, value in data.items() if key in GOAL_UPDATE_FIELDS}


def _plan_updates_from_info(info: ActionPlanInfo) -> dict:
    data = info.model_dump(exclude_unset=True)
    data.pop("id", None)
    return {key: value for key, value in data.items() if key in ACTION_PLAN_UPDATE_FIELDS}

@router.post("/goals/create")
def goal_create(info: GoalInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        # stamp creator info if not present
        info.createdById = info.createdById or user.id
        info.createdByName = info.createdByName or user.name
        info.createdByRole = info.createdByRole or user.role
        info.createdAt = info.createdAt or int(__import__('time').time())
        if db.try_execute(*SQLHelper.goal_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        goal_id = db.created_id()
    return {"id": goal_id}


@router.get("/goals/delete/{goal_id}")
def goal_delete(goal_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.goal_delete(goal_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"success": True}


@router.get("/goals/get/{goal_id}")
def goal_get(goal_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.goal_get(goal_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response

    response.status_code = 200
    return {"goal": row_to_goal(row)}


@router.post("/goals/update")
def goal_update(info: GoalInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # require id in payload
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "goal id required in payload"}
    goal_id = info.id

    updates = info.model_dump(exclude_unset=True)
    updates.pop("id", None)
    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    sql_and_params = SQLHelper.goal_update_partial(updates, goal_id)
    with Database() as db:
        if db.try_execute(*sql_and_params):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"id": goal_id}


@router.post("/goal-bundle/save")
def goal_bundle_save(
    payload: GoalBundleSaveRequest,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        with Database() as db:
            goal_info = _sanitize_goal_payload(payload.goal, user)
            goal_id = payload.goalId
            goal_assignee_id = goal_info.assigneeId

            if goal_id is not None:
                if not db.try_execute(*SQLHelper.goal_get(goal_id)):
                    response.status_code = 500
                    return {"error": "Failed to load goal"}

                existing_goal = db.cursor().fetchone()
                if existing_goal is None:
                    response.status_code = 404
                    return {"error": "Goal not found"}

                if not _can_manage_goal(db, user, existing_goal):
                    response.status_code = 403
                    return {"error": "Not allowed to edit this goal"}

                if goal_assignee_id is None:
                    goal_assignee_id = _row_value(existing_goal, "assigneeId")
                    goal_info.assigneeId = goal_assignee_id

                if not _can_manage_assignee(db, user, goal_assignee_id):
                    response.status_code = 403
                    return {"error": "Not allowed to save a goal for this assignee"}

                updates = _goal_updates_from_info(goal_info)
                if updates and not db.try_execute(*SQLHelper.goal_update_partial(updates, goal_id)):
                    response.status_code = 500
                    return {"error": "Failed to update goal"}
            else:
                goal_assignee_id = goal_assignee_id or user.id
                goal_info.assigneeId = goal_assignee_id

                if not _can_manage_assignee(db, user, goal_assignee_id):
                    response.status_code = 403
                    return {"error": "Not allowed to save a goal for this assignee"}

                if not db.try_execute(*SQLHelper.goal_create(goal_info)):
                    response.status_code = 500
                    return {"error": "Failed to create goal"}
                goal_id = db.created_id()

            if not goal_id:
                response.status_code = 500
                return {"error": "Goal id was not available after save"}

            if not db.try_execute(*SQLHelper.action_plan_list_by_goal(goal_id)):
                response.status_code = 500
                return {"error": "Failed to load existing action plans"}

            existing_plans = db.cursor().fetchall() or []
            existing_by_id = {
                str(_row_value(plan, "id")): plan
                for plan in existing_plans
                if _row_value(plan, "id") is not None
            }
            incoming_ids = set()

            for raw_plan in payload.actionPlans:
                plan_payload = dict(raw_plan or {})
                plan_payload["goalId"] = goal_id
                plan_payload["assigneeId"] = plan_payload.get("assigneeId") or goal_assignee_id
                plan_payload["assigneeName"] = plan_payload.get("assigneeName") or goal_info.assigneeName

                if not _can_manage_assignee(db, user, plan_payload.get("assigneeId")):
                    response.status_code = 403
                    return {"error": "Not allowed to save an action plan for this assignee"}

                plan_info = _sanitize_action_plan_payload(plan_payload, goal_id, user)
                incoming_id = _incoming_plan_id(plan_payload)

                if incoming_id:
                    if incoming_id not in existing_by_id:
                        if payload.goalId is not None:
                            response.status_code = 400
                            return {"error": "Action plan id does not belong to this goal"}
                        incoming_id = ""

                if incoming_id:
                    updates = _plan_updates_from_info(plan_info)
                    if updates and not db.try_execute(
                        *SQLHelper.action_plan_update_partial(updates, int(incoming_id))
                    ):
                        response.status_code = 500
                        return {"error": "Failed to update action plan"}
                    incoming_ids.add(incoming_id)
                else:
                    if not db.try_execute(*SQLHelper.action_plan_create(plan_info)):
                        response.status_code = 500
                        return {"error": "Failed to create action plan"}

            for existing_id in existing_by_id:
                if existing_id in incoming_ids:
                    continue
                if not db.try_execute(*SQLHelper.action_plan_delete(int(existing_id))):
                    response.status_code = 500
                    return {"error": "Failed to remove deleted action plan"}

            if not db.try_execute(*SQLHelper.goal_get(goal_id)):
                response.status_code = 500
                return {"error": "Failed to reload saved goal"}
            saved_goal_row = db.cursor().fetchone()

            if not db.try_execute(*SQLHelper.action_plan_list_by_goal(goal_id)):
                response.status_code = 500
                return {"error": "Failed to reload saved action plans"}
            saved_plan_rows = db.cursor().fetchall() or []

            db.write()

        response.status_code = 200
        return {
            "success": True,
            "goal": row_to_goal(saved_goal_row),
            "actionPlans": [row_to_plan(row) for row in saved_plan_rows],
        }
    except HTTPException as exc:
        response.status_code = exc.status_code
        return {"error": exc.detail}
    except Exception as exc:
        response.status_code = 500
        return {"error": f"Failed to save goal bundle: {str(exc)}"}


@router.get("/goals/list")
def goal_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.goal_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        out.append(row_to_goal(row))
    response.status_code = 200
    return {"goals": out}


def row_to_goal(row) -> dict:
    data = dict(row)
    # normalize JSON fields
    for arr_field in ("triggers", "replacements", "makeItEasier", "milestoneRewards"):
        if data.get(arr_field):
            try:
                data[arr_field] = json.loads(data[arr_field])
            except Exception:
                data[arr_field] = [data[arr_field]]
    if data.get("rewardGoalCostCoins") is not None:
        # ensure numeric when possible
        try:
            data["rewardGoalCostCoins"] = int(data["rewardGoalCostCoins"])
        except Exception:
            pass
    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            pass
    return data
