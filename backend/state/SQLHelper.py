import json

from modules.datatypes import UserInfo, BuildHabitInfo, BreakHabitInfo, TaskInfo, FormedHabitInfo, ChildInfo, \
    GameProfile
from state.database import Database


def formed_habit_create(info: FormedHabitInfo):
    """Create a formed habit (maps to formed_habits table)."""
    query = (
        "INSERT INTO formed_habits (userId, title, type, createdAt, details, completedAt, meta) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    details_json = json.dumps(info.details) if info.details is not None else None
    meta_json = json.dumps(info.meta) if info.meta else None
    return query, (info.userId, info.title, info.type, info.createdAt, details_json, info.completedAt, meta_json)


def formed_habit_delete(habit_id: int):
    query = "DELETE FROM formed_habits WHERE id = ?"
    return query, (habit_id,)


def formed_habit_get(habit_id: int):
    query = "SELECT * FROM formed_habits WHERE id = ?"
    return query, (habit_id,)


def formed_habit_update(info: FormedHabitInfo, habit_id: int):
    query = (
        "UPDATE formed_habits SET userId = ?, title = ?, type = ?, createdAt = ?, details = ?, completedAt = ?, meta = ? WHERE id = ?"
    )
    details_json = json.dumps(info.details) if info.details is not None else None
    meta_json = json.dumps(info.meta) if info.meta else None
    return query, (info.userId, info.title, info.type, info.createdAt, details_json, info.completedAt, meta_json, habit_id)


def formed_habit_list(user_id: int):
    query = "SELECT * FROM formed_habits WHERE userId = ?"
    return query, (user_id,)


def build_create(info: BuildHabitInfo):
    query = "INSERT INTO build_habits (account_id, goal, cue, steps) VALUES (?, ?, ?, ?)"
    steps_json = json.dumps(info.steps) if info.steps else None
    return query, (info.account_id, info.goal, info.cue, steps_json)


def build_delete(habit_id: int):
    query = "DELETE FROM build_habits WHERE id = ?"
    return query, (habit_id,)


def build_get(habit_id: int):
    query = "SELECT * FROM build_habits WHERE id = ?"
    return query, (habit_id,)


def build_update(info: BuildHabitInfo, habit_id: int):
    query = "UPDATE build_habits SET account_id = ?, goal = ?, cue = ?, steps = ? WHERE id = ?"
    steps_json = json.dumps(info.steps) if info.steps else None
    return query, (info.account_id, info.goal, info.cue, steps_json, habit_id)


def build_list(account_id: int):
    query = "SELECT * FROM build_habits WHERE account_id = ?"
    return query, (account_id,)


def break_create(info: BreakHabitInfo):
    query = "INSERT INTO break_habits (account_id, habit, replacements, microSteps, savedOn) VALUES (?, ?, ?, ?, ?)"
    replacements_json = json.dumps(info.replacements) if info.replacements else None
    micro_json = json.dumps(info.microSteps) if info.microSteps else None
    return query, (info.account_id, info.habit, replacements_json, micro_json, info.savedOn)


def break_delete(habit_id: int):
    query = "DELETE FROM break_habits WHERE id = ?"
    return query, (habit_id,)


def break_get(habit_id: int):
    query = "SELECT * FROM break_habits WHERE id = ?"
    return query, (habit_id,)


def break_update(info: BreakHabitInfo, habit_id: int):
    query = "UPDATE break_habits SET account_id = ?, habit = ?, replacements = ?, microSteps = ?, savedOn = ? WHERE id = ?"
    replacements_json = json.dumps(info.replacements) if info.replacements else None
    micro_json = json.dumps(info.microSteps) if info.microSteps else None
    return query, (info.account_id, info.habit, replacements_json, micro_json, info.savedOn, habit_id)


def break_list(account_id: int):
    query = "SELECT * FROM break_habits WHERE account_id = ?"
    return query, (account_id,)

def check_habit_ownership(db: Database, account_id: int, habit_id: int, type_: str):
    # fstrings like this are bad :D
    query = f"SELECT id FROM {type_}_habits WHERE id = ? AND account_id = ?"
    if not db.try_execute(query, (habit_id, account_id)):
        return False
    row = db.cursor().fetchone()
    return row is not None

def user_check(info: UserInfo):
    """Check if a user exists with the given username or email."""
    query = "SELECT id FROM users WHERE username = ? OR email = ?"
    return query, (info.username, info.email)

def user_create(info: UserInfo, password):
    """Insert a full user record into the users table.

    All fields from the backend `UserInfo` model are persisted. Fields that
    are complex objects (stats, meta) are JSON-encoded into TEXT columns.
    """
    query = (
        "INSERT INTO users (username, email, password, name, age, role, createdAt, type, theme, profilePic, stats, code, meta) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    stats_json = json.dumps(info.stats) if info.stats else None
    meta_json = json.dumps(info.meta) if info.meta else None
    return query, (
        info.email,
        info.email,
        password,
        info.name,
        info.age,
        info.role,
        info.createdAt,
        info.type,
        info.theme,
        info.profilePic,
        stats_json,
        info.code,
        meta_json,
    )


def user_delete(user_id: int):
    query = "DELETE FROM users WHERE id = ?"
    return query, (user_id,)


def user_get(user_id: int):
    """Return only the user row for `user_id`.

    If callers need the user's habits, use `user_get_with_habits`.
    """
    query = (
        "SELECT id, username, email, password, name, age, role, createdAt, type, theme, profilePic, stats, code, meta "
        "FROM users WHERE id = ?"
    )
    return query, (user_id,)

def user_get_by_email(email: str):
    query = (
        "SELECT id, username, email, password, name, age, role, createdAt, type, theme, profilePic, stats, code, meta "
        "FROM users WHERE email = ? OR username = ?"
    )
    return query, (email, email)


def user_get_with_habits(user_id: int):
    """Return the user row joined with their formed_habits (one row per habit).

    This mirrors the historical behavior that returned user + habit rows in a
    single query; prefer fetching user and habits separately in application
    code when convenient.
    """
    query = """
    SELECT u.id AS user_id,
           u.username,
           u.email,
           fh.id AS habit_id,
           fh.userId,
           fh.title,
           fh.type,
           fh.createdAt,
           fh.details,
           fh.completedAt
    FROM users u
    LEFT JOIN formed_habits fh ON u.id = fh.userId
    WHERE u.id = ?
    """
    return query, (user_id,)


def task_create(info: TaskInfo):
    query = (
        "INSERT INTO tasks (assigneeId, assigneeName, childCode, title, notes, taskType, steps, habitToBreak, replacements, frequency, streak, completedDates, status, createdAt, createdById, createdByName, createdByRole, needsApproval, targetType, targetName, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    steps_json = json.dumps(info.steps) if info.steps else None
    replacements_json = json.dumps(info.replacements) if info.replacements else None
    completed_json = json.dumps(info.completedDates) if info.completedDates else None
    freq_json = json.dumps(info.frequency) if info.frequency is not None else None
    meta_json = json.dumps(info.meta) if info.meta else None
    needs = 1 if info.needsApproval else 0
    return query, (
        info.assigneeId,
        info.assigneeName,
        info.childCode,
        info.title,
        info.notes,
        info.taskType,
        steps_json,
        info.habitToBreak,
        replacements_json,
        freq_json,
        info.streak,
        completed_json,
        info.status,
        info.createdAt,
        info.createdById,
        info.createdByName,
        info.createdByRole,
        needs,
        info.targetType,
        info.targetName,
        meta_json,
    )


def task_delete(task_id: int):
    query = "DELETE FROM tasks WHERE id = ?"
    return query, (task_id,)


def task_get(task_id: int):
    query = "SELECT * FROM tasks WHERE id = ?"
    return query, (task_id,)


def task_update_partial(fields: dict, task_id: int):
    """
    Build a parameterized UPDATE for only the provided task fields.
    Returns a tuple like (sql, param1, param2, ...)
    """
    if not fields:
        raise ValueError("no fields to update")

    set_clauses = []
    params = []
    for col, val in fields.items():
        # serialize complex types commonly stored as JSON
        if isinstance(val, (list, dict)):
            val = json.dumps(val)
        # convert booleans to integers if DB stores them as ints
        if isinstance(val, bool):
            val = int(val)
        set_clauses.append(f"{col} = ?")
        params.append(val)

    params.append(task_id)
    set_clause = ", ".join(set_clauses)
    sql = f"UPDATE tasks SET {set_clause} WHERE id = ?"
    return sql, tuple(params)

def task_list(assignee_id: int):
    query = "SELECT * FROM tasks WHERE assigneeId = ?"
    return query, (assignee_id,)


def child_task_list(child_code: int):
    query = "SELECT * FROM tasks WHERE assigneeId IN (SELECT children.id FROM children WHERE code = ?)"
    return query, (child_code,)


def child_create(child: ChildInfo):
    query = "INSERT INTO children (parentId, id, name, age, code, createdAt, theme) VALUES (?, ?, ?, ?, ?, ?, ?)"
    return query, (child.parentId, child.id, child.name, child.age, child.code, child.createdAt, child.theme)

def child_delete(child_id: int):
    query = "DELETE FROM children WHERE id = ?"
    return query, (child_id,)

def child_get(child_id: int, parentId: int):
    query = "SELECT * FROM children WHERE id = ? AND parentId = ?"
    return query, (child_id, parentId)

def child_list(parentId: int):
    query = "SELECT * FROM children WHERE parentId = ?"
    return query, (parentId,)

def child_get_by_code(code: str):
    query = "SELECT * FROM children WHERE code = ?"
    return query, (code,)


def child_update(child, child_id):
    query = "UPDATE children SET parentId = ?, name = ?, age = ?, code = ?, createdAt = ?, theme = ? WHERE id = ?"
    return query, (child.parentId, child.name, child.age, child.code, child.createdAt, child_id, child.theme)


def formed_habit_list(userId):
    query = "SELECT * FROM formed_habits WHERE userId = ?"
    return query, (userId,)

def user_update_partial(fields: dict, user_id: int):
    """
    Build a parameterized UPDATE for only the provided fields.
    Returns a tuple like (sql, param1, param2, ...)
    """
    if not fields:
        raise ValueError("no fields to update")

    set_clauses = []
    params = []
    for col, val in fields.items():
        set_clauses.append(f"{col} = ?")
        params.append(val)

    params.append(user_id)
    set_clause = ", ".join(set_clauses)
    sql = f"UPDATE users SET {set_clause} WHERE id = ?"
    return sql, tuple(params)

def task_list_pending(assignee_id: int):
    query = "SELECT * FROM tasks WHERE assigneeId = ? AND needsApproval = 1 AND createdByRole = 'provider'"
    return query, (assignee_id,)

def get_game_profile(userId: int):
    query = "SELECT * FROM game_profiles WHERE id = ?"
    return query, (userId,)

def create_game_profile(profile: GameProfile, userid):
    query = "INSERT INTO game_profiles (id, coins, inventory) VALUES (?, ?, ?)"
    inventory_json = json.dumps(profile.inventory) if profile.inventory else "[]"
    return query, (userid, profile.coins, inventory_json)

def profile_update_partial(fields: dict, profile_id: int):
    """
    Build a parameterized UPDATE for only the provided fields.
    Returns a tuple like (sql, param1, param2, ...)
    """
    if not fields:
        raise ValueError("no fields to update")

    set_clauses = []
    params = []
    for col, val in fields.items():
        # serialize complex types commonly stored as JSON
        if isinstance(val, (list, dict)):
            val = json.dumps(val)
        set_clauses.append(f"{col} = ?")
        params.append(val)

    params.append(profile_id)
    set_clause = ", ".join(set_clauses)
    sql = f"UPDATE game_profiles SET {set_clause} WHERE id = ?"
    return sql, tuple(params)

def get_item(item_id: int):
    query = "SELECT * FROM items WHERE id = ?"
    return query, (item_id,)

def item_list():
    query = "SELECT * FROM items"
    return query, ()
