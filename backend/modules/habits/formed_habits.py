import json

import fastapi
from fastapi.params import Depends

import state
import util
from modules.datatypes import FormedHabitInfo, UserInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

# Formed habit endpoints (creating a formed habit from an existing build/break habit)
@router.post("/habit/formed/create")
def formed_habit_create(payload: dict, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # expect: {"habit_id": int, "date": something}
    habit_id = payload.get("habit_id")
    date = payload.get("date")
    if habit_id is None:
        response.status_code = 400
        return {"error": "habit_id required"}

    with Database() as db:
        # try to find in build_habits
        if not db.try_execute(*SQLHelper.build_get(habit_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
        source = None
        if row is not None:
            source = dict(row)
            source_type = "build"
        else:
            # try break_habits
            if not db.try_execute(*SQLHelper.break_get(habit_id)):
                response.status_code = 500
                return response
            row = db.cursor().fetchone()
            if row is not None:
                source = dict(row)
                source_type = "break"

        if source is None:
            response.status_code = 404
            return {"error": "source habit not found"}

        # build the formed habit info
        fh = FormedHabitInfo()
        if source_type == "build":
            fh.userId = source.get("account_id")
            fh.title = source.get("goal")
            fh.type = "build"
            # parse steps
            steps_raw = source.get("steps")
            try:
                steps = json.loads(steps_raw) if steps_raw else []
            except Exception:
                steps = [steps_raw]
            fh.details = {"steps": steps}
        else:
            fh.userId = source.get("account_id")
            fh.title = source.get("habit")
            fh.type = "break"
            repl_raw = source.get("replacements")
            micro_raw = source.get("microSteps")
            try:
                repl = json.loads(repl_raw) if repl_raw else []
            except Exception:
                repl = [repl_raw]
            try:
                micro = json.loads(micro_raw) if micro_raw else []
            except Exception:
                micro = [micro_raw]
            fh.details = {"replacements": repl, "microSteps": micro}

        fh.createdAt = date

        # insert into formed_habits
        if db.try_execute(*SQLHelper.formed_habit_create(fh)):
            db.write()
            formed_id = db.created_id()
            response.status_code = 200
            return {"id": formed_id}
        else:
            response.status_code = 500
            return {"error": "failed to create formed habit"}


@util.check_habit_ownership("formed")
@router.get("/habit/formed/get/{habit_id}")
def formed_habit_get(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.formed_habit_get(habit_id)):
            response.status_code = 500
            return {"error": "failed to retrieve habit"}
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return {"error": "habit not found"}
    response.status_code = 200
    return {"habit": dict(row)}


@util.check_habit_ownership("formed")
@router.get("/habit/formed/delete/{habit_id}")
def formed_habit_delete(habit_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.formed_habit_delete(habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return {"error": "failed to delete habit"}
    return {"id": habit_id}


@util.check_habit_ownership("formed")
@router.get("/habit/formed/list")
def formed_habit_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.formed_habit_list(user.id)):
            response.status_code = 500
            return {"error": "failed to retrieve habits"}
        rows = db.cursor().fetchall()
    habits = []
    for row in rows:
        habits.append(dict(row))
    response.status_code = 200
    return {"habits": habits}


@util.check_habit_ownership("formed")
@router.post("/habit/formed/create")
def formed_habit_create(info: FormedHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        info.userId = user.id
        print(*SQLHelper.formed_habit_create(info))
        if db.try_execute(*SQLHelper.formed_habit_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return {"error": "failed to create habit"}
        habit_id = db.created_id()
    return {"id": habit_id}


@util.check_habit_ownership("formed")
@router.post("/habit/formed/update")
def formed_habit_update(info: FormedHabitInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # Expect the HabitInfo to include the id of the habit to update
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "habit id required in payload"}

    habit_id = info.id
    with Database() as db:
        if db.try_execute(*SQLHelper.formed_habit_update(info, habit_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return {"error": "failed to update habit"}
    return {"id": habit_id}