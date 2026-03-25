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

        #Sprint 5 Additions: Adding usernames to children.
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS children (id INTEGER PRIMARY KEY AUTOINCREMENT, parentId INTEGER, name TEXT, username TEXT, age INTEGER, code TEXT, createdAt TEXT, theme TEXT)"
        )

        def ensure_column(table: str, column: str, col_def: str):
            try:
                cols = [r[1] for r in self.__connection.execute(f"PRAGMA table_info({table})").fetchall()]
                if column not in cols:
                    self.__connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
            except sqlite3.Error:
                traceback.print_exc()

        ensure_column("children", "username", "TEXT")
        ensure_column("children", "friends", "TEXT")
        ensure_column("children", "password", "TEXT") #Sprint 5 addon for Passwords for children

        # Users table (matches backend `UserInfo` model)
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT, password TEXT, name TEXT, age INTEGER, role TEXT, createdAt TEXT, type TEXT, theme TEXT, profilePic TEXT, stats TEXT, code TEXT, meta TEXT)"
        )
        ensure_column("users", "friends", "TEXT")

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

        if create_item("Base", "/images/base", 0, "Default", "Base") is None:
            print("Failed to create item 'base'")
        if create_item("Default Eyebrows", "/images/eyebrows1", 0, "Default", "Eyebrows") is None:
            print("Failed to create item 'Default Eyebrows'")
        if create_item("Default Eyes", "/images/eyes1", 0, "Default", "Eyes") is None:
            print("Failed to create item 'Default Eyes'")
        if create_item("Default Mouth", "/images/mouth1", 0, "Default", "Mouths") is None:
            print("Failed to create item 'Default Mouth'")
        if create_item("Default Hair", "/images/hair1", 0, "Default", "Hair") is None:
            print("Failed to create item 'Default Hair'")
        if create_item("Default Shirt", "/images/shirt1", 0, "Default", "Shirts") is None:
            print("Failed to create item 'Default Shirt'")

        if create_item("Angry", "/images/eyebrows2", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Angry'")
        if create_item("Monobrow", "/images/eyebrows3", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Monobrow'")
        if create_item("Worried", "/images/eyebrows4", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Worried'")
        if create_item("Thick", "/images/eyebrows5", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Thick'")
        if create_item("Arched", "/images/eyebrows6", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Arched'")
        if create_item("Furrowed", "/images/eyebrows7", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Furrowed'")
        if create_item("Inquisitive", "/images/eyebrows8", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Inquisitive'")
        if create_item("Upturned", "/images/eyebrows9", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Upturned'")
        if create_item("Round", "/images/eyebrows10", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Round'")
        if create_item("Short", "/images/eyebrows11", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Short'")

        if create_item("Large", "/images/eyes2", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Large'")
        if create_item("Narrow", "/images/eyes3", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Narrow'")
        if create_item("Tall", "/images/eyes4", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Tall'")
        if create_item("Round", "/images/eyes5", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Round'")
        if create_item("Sharp", "/images/eyes6", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Sharp'")
        if create_item("Tired", "/images/eyes7", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Tired'")
        if create_item("Upturned", "/images/eyes8", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Upturned'")
        if create_item("Long Eyelashes", "/images/eyes9", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Long Eyelashes'")
        if create_item("Wide", "/images/eyes10", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Wide'")
        if create_item("Closed", "/images/eyes11", 10, "avatar", "Eyes") is None:
            print("Failed to create item 'Closed'")

        if create_item("Curved", "/images/mouth2", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Curved'")
        if create_item("Small", "/images/mouth3", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Small'")
        if create_item("Open", "/images/mouth4", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open'")
        if create_item("Open Fangs", "/images/mouth5", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open Fangs'")
        if create_item("Closed Fangs", "/images/mouth6", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Closed Fangs'")
        if create_item("Cartoon", "/images/mouth7", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Cartoon'")
        if create_item("Open Smile", "/images/mouth8", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open Smile'")
        if create_item("Catlike", "/images/mouth9", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Catlike'")
        if create_item("V-Shape", "/images/mouth10", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'V-Shape'")
        if create_item("Pointed Down", "/images/mouth11", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Pointed Down'")
        if create_item("Straight", "/images/mouth12", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Straight'")

        if create_item("Short", "/images/hair2", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Short'")
        if create_item("Cornrows", "/images/hair3", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Cornrows'")
        if create_item("Bob", "/images/hair4", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Bob'")
        if create_item("Short Bangs", "/images/hair5", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Short Bangs'")
        if create_item("Middle Part", "/images/hair6", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Middle Part'")     
        if create_item("Bun", "/images/hair7", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Bun'")   
        if create_item("High Pigtails", "/images/hair8", 35, "avatar", "Hair") is None:
            print("Failed to create item 'High Pigtails'")
        if create_item("Twintails", "/images/hair9", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Twintails'") 
        if create_item("Buzzed", "/images/hair10", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Buzzed'")   
        if create_item("Ruffled", "/images/hair11", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Ruffled'")
        if create_item("Unruly Long", "/images/hair12", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Unruly Long'")
        if create_item("Pixie", "/images/hair13", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Pixie'")
        if create_item("Shaggy", "/images/hair14", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Shaggy'")
        if create_item("Upward", "/images/hair15", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Upward'")
        if create_item("Semi-Bowl", "/images/hair16", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Semi-Bowl'")
        if create_item("idk1", "/images/hair17", 35, "avatar", "Hair") is None:
            print("Failed to create item 'idk1'")
        if create_item("Sideswept", "/images/hair18", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Sideswept'")
        if create_item("idk2", "/images/hair19", 35, "avatar", "Hair") is None:
            print("Failed to create item 'idk2'")
        if create_item("Pixie 2", "/images/hair20", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Pixie 2'")
        if create_item("idk3", "/images/hair21", 35, "avatar", "Hair") is None:
            print("Failed to create item 'idk3'")
        if create_item("Ponytail", "/images/hair22", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Ponytail'")
        if create_item("Afro", "/images/hair23", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Afro'")
        if create_item("Long Anime", "/images/hair24", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Long Anime'")
        if create_item("Long Side Bangs", "/images/hair25", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Long Side Bangs'")
        if create_item("Layered", "/images/hair26", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Layered'")

        if create_item("T-Shirt", "/images/shirt2", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'T-Shirt'")
        if create_item("Long Sleeve", "/images/shirt3", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'Long Sleeve'")
        if create_item("Layered Heart", "/images/shirt4", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Layered Heart'")
        if create_item("Striped Tank", "/images/shirt5", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Striped Tank'")
        if create_item("Tank Top", "/images/shirt6", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'Tank Top'")
        if create_item("Off-the-Shoulder", "/images/shirt7", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Off-the-Shoulder'")
        if create_item("Collared Sweatshirt", "/images/shirt8", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Collared Sweatshirt'")
        if create_item("Button-Up", "/images/shirt9", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Button-Up'")
        if create_item("Plain Sweatshirt", "/images/shirt10", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Plain Sweatshirt'")

        if create_item("coins", "/images/coins", 0, "money", "money") is None:
            print("Failed to create item 'coins")

        """
        Usage:
        if create_item("Red Shirt", "/items/red_shirt.png", 100, "clothing", "body") is None:
            print("Failed to create item 'Red Shirt'")
        if create_item("Blue Hat", "/items/blue_hat.png", 50, "clothing", "head") is None:
        ....
        """
