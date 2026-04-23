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
    key = uuid.uuid4().hex
    full_user = util.get_full_user(user)
    if full_user is None:
        response.status_code = 404
        return {"error": "User not found"}
    if full_user.password != util.hash_password(user.password):
        response.status_code = 400
        return {"error": "invalid credentials"}
    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""

    return { "success": True, "user": full_user }

#Sprint 5 addition: Making the username of the child required:
@router.post("/login/child")
def login_child(child_info: ChildInfo, response: fastapi.Response):
    key = uuid.uuid4().hex
    raw = (child_info.username or "").strip()

    if "#" not in raw:
        response.status_code = 400
        return {"error": 'You must provide a parent-generated code with a child username Ex: "SwordFish#12345"'}

    username, code = raw.split("#", 1)
    username = username.strip()
    code = code.strip()

    if not username or not code:
        response.status_code = 400
        return {"error": 'You must provide a parent-generated code with a child username Ex: "SwordFish#12345"'}

    #Require password
    if not child_info.password or not str(child_info.password).strip():
        response.status_code = 400
        return {"error": "password is required"}

    with Database() as db:
        row = db.execute(*SQLHelper.child_get_by_username_code(username, code)).fetchone()

    #Child not found
    full_child = util.get_child_from_row(row)
    if full_child is None:
        response.status_code = 404
        return {"error": "Child not found"}

    #Password check
    stored_hash = dict(row).get("password") if row else None
    if stored_hash != util.hash_password(child_info.password):
        response.status_code = 401
        return {"error": "Invalid password"}

    #Scrub passwords:
    full_child.password = ""

    state.sessions[key] = full_child
    response.set_cookie(key="session_token", value=key)
    return {"success": True, "child": full_child}

@router.post("/logout")
def logout(response: fastapi.Response, session_token: str = fastapi.Cookie(None)):
    if session_token in state.sessions:
        del state.sessions[session_token]
    response.delete_cookie(key="session_token")
    return { "success": True }

@router.post("/signup")
def signup(user: UserInfo, response: fastapi.Response):
    with Database() as db:
        new_id = db.create_new_id()
        if new_id is None:
            response.status_code = 500
            return {"error": "Failed to create user id"}
        user.id = new_id
        if not db.execute(*SQLHelper.user_check(user)).fetchone():
            password = util.hash_password(user.password)
            if db.try_execute(*SQLHelper.user_create(user, password)):
                response.status_code = 200
                db.write()
            else:
                response.status_code = 500
                return {"error": "failed to create user"}
        else:
            response.status_code = 400
            return {"error": "user already exists"}

    key = uuid.uuid4().hex

    with Database() as db:
        row = db.execute(*SQLHelper.user_get_by_email(user.email)).fetchone()

    if not row:
        response.status_code = 500
        return {"error": "failed to load created user"}

    data = dict(row)
    data['friends'] = util._parse_friends(data.get('friends'))
    full_user = UserInfo.model_validate(data)

    state.sessions[key] = full_user
    response.set_cookie(key="session_token", value=key)
    full_user.password = ""
    return {"success": True, "user": full_user}
