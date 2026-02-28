import json
from typing import Any

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()


@router.post("/user/create")
def user_create(info: UserInfo, response: fastapi.Response):
    with Database() as db:
        if db.try_execute(*SQLHelper.user_create(info)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
        user_id = db.created_id()
    return {"user_id": user_id}


@router.get("/user/delete/{user_id}")
def user_delete(user_id: int, response: fastapi.Response):
    with Database() as db:
        if db.try_execute(*SQLHelper.user_delete(user_id)):
            response.status_code = 200
            db.write()
        else:
            response.status_code = 500
            return response
    return {"success": True}


@router.get("/user/get")
def user_get_current(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if isinstance(user, ChildInfo):
            if not db.try_execute(*SQLHelper.child_get_by_code(user.code)):
                response.status_code = 500
                return response
        elif not db.try_execute(*SQLHelper.user_get_by_email(user.email)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response
    response.status_code = 200
    return json.dumps(dict(row))

@router.post("/user/update")
def user_update(info: UserInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    updates: dict[str, Any] = info.model_dump(exclude_unset=True)
    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    sql_and_params = SQLHelper.user_update_partial(updates, user.id)
    with Database() as db:
        if db.try_execute(*sql_and_params):
            db.write()
            response.status_code = 200
        else:
            response.status_code = 500
            return response
    return {"id": user.id}