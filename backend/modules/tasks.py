import json

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import TaskInfo, UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

@router.post("/task/create")
def task_create(info: TaskInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.task_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        task_id = db.created_id()
    # return both forms for compatibility
    return {"id": task_id}


@router.get("/task/delete/{task_id}")
def task_delete(task_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.task_delete(task_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"success": True}


@router.get("/task/get/{task_id}")
def task_get(task_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.task_get(task_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response

    response.status_code = 200
    return {"task": row_to_task(row)}


@router.post("/task/update/")
def task_update(info: TaskInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # require id in payload
    if getattr(info, "id", None) is None:
        response.status_code = 400
        return {"error": "task id required in payload"}
    task_id = info.id

    # only include fields actually sent by the client
    updates = info.model_dump(exclude_unset=True)
    updates.pop("id", None)
    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    # serialize lists/dicts and convert booleans if needed inside helper,
    # then build and execute the partial update
    sql_and_params = SQLHelper.task_update_partial(updates, task_id)
    with Database() as db:
        if db.try_execute(*sql_and_params):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"id": task_id}


@router.get("/task/list")
def task_list(response: fastapi.Response, user: UserInfo | ChildInfo = Depends(state.require_user)):
    with Database() as db:
        if isinstance(user, ChildInfo):
            if not db.try_execute(*SQLHelper.child_task_list(int(user.code))):
                response.status_code = 500
                return response
        elif not db.try_execute(*SQLHelper.task_list(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        out.append(row_to_task(row))
    response.status_code = 200
    return {"tasks": out}

@router.get("/task/list/pending")
def task_list_pending(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.task_list_pending(user.id)):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()
    out = []
    for row in rows:
        out.append(row_to_task(row))
    response.status_code = 200
    return {"tasks": out}

def row_to_task(row) -> dict:
    data = dict(row)
    if data.get("steps"):
        try:
            data["steps"] = json.loads(data["steps"])
        except Exception:
            data["steps"] = [data["steps"]]
    if data.get("replacements"):
        try:
            data["replacements"] = json.loads(data["replacements"])
        except Exception:
            data["replacements"] = [data["replacements"]]
    if data.get("completedDates"):
        try:
            data["completedDates"] = json.loads(data["completedDates"])
        except Exception:
            data["completedDates"] = [data["completedDates"]]
    if data.get("frequency"):
        try:
            data["frequency"] = json.loads(data["frequency"])
        except Exception:
            pass
    if data.get("needsApproval") is not None:
        # stored as integer
        data["needsApproval"] = bool(data.get("needsApproval"))
    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            pass
    return data