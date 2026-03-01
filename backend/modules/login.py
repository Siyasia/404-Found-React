import json
import uuid
import fastapi

import state
import util
from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

@router.post("/login")
def login(user: UserInfo, response: fastapi.Response):
    # todo: check pw against database
    key = uuid.uuid4().hex
    full_user = util.get_full_user(user)
    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""

    return { "success": True, "user": full_user }

@router.post("/login/child")
def login_child(child_info: ChildInfo, response: fastapi.Response):
    key = uuid.uuid4().hex
    with Database() as db:
        row = db.execute(*SQLHelper.child_get_by_code(child_info.code)).fetchone()

    full_child = util.get_child_from_row(row)
    if full_child is None:
        response.status_code = 404
        return { "error": "child not found" }
    state.sessions[key] = full_child
    response.set_cookie(key="session_token", value=key)
    return { "success": True, "child": full_child }

@router.post("/logout")
def logout(response: fastapi.Response, session_token: str = fastapi.Cookie(None)):
    if session_token in state.sessions:
        del state.sessions[session_token]
    response.delete_cookie(key="session_token")
    return { "success": True }

@router.post("/signup")
def signup(user: UserInfo, response: fastapi.Response):
    with Database() as db:
        if not db.execute(*SQLHelper.user_check(user)).fetchone():
            if db.try_execute(*SQLHelper.user_create(user)):
                response.status_code = 200
                db.write()
            else:
                response.status_code = 500
                return {"error": "failed to create user"}
        else:
            response.status_code = 400
            return {"error": "user already exists"}

    key = uuid.uuid4().hex
    full_user = util.get_full_user(user)

    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""
    ret = full_user
    return { "success": True, "user": ret }
