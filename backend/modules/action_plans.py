import json

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import ActionPlanInfo, UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

@router.post("/action-plan/create")
def action_plan_create(info: ActionPlanInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        # stamp creator info if missing
        info.createdById = info.createdById or user.id
        info.createdByName = info.createdByName or user.name
        info.createdByRole = info.createdByRole or user.role
        info.createdAt = info.createdAt or int(__import__('time').time())
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
        return response
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
    sql_and_params = SQLHelper.action_plan_update_partial(updates, plan_id)
    with Database() as db:
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
        # Always scope the query by the authenticated user to prevent
        # enumeration of other users' action plans via goalId.
        if not db.try_execute(*SQLHelper.action_plan_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        plan = row_to_plan(row)
        if goalId is not None:
            # Only include plans matching the requested goalId.
            if plan.get("goalId") != goalId:
                continue
        out.append(plan)
    response.status_code = 200
    return {"plans": out}


@router.post("/action-plan/delete-by-goal")
def action_plan_delete_by_goal(info: dict, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    goal_id = info.get('goalId')
    if goal_id is None:
        response.status_code = 400
        return {"error": "goalId required"}
    with Database() as db:
        if db.try_execute(*SQLHelper.action_plan_delete_by_goal(goal_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"removed": True}


def row_to_plan(row) -> dict:
    data = dict(row)
    # normalize JSON schedule/completedDates/meta
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
    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            pass
    return data

