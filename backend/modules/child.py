import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()

@router.post("/child/create")
def child_create(child: ChildInfo, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if db.try_execute(*SQLHelper.child_create(child)):
            child_id = db.created_id()
            db.write()
            return {"id": child_id}
        else:
            response.status_code = 500
            return {"error": "Failed to create child"}

@router.get("/child/list")
def child_list(user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        children = db.execute(*SQLHelper.child_list(user.id)).fetchall()
        return {"children": [dict(child) for child in children]}

@router.get("/child/get/{child_id}")
def child_get(child_id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        row = db.execute(*SQLHelper.child_get(child_id, user.id)).fetchone()
        if not row:
            response.status_code = 404
            return {"error": "Child not found"}
        if row["parentId"] == user.id:
            return
        else:
            response.status_code = 403
            return {"error": "unauthorized"}

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
        if row["parentId"] == user.id:
            if db.try_execute(*SQLHelper.child_update(child, child_id)):
                db.write()
                return {"success": True}
            else:
                response.status_code = 500
                return {"error": "Failed to update child"}
        else:
            response.status_code = 403
            return {"error": "unauthorized"}