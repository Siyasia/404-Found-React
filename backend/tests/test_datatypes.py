import json

from modules.datatypes import BuildHabitInfo, BreakHabitInfo, HabitInfo, UserInfo, TaskInfo, FormedHabitInfo


def test_build_and_break_models_have_defaults_and_lists():
    b = BuildHabitInfo(id=1, account_id=5, goal="Read", cue="Morning", steps=["open", "read"])
    assert b.id == 1
    assert b.account_id == 5
    assert isinstance(b.steps, list) and b.steps == ["open", "read"]

    br = BreakHabitInfo(id=2, account_id=7, habit="Sugar", replacements=["Fruit"], microSteps=["swap"], savedOn="2026-02-05T00:00:00Z")
    assert br.id == 2
    assert br.habit == "Sugar"
    assert isinstance(br.replacements, list)


def test_formed_habit_and_task_models_roundtrip_json():
    details = {"notes": "daily"}
    fh = FormedHabitInfo(id=10, userId=3, title="Stretch", type="build", createdAt="2026-02-05T00:00:00Z", details=details, completedAt=None, meta={"m":"v"})
    assert fh.id == 10
    assert fh.userId == 3
    assert fh.title == "Stretch"

    t = TaskInfo(
        id=11,
        assigneeId=3,
        assigneeName="Child",
        title="Do stretch",
        notes="short",
        taskType="simple",
        steps=["reach", "hold"],
        habitToBreak=None,
        replacements=["none"],
        frequency=None,
        streak=0,
        completedDates=["2026-02-05"],
        status="pending",
        createdAt="2026-02-05T00:00:00Z",
        createdById=1,
        createdByName="Parent",
        createdByRole="parent",
        needsApproval=False,
        targetType="child",
        targetName="Kid",
        meta={"foo":"bar"},
    )
    assert t.title == "Do stretch"
    assert isinstance(t.steps, list)


def test_userinfo_fields_and_json_meta():
    u = UserInfo(
        id=5,
        username="bob",
        email="bob@example.com",
        password="secret",
        password_hash="hash",
        name="Bob",
        age=9,
        role="child",
        createdAt="2026-02-05T00:00:00Z",
        type="child",
        theme="pink",
        profilePic="/img.png",
        stats={"x":1},
        code="ABC123",
        meta={"k":"v"},
    )
    assert u.username == "bob"
    assert isinstance(u.stats, dict)
    assert u.meta["k"] == "v"
