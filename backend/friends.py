#Sprint 5 new file, backend helping for friends list.

import json
import fastapi
from pydantic import BaseModel
from fastapi import Depends

import state
from modules.datatypes import UserInfo, ChildInfo
from state.database import Database
from state import SQLHelper

router = fastapi.APIRouter()


class FriendRequest(BaseModel):
    friend: str


def _load_list(raw_value) -> list[str]:
    """Load string lists stored in DB.

    Supports:
      - JSON list strings (["a", "b"])
      - legacy plain strings ("a")
      - legacy comma-separated strings ("a, b")
      - already-parsed lists
    """
    if raw_value is None:
        return []

    if isinstance(raw_value, list):
        return [str(x).strip() for x in raw_value if str(x).strip()]

    if not isinstance(raw_value, str):
        return []

    raw = raw_value.strip()
    if not raw:
        return []

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
        if isinstance(parsed, str):
            return [parsed.strip()] if parsed.strip() else []
    except Exception:
        pass

    if "," in raw:
        parts = [p.strip() for p in raw.split(",")]
        return [p for p in parts if p]

    return [raw]


def _dedupe_case_insensitive(values: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for v in values:
        key = v.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def _resolve_friend_identifier(friend_raw: str, db: Database) -> tuple[str | None, str | None]:
    """Validate that the friend exists and return a canonical identifier.

    Input formats:
      - "username" (regular user)
      - "childUsername#code" (child account)
    """
    value = (friend_raw or "").strip()
    if not value:
        return None, "friend is required"

    if "#" in value:
        username, code = value.split("#", 1)
        username = username.strip()
        code = code.strip()
        if not username or not code:
            return None, 'Invalid friend format. Use "childUsername#code".'

        row = db.execute(*SQLHelper.child_get_by_username_code(username, code)).fetchone()
        if not row:
            return None, 'Friend not found. For a child account, use the exact "username#code".'

        data = dict(row)
        canonical = f"{(data.get('username') or username).strip()}#{(data.get('code') or code).strip()}"
        return canonical, None

    row = db.execute(*SQLHelper.user_get_by_username(value)).fetchone()
    if not row:
        row = db.execute(*SQLHelper.user_get_by_email(value)).fetchone()

    if not row:
        return None, 'Friend not found. Use a user username, or for child accounts use "username#code".'

    data = dict(row)
    canonical = (data.get("username") or value).strip()
    return canonical, None


def _is_self(friend_id: str, user: UserInfo | ChildInfo) -> bool:
    if isinstance(user, ChildInfo):
        me_u = (user.username or "").strip()
        me_c = (user.code or "").strip()
        me = f"{me_u}#{me_c}" if me_u and me_c else ""
        return bool(me) and friend_id.lower() == me.lower()

    me = (getattr(user, "username", "") or "").strip()
    return bool(me) and friend_id.lower() == me.lower()


def _identifier_from_row(data: dict, account_type: str) -> str:
    username = (data.get("username") or "").strip()
    if account_type == "child":
        code = (data.get("code") or "").strip()
        return f"{username}#{code}" if username and code else username
    return username


def _get_account_by_identifier(identifier: str, db: Database) -> tuple[str | None, dict | None]:
    if "#" in identifier:
        username, code = identifier.split("#", 1)
        row = db.execute(*SQLHelper.child_get_by_username_code(username.strip(), code.strip())).fetchone()
        return ("child", dict(row)) if row else (None, None)

    row = db.execute(*SQLHelper.user_get_by_username(identifier.strip())).fetchone()
    return ("user", dict(row)) if row else (None, None)


def _get_current_account(user: UserInfo | ChildInfo, db: Database) -> tuple[str | None, dict | None]:
    if isinstance(user, ChildInfo):
        row = db.execute(*SQLHelper.child_get_by_code(user.code)).fetchone()
        return ("child", dict(row)) if row else (None, None)

    row = None
    if getattr(user, "id", None) is not None:
        row = db.execute(*SQLHelper.user_get(int(user.id))).fetchone()
    if not row:
        row = db.execute(*SQLHelper.user_get_by_email(user.email or user.username)).fetchone()
    return ("user", dict(row)) if row else (None, None)


def _save_friends(db: Database, account_type: str, account_id: int, friends: list[str]):
    friends_json = json.dumps(_dedupe_case_insensitive(friends))
    if account_type == "child":
        return db.try_execute(*SQLHelper.child_set_friends(account_id, friends_json))
    return db.try_execute(*SQLHelper.user_set_friends(account_id, friends_json))


def _save_incoming_requests(db: Database, account_type: str, account_id: int, requests: list[str]):
    requests_json = json.dumps(_dedupe_case_insensitive(requests))
    if account_type == "child":
        return db.try_execute(*SQLHelper.child_set_incoming_friend_requests(account_id, requests_json))
    return db.try_execute(*SQLHelper.user_set_incoming_friend_requests(account_id, requests_json))


def _get_friend_state(data: dict) -> tuple[list[str], list[str]]:
    friends = _dedupe_case_insensitive(_load_list(data.get("friends")))
    incoming = _dedupe_case_insensitive(_load_list(data.get("incomingFriendRequests")))
    return friends, incoming


@router.get("/friends/list")
def friends_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    with Database() as db:
        account_type, data = _get_current_account(user, db)
        if not data:
            response.status_code = 404
            return {"error": "user not found"}

        friends, incoming = _get_friend_state(data)
        return {"friends": friends, "requests": incoming}


@router.post("/friends/add")
def friends_add(req: FriendRequest, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    friend_raw = (req.friend or "").strip()
    if not friend_raw:
        response.status_code = 400
        return {"error": "friend is required"}

    with Database() as db:
        friend_id, err = _resolve_friend_identifier(friend_raw, db)
        if err:
            response.status_code = 404 if "not found" in err.lower() else 400
            return {"error": err}

        if _is_self(friend_id, user):
            response.status_code = 400
            return {"error": "You can't add yourself as a friend."}

        current_type, current_data = _get_current_account(user, db)
        if not current_data:
            response.status_code = 404
            return {"error": "user not found"}

        target_type, target_data = _get_account_by_identifier(friend_id, db)
        if not target_data:
            response.status_code = 404
            return {"error": "friend not found"}

        current_id = _identifier_from_row(current_data, current_type)
        current_friends, current_requests = _get_friend_state(current_data)
        target_friends, target_requests = _get_friend_state(target_data)

        current_friend_keys = {f.lower() for f in current_friends}
        target_friend_keys = {f.lower() for f in target_friends}
        target_request_keys = {f.lower() for f in target_requests}

        if friend_id.lower() in current_friend_keys:
            return {
                "friends": current_friends,
                "requests": current_requests,
                "message": "You are already friends."
            }

        # Self-heal partial friendships so both sides stay in sync.
        if current_id.lower() in target_friend_keys:
            current_friends.append(friend_id)
            _save_friends(db, current_type, current_data["id"], current_friends)
            db.write()
            return {
                "friends": _dedupe_case_insensitive(current_friends),
                "requests": current_requests,
                "message": "Friendship synced successfully."
            }

        if current_id.lower() in target_request_keys:
            return {
                "friends": current_friends,
                "requests": current_requests,
                "message": "Friend request already sent."
            }

        target_requests.append(current_id)
        _save_incoming_requests(db, target_type, target_data["id"], target_requests)
        db.write()

        return {
            "friends": current_friends,
            "requests": current_requests,
            "message": "Friend request sent."
        }


@router.post("/friends/accept")
def friends_accept(req: FriendRequest, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    friend_raw = (req.friend or "").strip()
    if not friend_raw:
        response.status_code = 400
        return {"error": "friend is required"}

    with Database() as db:
        friend_id, err = _resolve_friend_identifier(friend_raw, db)
        if err:
            response.status_code = 404 if "not found" in err.lower() else 400
            return {"error": err}

        current_type, current_data = _get_current_account(user, db)
        if not current_data:
            response.status_code = 404
            return {"error": "user not found"}

        requester_type, requester_data = _get_account_by_identifier(friend_id, db)
        if not requester_data:
            response.status_code = 404
            return {"error": "friend not found"}

        current_id = _identifier_from_row(current_data, current_type)
        current_friends, current_requests = _get_friend_state(current_data)
        requester_friends, _ = _get_friend_state(requester_data)

        request_keys = {f.lower() for f in current_requests}
        if friend_id.lower() not in request_keys:
            response.status_code = 404
            return {"error": "No pending friend request from that user."}

        if friend_id.lower() not in {f.lower() for f in current_friends}:
            current_friends.append(friend_id)
        if current_id.lower() not in {f.lower() for f in requester_friends}:
            requester_friends.append(current_id)

        current_requests = [f for f in current_requests if f.lower() != friend_id.lower()]

        _save_friends(db, current_type, current_data["id"], current_friends)
        _save_incoming_requests(db, current_type, current_data["id"], current_requests)
        _save_friends(db, requester_type, requester_data["id"], requester_friends)
        db.write()

        return {
            "friends": _dedupe_case_insensitive(current_friends),
            "requests": _dedupe_case_insensitive(current_requests),
            "message": "Friend request accepted."
        }


@router.post("/friends/decline")
def friends_decline(req: FriendRequest, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    friend_raw = (req.friend or "").strip()
    if not friend_raw:
        response.status_code = 400
        return {"error": "friend is required"}

    with Database() as db:
        friend_id, err = _resolve_friend_identifier(friend_raw, db)
        if err:
            response.status_code = 404 if "not found" in err.lower() else 400
            return {"error": err}

        current_type, current_data = _get_current_account(user, db)
        if not current_data:
            response.status_code = 404
            return {"error": "user not found"}

        current_friends, current_requests = _get_friend_state(current_data)
        if friend_id.lower() not in {f.lower() for f in current_requests}:
            response.status_code = 404
            return {"error": "No pending friend request from that user."}

        current_requests = [f for f in current_requests if f.lower() != friend_id.lower()]
        _save_incoming_requests(db, current_type, current_data["id"], current_requests)
        db.write()

        return {
            "friends": current_friends,
            "requests": _dedupe_case_insensitive(current_requests),
            "message": "Friend request declined."
        }


@router.post("/friends/remove")
def friends_remove(req: FriendRequest, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    friend_raw = (req.friend or "").strip()
    if not friend_raw:
        response.status_code = 400
        return {"error": "friend is required"}

    with Database() as db:
        friend_id, err = _resolve_friend_identifier(friend_raw, db)
        if err:
            response.status_code = 404 if "not found" in err.lower() else 400
            return {"error": err}

        current_type, current_data = _get_current_account(user, db)
        if not current_data:
            response.status_code = 404
            return {"error": "user not found"}

        current_id = _identifier_from_row(current_data, current_type)
        current_friends, current_requests = _get_friend_state(current_data)
        current_friends = [f for f in current_friends if f.lower() != friend_id.lower()]
        _save_friends(db, current_type, current_data["id"], current_friends)

        target_type, target_data = _get_account_by_identifier(friend_id, db)
        if target_data:
            target_friends, _ = _get_friend_state(target_data)
            target_friends = [f for f in target_friends if f.lower() != current_id.lower()]
            _save_friends(db, target_type, target_data["id"], target_friends)

        db.write()
        return {"friends": _dedupe_case_insensitive(current_friends), "requests": current_requests}


@router.get("/friends/get/{username}")
def get_friend_profile(username: str, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    if not username or not username.strip():
        response.status_code = 400
        return {"error": "username is required"}

    with Database() as db:
        current_type, current_data = _get_current_account(user, db)
        if not current_data:
            response.status_code = 404
            return {"error": "user not found"}

        current_friends, _ = _get_friend_state(current_data)
        if username.strip().lower() not in {f.lower() for f in current_friends}:
            response.status_code = 403
            return {"error": "That profile is only available for confirmed friends."}

        if "#" in username:
            user_row = db.execute(*SQLHelper.child_get_by_username_code(*username.split("#", 1))).fetchone()
        else:
            user_row = db.execute(*SQLHelper.user_get_by_username(username.strip())).fetchone()
        if not user_row:
            response.status_code = 404
            return {"error": "user not found"}

        user_obj = dict(user_row)
        user_id = user_obj.get("id")
        profile_row = db.execute(*SQLHelper.get_game_profile(user_id)).fetchone()
        if profile_row:
            user_obj["game_profile"] = dict(profile_row)

    if "password" in user_obj:
        del user_obj["password"]

    return {"user": user_obj}