import sqlite3
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


def get_full_user(user: UserInfo) -> Optional[UserInfo]:
    with Database() as db:
        if not db.try_execute(*SQLHelper.user_get_by_email(user.username)):
            return None
        row = db.cursor().fetchone()
    if row is None:
        return None
    return UserInfo.model_validate(dict(row))


def get_child_from_row(row: sqlite3.Row):
    if row is None:
        return None
    return ChildInfo.model_validate(dict(row))


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()
