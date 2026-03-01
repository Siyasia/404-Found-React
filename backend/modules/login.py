import json
import uuid
import fastapi

import state
import util
from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database
from pydantic import BaseModel

router = fastapi.APIRouter()
class ChildLoginRequest(BaseModel):
    login: str

@router.post("/login")
def login(user: UserInfo, response: fastapi.Response):
    # Placeholder logic for user authentication
    # todo: check against database
    key = uuid.uuid4().hex
    # key = "test_session_token"  # todo: remove this hardcoded token in favor of `key = uuid.uuid4().hex`
    full_user = util.get_full_user(user)
    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""

    return { "success": True, "user": full_user }

#Sprint 5 addition: Making the username of the child required:
@router.post("/login/child")
def login_child(req: ChildLoginRequest, response: fastapi.Response):
    raw = (req.login or "").strip()

    if "#" not in raw:
        response.status_code = 400
        return {"error": 'You must provide a parent-generated code with a child username Ex: "SwordFish#12345"'}

    username, code = raw.split("#", 1)
    username = username.strip()
    code = code.strip()

    if not username or not code:
        response.status_code = 400
        return {"error": 'You must provide a parent-generated code with a child username Ex: "SwordFish#12345"'}

    with Database() as db:
        row = db.execute(*SQLHelper.child_get_by_username_code(username, code)).fetchone()
        if not row:
            response.status_code = 404
            return {"error": "Child not found"}

        #Storing the actual DB child object in session
        key = uuid.uuid4().hex
        child = dict(row)
        state.sessions[key] = child
        response.set_cookie(key="session_token", value=key)
        return {"success": True, "child": child}

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

    key = uuid.uuid4().hex  # todo: remove this hardcoded token in favor of `key = uuid.uuid4().hex`
    full_user = util.get_full_user(user)

    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""
    ret = full_user
    return { "success": True, "user": ret }
