import json
import types

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import UserInfo, GameProfile
from state import SQLHelper
from state.database import Database
import typing

router = fastapi.APIRouter()


def row_to_profile(row) -> dict:
    data = dict(row)
    if data.get("inventory"):
        try:
            data["inventory"] = json.loads(data["inventory"])
        except Exception:
            data["inventory"] = []
    else:
        data["inventory"] = []

    if data.get("equipped"):
        try:
            data["equipped"] = json.loads(data["equipped"])
        except Exception:
            data["equipped"] = []

    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            data["meta"] = {}
    else:
        data["meta"] = {}

    return data


def row_to_item(row) -> dict:
    return dict(row)


def can_access_game_profile(db: Database, user: UserInfo, target_id) -> bool:
    if str(target_id) == str(user.id):
        return True

    if str(getattr(user, "role", "") or "").lower() != "parent":
        return False

    child_row = db.execute(
        "SELECT id FROM children WHERE id = ? AND parentId = ?",
        (str(target_id), str(user.id)),
    ).fetchone()

    return child_row is not None


@router.get("/game/profile")
def get_game_profile(
    response: fastapi.Response,
    userId: int = None,
    user: UserInfo = Depends(state.require_user),
):
    target_id = userId if userId is not None else user.id

    with Database() as db:
        if not can_access_game_profile(db, user, target_id):
            response.status_code = 403
            return {"error": "Not allowed to view this game profile"}

        if not db.try_execute(*SQLHelper.get_game_profile(target_id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response

    response.status_code = 200
    return {"profile": row_to_profile(row)}


@router.post("/game/profile")
def create_game_profile(payload: GameProfile, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # allow caller to override userId but default to authenticated user
    sql_and_params = SQLHelper.create_game_profile(payload, user.id)
    with Database() as db:
        if db.try_execute(*sql_and_params):
            db.write()
        else:
            response.status_code = 500
            return response
        profile_id = db.created_id()

    return {"id": profile_id}


@router.patch("/game/profile")
def update_game_profile(
    profile: GameProfile,
    response: fastapi.Response,
    userId: int = None,
    user: UserInfo = Depends(state.require_user),
):
    updates: dict[str, typing.Any] = profile.model_dump(exclude_unset=True)
    updates.pop("id", None)
    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    target_id = userId if userId is not None else user.id

    with Database() as db:
        if not can_access_game_profile(db, user, target_id):
            response.status_code = 403
            return {"error": "Not allowed to update this game profile"}

        sql_and_params = SQLHelper.profile_update_partial(updates, target_id)
        if db.try_execute(*sql_and_params):
            db.write()
            response.status_code = 200
        else:
            response.status_code = 500
            return response
    return {"id": target_id}

@router.get("/game/item/list")
def list_game_items(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.item_list()):
            response.status_code = 500
            return response
        rows = db.cursor().fetchall()

    out = []
    for row in rows:
        out.append(row_to_item(row))
    response.status_code = 200
    return {"items": out}

@router.get("/game/item/{id}")
def get_game_item(id: int, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.get_item(id)):
            response.status_code = 500
            return response
        row = db.cursor().fetchone()
    if row is None:
        response.status_code = 404
        return response

    response.status_code = 200
    return {"item": row_to_item(row)}
