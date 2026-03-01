import os
import sqlite3
import threading
import traceback


class Database:
    filename: str
    mutex: threading.Lock

    @staticmethod
    def init(filename: str):
        Database.filename = filename
        if not os.path.exists(Database.filename):
            open(Database.filename, "w").close()
        Database.mutex = threading.Lock()
        with Database() as db:
            db.create_tables()
            db.populate_items(db)
            # commit created tables so the DB is usable immediately
            db.write()


    def __init__(self):
        self.__connection: sqlite3.Connection
        self.__cursor: sqlite3.Cursor

    def close(self) -> None:
        self.__connection.close()

    def write(self):
        self.__connection.commit()

    def try_execute(self, sql: str, params: tuple) -> bool:
        try:
            self.__cursor.execute(sql, params)
        except sqlite3.Error:
            print(f"An error occured running the following query:")
            print(f"SQL: {sql}\nParams: {params}")
            traceback.print_exc()
            self.__connection.rollback()
            return False
        return True

    def execute(self, sql: str, params: tuple):
        return self.__cursor.execute(sql, params)

    def cursor(self) -> sqlite3.Cursor:
        return self.__cursor

    def created_id(self) -> int:
        return self.__cursor.lastrowid

    def __enter__(self):
        self.mutex.acquire()
        self.__connection = sqlite3.connect(self.filename)
        # set row_factory before creating cursor so the cursor returns sqlite3.Row objects
        self.__connection.row_factory = sqlite3.Row
        self.__cursor = self.__connection.cursor()
        self.try_execute("BEGIN TRANSACTION", ())
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.mutex.release()
        self.__connection.close()

    def create_tables(self):
        # Users table (matches backend `UserInfo` model)
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT, password TEXT, name TEXT, age INTEGER, role TEXT, createdAt TEXT, type TEXT, theme TEXT, profilePic TEXT, stats TEXT, code TEXT, meta TEXT)"
        )

        # Tasks table (represents frontend Task objects)
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, assigneeId TEXT, assigneeName TEXT, title TEXT, notes TEXT, taskType TEXT, steps TEXT, habitToBreak TEXT, replacements TEXT, frequency TEXT, streak INTEGER, completedDates TEXT, status TEXT, createdAt TEXT, createdById TEXT, createdByName TEXT, createdByRole TEXT, needsApproval INTEGER, targetType TEXT, targetName TEXT, meta TEXT)"
        )

        # Build / Break / Formed habit tables
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS build_habits (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, goal TEXT, cue TEXT, steps TEXT)"
        )
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS break_habits (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, habit TEXT, replacements TEXT, microSteps TEXT, savedOn TEXT)"
        )
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS formed_habits (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, title TEXT, type TEXT, createdAt TEXT, details TEXT, completedAt TEXT, meta TEXT)"
        )
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS children (id INTEGER PRIMARY KEY AUTOINCREMENT, parentId INTEGER, name TEXT, age INTEGER, code TEXT, createdAt TEXT, theme TEXT)"
        )
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS game_profiles (id INTEGER PRIMARY KEY, coins INTEGER, inventory TEXT)"
        )
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, price INTEGER, type TEXT, path TEXT UNIQUE, placement TEXT)"
        )

    @staticmethod
    def populate_items(db):
        def create_item(name: str, path: str, price: int, type_: str, placement: str) -> int | None:
            def item_create(name, path, price, type_, placement):
                query = "INSERT OR IGNORE INTO items (name, path, price, type, placement) VALUES (?, ?, ?, ?, ?)"
                return query, (name, path, price, type_, placement)
            if db.try_execute(*item_create(name, path, price, type_, placement)):
                db.write()
                return db.created_id()
            else:
                return None

        pass

        if create_item("Red Shirt", "/items/red_shirt.png", 100, "clothing", "body") is None:
            print("Failed to create item 'Red Shirt'")

        """
        Usage:
        if create_item("Red Shirt", "/items/red_shirt.png", 100, "clothing", "body") is None:
            print("Failed to create item 'Red Shirt'")
        if create_item("Blue Hat", "/items/blue_hat.png", 50, "clothing", "head") is None:
        ....
        """