import json

import fastapi
from fastapi.params import Depends

import state
import util
from modules.datatypes import BreakHabitInfo
from modules.datatypes import UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

# Break habit endpoints
@router.post("/habit/break/create")
def break_habit_create(info: BreakHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    info.account_id = user.id
    with Database() as db:
        if db.try_execute(*SQLHelper.break_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        habit_id = db.created_id()
    return {"id": habit_id}


@util.check_habit_ownership("break")
@router.get("/habit/break/delete/{habit_id}")
def break_habit_delete(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.break_delete(habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"success": True}


@util.check_habit_ownership("break")
@router.get("/habit/break/get/{habit_id}")
def break_habit_get(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.break_get(habit_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response

    response.status_code = 200
    return {"habit": row_to_habit(row)}


@util.check_habit_ownership("break")
@router.post("/habit/break/update/")
def break_habit_update(info: BreakHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "habit id required in payload"}
    habit_id = info.id
    with Database() as db:
        if db.try_execute(*SQLHelper.break_update(info, habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"id": habit_id}


@router.get("/habit/break/list")
def break_habit_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.break_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        out.append(row_to_habit(row))
    response.status_code = 200
    return {"habits": out}


def row_to_habit(row) -> dict:
    data = dict(row)
    if data.get("replacements"):
        try:
            data["replacements"] = json.loads(data["replacements"])
        except Exception:
            data["replacements"] = [data["replacements"]]
    if data.get("microSteps"):
        try:
            data["microSteps"] = json.loads(data["microSteps"])
        except Exception:
            data["microSteps"] = [data["microSteps"]]
    return data