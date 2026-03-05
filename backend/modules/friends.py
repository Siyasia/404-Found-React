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


def _load_friends(raw_value) -> list[str]:
    """Load friends stored in DB.

    Supports:
      - JSON list strings ("[\"a\", \"b\"]")
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

    # Child format: username#code
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

    # Regular user format: username (fallback to email just in case)
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


@router.get("/friends/list")
def friends_list(response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    # Always load from DB so the list persists across sessions.
    with Database() as db:
        if isinstance(user, ChildInfo):
            row = db.execute(*SQLHelper.child_get_by_code(user.code)).fetchone()
            if not row:
                response.status_code = 404
                return {"error": "child not found"}
            friends = _dedupe_case_insensitive(_load_friends(dict(row).get("friends")))
            return {"friends": friends}

        row = None
        if getattr(user, "id", None) is not None:
            row = db.execute(*SQLHelper.user_get(int(user.id))).fetchone()
        if not row:
            row = db.execute(*SQLHelper.user_get_by_email(user.email or user.username)).fetchone()

        if not row:
            response.status_code = 404
            return {"error": "user not found"}

        friends = _dedupe_case_insensitive(_load_friends(dict(row).get("friends")))
        return {"friends": friends}


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

        if isinstance(user, ChildInfo):
            row = db.execute(*SQLHelper.child_get_by_code(user.code)).fetchone()
            if not row:
                response.status_code = 404
                return {"error": "child not found"}

            data = dict(row)
            friends = _dedupe_case_insensitive(_load_friends(data.get("friends")))

            if friend_id.lower() not in {f.lower() for f in friends}:
                friends.append(friend_id)

            db.try_execute(*SQLHelper.child_set_friends(data["id"], json.dumps(friends)))
            db.write()
            return {"friends": friends}

        row = None
        if getattr(user, "id", None) is not None:
            row = db.execute(*SQLHelper.user_get(int(user.id))).fetchone()
        if not row:
            row = db.execute(*SQLHelper.user_get_by_email(user.email or user.username)).fetchone()

        if not row:
            response.status_code = 404
            return {"error": "user not found"}

        data = dict(row)
        friends = _dedupe_case_insensitive(_load_friends(data.get("friends")))

        if friend_id.lower() not in {f.lower() for f in friends}:
            friends.append(friend_id)

        db.try_execute(*SQLHelper.user_set_friends(data["id"], json.dumps(friends)))
        db.write()

    return {"friends": friends}


@router.post("/friends/remove")
def friends_remove(req: FriendRequest, response: fastapi.Response, user: UserInfo = Depends(state.require_user)):
    friend = (req.friend or "").strip()
    if not friend:
        response.status_code = 400
        return {"error": "friend is required"}

    with Database() as db:
        if isinstance(user, ChildInfo):
            row = db.execute(*SQLHelper.child_get_by_code(user.code)).fetchone()
            if not row:
                response.status_code = 404
                return {"error": "child not found"}
            data = dict(row)
            friends = _load_friends(data.get("friends"))
            friends = _dedupe_case_insensitive([f for f in friends if f.lower() != friend.lower()])
            db.try_execute(*SQLHelper.child_set_friends(data["id"], json.dumps(friends)))
            db.write()
            return {"friends": friends}

        row = None
        if getattr(user, "id", None) is not None:
            row = db.execute(*SQLHelper.user_get(int(user.id))).fetchone()
        if not row:
            row = db.execute(*SQLHelper.user_get_by_email(user.email or user.username)).fetchone()

        if not row:
            response.status_code = 404
            return {"error": "user not found"}

        data = dict(row)
        friends = _load_friends(data.get("friends"))
        friends = _dedupe_case_insensitive([f for f in friends if f.lower() != friend.lower()])
        db.try_execute(*SQLHelper.user_set_friends(data["id"], json.dumps(friends)))
        db.write()

    return {"friends": friends}