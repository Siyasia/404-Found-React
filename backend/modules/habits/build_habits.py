import json

import fastapi
from fastapi.params import Depends

import state
import util
from modules.datatypes import BuildHabitInfo, UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

@router.post("/habit/build/create")
def build_habit_create(info: BuildHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        info.account_id = user.id
        if db.try_execute(*SQLHelper.build_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        habit_id = db.created_id()
    return {"id": habit_id}


@util.check_habit_ownership("build")
@router.get("/habit/build/delete/{habit_id}")
def build_habit_delete(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not SQLHelper.check_habit_ownership(db, user.id, habit_id, "build"):
            response.status_code = 403
            return {"error": "not authorized"}
        if db.try_execute(*SQLHelper.build_delete(habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return {"error": "failed to delete habit"}


@util.check_habit_ownership("build")
@router.get("/habit/build/get/{habit_id}")
def build_habit_get(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.build_get(habit_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response
    # parse steps JSON
    data = dict(row)
    if data.get("steps"):
        try:
            data["steps"] = json.loads(data["steps"])
        except Exception:
            data["steps"] = [data["steps"]]
    response.status_code = 200
    return {"habit": data}


@util.check_habit_ownership("build")
@router.post("/habit/build/update")
def build_habit_update(info: BuildHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "habit id required in payload"}
    habit_id = info.id
    with Database() as db:
        if db.try_execute(*SQLHelper.build_update(info, habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"id": habit_id}


@util.check_habit_ownership("build")
@router.get("/habit/build/list")
def build_habit_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.build_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        data = dict(row)
        if data.get("steps"):
            try:
                data["steps"] = json.loads(data["steps"])
            except Exception:
                data["steps"] = [data["steps"]]
        out.append(data)
    response.status_code = 200
    return {"habits": out}