import sqlite3
import json
from functools import wraps
from typing import Optional

from modules.datatypes import UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database
import hashlib

def check_habit_ownership(habit_type):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with Database() as db:
                user_id = kwargs.get("user").id
                habit_id = kwargs.get("habit_id")
                if not habit_id or not habit_type:
                    # If habit_id or habit_type is not provided, we can't check ownership
                    return func(*args, **kwargs)

                if not SQLHelper.check_habit_ownership(db, user_id, habit_id, habit_type):
                    response = kwargs.get("response")
                    if response:
                        response.status_code = 403
                    return {"error": "not authorized"}
            return func(*args, **kwargs)
        return wrapper
    return decorator



def _parse_friends(raw_value):
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [str(x) for x in raw_value]
    if isinstance(raw_value, str):
        raw = raw_value.strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except Exception:
            return []
    return []

#Sprint 5 addon: Giving Users usernames, allowing for login with either email or username.
def get_full_user(user: UserInfo) -> Optional[UserInfo]:
    identifier = (user.username or "").strip()
    with Database() as db:
        # Try email first (existing behavior)
        if db.try_execute(*SQLHelper.user_get_by_email(identifier)):
            row = db.cursor().fetchone()
            if row:
                data = dict(row)
                data['friends'] = _parse_friends(data.get('friends'))
                return UserInfo.model_validate(data)

        # Then try username (new behavior)
        if db.try_execute(*SQLHelper.user_get_by_username(identifier)):
            row = db.cursor().fetchone()
            if row:
                data = dict(row)
                data['friends'] = _parse_friends(data.get('friends'))
                return UserInfo.model_validate(data)

    return None


def get_child_from_row(row: sqlite3.Row):
    if row is None:
        return None
    data = dict(row)
    data['friends'] = _parse_friends(data.get('friends'))
    return ChildInfo.model_validate(data)


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()
