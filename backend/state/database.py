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

        if create_item("item0", "/items/item0.png", 100, "avatar", "head") is None:
            print("Failed to create item 'item0'")
        if create_item("item1", "items/item1.png", 100, "avatar", "head") is None:
            print("Failed to create item 'item1")
        if create_item("item2", "items/item2.png", 100, "avatar", "head") is None:
            print("Failed to create item 'item2")
        if create_item("item3", "items/item3.png", 100, "avatar", "head") is None:
            print("Failed to create item 'item3")
        if create_item("item4", "items/item4.png", 100, "avatar", "head") is None:
            print("Failed to create item 'item4")
        if create_item("item5", "items/item5.png", 100, "avatar", "shirt") is None:
            print("Failed to create item 'item5")
        if create_item("item6", "items/item6.png", 100, "avatar", "shirt") is None:
            print("Failed to create item 'item6")
        if create_item("item7", "items/item7.png", 100, "avatar", "shirt") is None:
            print("Failed to create item 'item7")
        if create_item("item8", "items/item8.png", 100, "avatar", "shirt") is None:
            print("Failed to create item 'item8")
        if create_item("item9", "items/item9.png", 100, "avatar", "shirt") is None:
            print("Failed to create item 'item9")
        if create_item("item10", "items/item10.png", 100, "avatar", "pants") is None:
            print("Failed to create item 'item10")
        if create_item("item11", "items/item11.png", 100, "avatar", "pants") is None:
            print("Failed to create item 'item11")
        if create_item("item12", "items/item12.png", 100, "avatar", "pants") is None:
            print("Failed to create item 'item12")
        if create_item("item13", "items/item13.png", 100, "avatar", "pants") is None:
            print("Failed to create item 'item13")
        if create_item("item14", "items/item14.png", 100, "avatar", "pants") is None:
            print("Failed to create item 'item14")
        if create_item("item15", "items/item15.png", 100, "avatar", "shoes") is None:
            print("Failed to create item 'item15")
        if create_item("item16", "items/item16.png", 100, "avatar", "shoes") is None:
            print("Failed to create item 'item16")
        if create_item("item17", "items/item17.png", 100, "avatar", "shoes") is None:
            print("Failed to create item 'item17")
        if create_item("item18", "items/item18.png", 100, "avatar", "shoes") is None:
            print("Failed to create item 'item18")
        if create_item("item19", "items/item19.png", 100, "avatar", "shoes") is None:
            print("Failed to create item 'item19")
        if create_item("coins", "items/coins.png", 0, "money", "money") is None:
            print("Failed to create item 'coins")            

        """
        Usage:
        if create_item("Red Shirt", "/items/red_shirt.png", 100, "clothing", "body") is None:
            print("Failed to create item 'Red Shirt'")
        if create_item("Blue Hat", "/items/blue_hat.png", 50, "clothing", "head") is None:
        ....
        """
