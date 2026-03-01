import json

from modules.datatypes import HabitInfo, UserInfo
from state import SQLHelper


def make_habitinfo():
    return HabitInfo(id=99, userId=42, title="Read", type="build", createdAt="2026-02-05T00:00:00Z", details={"steps": ["open", "read"]}, completedAt=None, meta={"m":"v"})


def test_habit_create_query_and_params():
    info = make_habitinfo()
    query, params = SQLHelper.habit_create(info)
    assert "INSERT INTO formed_habits" in query
    assert isinstance(params, tuple)
    # details are JSON-encoded (position depends on SQL, should be a string or None)
    assert params[4] is None or isinstance(params[4], str)
    if params[4]:
        assert json.loads(params[4]) == info.details


def test_habit_delete_and_get_queries():
    q, p = SQLHelper.habit_delete(5)
    assert "DELETE FROM formed_habits" in q
    assert p == (5,)

    q2, p2 = SQLHelper.habit_get(7)
    assert "SELECT * FROM formed_habits" in q2
    assert p2 == (7,)


def test_user_queries():
    u = UserInfo(
        id=7,
        username="a",
        email="b@c",
        password_hash="h",
        password="pw",
        name="A",
        age=30,
        role="adult",
        createdAt="2026-02-05T00:00:00Z",
        type="adult",
        theme="blue",
        profilePic="/p.png",
        stats={"s":1},
        code="X",
        meta={"k":"v"},
    )
    q, p = SQLHelper.user_create(u)
    assert "INSERT INTO users" in q
    # first params should include username/email
    assert p[0] == u.username and p[1] == u.email

    qd, pd = SQLHelper.user_delete(10)
    assert "DELETE FROM users" in qd
    assert pd == (10,)
