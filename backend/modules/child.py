import fastapi
import util
from fastapi.params import Depends

import state
from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

#Sprint 5 Update: Making username required when signing in as a child.
@router.post("/child/create")
def child_create(child: ChildInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):

    if not child.username or not str(child.username).strip():
        response.status_code = 400
        return {"error": "child username is required"}

    if "*" in child.username or "#" in child.username:
        response.status_code = 400
        return {"error": "child username cannot contain '*' or '#'"}

    if not getattr(child, "password", None) or not str(child.password).strip():
        response.status_code = 400
        return {"error": "child password is required"}

    hashed = util.hash_password(child.password)

    child.parentId = user.id

    with Database() as db:
        # NOTE: SQLHelper.child_create must accept (child, hashed)
        if db.try_execute(*SQLHelper.child_create(child, hashed)):
            child_id = db.created_id()
            db.write()
            return {"id": child_id}
        else:
            response.status_code = 500
            return {"error": "Failed to create child"}

@router.get("/child/list")
def child_list(user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        rows = db.execute(*SQLHelper.child_list(user.id)).fetchall()

    children = []
    for row in rows:
        full_child = util.get_child_from_row(row)
        if full_child is None:
            continue
        full_child.password = ""
        children.append(full_child.model_dump())

    return {"children": children}

@router.get("/child/get/{child_id}")
def child_get(child_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        row = db.execute(*SQLHelper.child_get(child_id, user.id)).fetchone()

    if not row:
        response.status_code = 404
        return {"error": "Child not found"}

    if row["parentId"] != user.id:
        response.status_code = 403
        return {"error": "unauthorized"}

    full_child = util.get_child_from_row(row)
    if full_child is None:
        response.status_code = 404
        return {"error": "Child not found"}

    full_child.password = ""
    return {"child": full_child.model_dump()}

@router.get("/child/delete/{child_id}")
def child_delete(child_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        row = db.execute(*SQLHelper.child_get(child_id, user.id)).fetchone()
        if not row:
            response.status_code = 404
            return {"error": "Child not found"}
        if row["parentId"] == user.id:
            if db.try_execute(*SQLHelper.child_delete(child_id)):
                db.write()
                return {"success": True}
            else:
                response.status_code = 500
                return {"error": "Failed to delete child"}
        else:
            response.status_code = 403
            return {"error": "unauthorized"}

@router.post("/child/update")
def child_update(child: ChildInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    if getattr(child, "id", None) is None:
        response.status_code = 400
        return {"error": "child id required in payload"}

    child_id = child.id

    with Database() as db:
        row = db.execute(*SQLHelper.child_get(child_id, user.id)).fetchone()
        if not row:
            response.status_code = 404
            return {"error": "Child not found"}

        if row["parentId"] != user.id:
            response.status_code = 403
            return {"error": "unauthorized"}

        fields = {}
        for field_name in ("parentId", "name", "username", "age", "code", "createdAt", "theme", "friends"):
            value = getattr(child, field_name, None)
            if value is not None:
                fields[field_name] = value

        if getattr(child, "password", None) is not None and str(child.password).strip():
            fields["password"] = util.hash_password(child.password)

        if not fields:
            response.status_code = 400
            return {"error": "No child fields provided to update"}

        if db.try_execute(*SQLHelper.child_update_partial(fields, child_id)):
            db.write()
            return {"success": True}

        response.status_code = 500
        return {"error": "Failed to update child"}
