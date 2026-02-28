import os
import sqlite3

from modules.datatypes import UserInfo
from state.database import Database
from state import SQLHelper


def test_database_init_and_user_insert(tmp_path):
    db_file = tmp_path / "test_db.sqlite"
    # Initialize database (creates file and tables)
    Database.init(str(db_file))

    # Ensure tables are created and committed (Database.init creates them but does not commit in current implementation)
    with Database() as db:
        db.create_tables()
        db.write()

    # Insert a user using SQLHelper and Database (supply full fields)
    info = UserInfo(
        id=21,
        username="tester",
        email="t@example.com",
        password_hash="ph",
        password="pw",
        name="Tester",
        age=40,
        role="adult",
        createdAt="2026-02-05T00:00:00Z",
        type="adult",
        theme="pink",
        profilePic="/me.png",
        stats={"x":1},
        code="Z",
        meta={"k":"v"},
    )
    with Database() as db:
        success = db.try_execute(*SQLHelper.user_create(info))
        assert success is True
        db.write()
        created = db.created_id()
        # created_id should be an integer
        assert isinstance(created, int)

        # verify the row exists
        db.try_execute("SELECT id, username, email, stats, meta FROM users WHERE id = ?", (created,))
        row = db.cursor().fetchone()
        assert row is not None
        assert row[1] == info.username
        assert row[2] == info.email
        # stats and meta are JSON-encoded in the DB
        import json
        assert json.loads(row[3]) == info.stats
        assert json.loads(row[4]) == info.meta
