import json

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import GoalInfo, UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

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

