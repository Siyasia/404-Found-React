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
    if data.get("equipped"):
        try:
            data["equipped"] = json.loads(data["equipped"])
        except Exception:
            data["equipped"] = []
    return data


def row_to_item(row) -> dict:
    return dict(row)


@router.get("/game/profile")
def get_game_profile(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        if not db.try_execute(*SQLHelper.get_game_profile(user.id)):
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
def update_game_profile(profile: GameProfile, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # require id in payload
    updates: dict[str, typing.Any] = profile.model_dump(exclude_unset=True)
    if not updates:
        response.status_code = 400
        return {"error": "no fields to update"}

    sql_and_params = SQLHelper.profile_update_partial(updates, user.id)
    with Database() as db:
        if db.try_execute(*sql_and_params):
            db.write()
            response.status_code = 200
        else:
            response.status_code = 500
            return response
    return {"id": user.id}

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
