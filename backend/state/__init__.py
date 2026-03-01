from modules.datatypes import UserInfo, ChildInfo

sessions: dict[str, UserInfo | ChildInfo] = {}

from fastapi import Depends, Cookie, HTTPException

def require_user(session_token: str | None = Cookie(default=None, alias="session_token")):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = sessions.get(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")

    return user
