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

        # Goals table for the new habit system
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS goals ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "title TEXT, "
            "goal TEXT, "
            "goalType TEXT, "
            "whyItMatters TEXT, "
            "startDate TEXT, "
            "endDate TEXT, "
            "assigneeId TEXT, "
            "assigneeName TEXT, "
            "triggers TEXT, "
            "replacements TEXT, "
            "makeItEasier TEXT, "
            "savingFor TEXT, "
            "rewardGoalTitle TEXT, "
            "rewardGoalCostCoins INTEGER, "
            "milestoneRewards TEXT, "
            "createdAt TEXT, "
            "createdById TEXT, "
            "createdByName TEXT, "
            "createdByRole TEXT, "
            "location TEXT, "
            "meta TEXT"
            ")"
        )

        # Action plans table (also known as action_plans)
        self.__connection.execute(
            "CREATE TABLE IF NOT EXISTS action_plans ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "goalId INTEGER, "
            "title TEXT, "
            "notes TEXT, "
            "assigneeId TEXT, "
            "assigneeName TEXT, "
            "schedule TEXT, "
            "frequency TEXT, "
            "frequencyLabel TEXT, "
            "completedDates TEXT, "
            "streak INTEGER, "
            "createdAt TEXT, "
            "createdById TEXT, "
            "createdByName TEXT, "
            "createdByRole TEXT, "
            "meta TEXT"
            ")"
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

        if create_item("Base", "/base/base", 0, "Default", "Base") is None:
            print("Failed to create item 'base'")
        if create_item("Default Eyebrows", "/eyebrows/eyebrows1", 0, "Default", "Eyebrows") is None:
            print("Failed to create item 'Default Eyebrows'")
        if create_item("Default Eyes", "/eyes/eyes1", 0, "Default", "Eyes") is None:
            print("Failed to create item 'Default Eyes'")
        if create_item("Default Mouth", "/mouths/mouth1", 0, "Default", "Mouths") is None:
            print("Failed to create item 'Default Mouth'")
        if create_item("Default Hair", "/hair/hair1", 0, "Default", "Hair") is None:
            print("Failed to create item 'Default Hair'")
        if create_item("Default Shirt", "/shirts/shirt1", 0, "Default", "Shirts") is None:
            print("Failed to create item 'Default Shirt'")

        if create_item("Angry", "/eyebrows/eyebrows2", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Angry'")
        if create_item("Monobrow", "/eyebrows/eyebrows3", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Monobrow'")
        if create_item("Worried", "/eyebrows/eyebrows4", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Worried'")
        if create_item("Thick", "/eyebrows/eyebrows5", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Thick'")
        if create_item("Arched", "/eyebrows/eyebrows6", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Arched'")
        if create_item("Furrowed", "/eyebrows/eyebrows7", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Furrowed'")
        if create_item("Inquisitive", "/eyebrows/eyebrows8", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Inquisitive'")
        if create_item("Upturned", "/eyebrows/eyebrows9", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Upturned'")
        if create_item("Round", "/eyebrows/eyebrows10", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Round'")
        if create_item("Short", "/eyebrows/eyebrows11", 10, "avatar", "Eyebrows") is None:
            print("Failed to create item 'Short'")

        if create_item("Large", "/eyes/eyes2", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Large'")
        if create_item("Narrow", "/eyes/eyes3", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Narrow'")
        if create_item("Tall", "/eyes/eyes4", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Tall'")
        if create_item("Round", "/eyes/eyes5", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Round'")
        if create_item("Sharp", "/eyes/eyes6", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Sharp'")
        if create_item("Tired", "/eyes/eyes7", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Tired'")
        if create_item("Upturned", "/eyes/eyes8", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Upturned'")
        if create_item("Long Eyelashes", "/eyes/eyes9", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Long Eyelashes'")
        if create_item("Wide", "/eyes/eyes10", 30, "avatar", "Eyes") is None:
            print("Failed to create item 'Wide'")
        if create_item("Closed", "/eyes/eyes11", 10, "avatar", "Eyes") is None:
            print("Failed to create item 'Closed'")

        if create_item("Curved", "/mouths/mouth2", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Curved'")
        if create_item("Small", "/mouths/mouth3", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Small'")
        if create_item("Open", "/mouths/mouth4", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open'")
        if create_item("Open Fangs", "/mouths/mouth5", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open Fangs'")
        if create_item("Closed Fangs", "/mouths/mouth6", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Closed Fangs'")
        if create_item("Cartoon", "/mouths/mouth7", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Cartoon'")
        if create_item("Open Smile", "/mouths/mouth8", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Open Smile'")
        if create_item("Catlike", "/mouths/mouth9", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Catlike'")
        if create_item("V-Shape", "/mouths/mouth10", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'V-Shape'")
        if create_item("Pointed Down", "/mouths/mouth11", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Pointed Down'")
        if create_item("Straight", "/mouths/mouth12", 15, "avatar", "Mouths") is None:
            print("Failed to create item 'Straight'")

        if create_item("Short", "/hair/hair2", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Short'")
        if create_item("Cornrows", "/hair/hair3", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Cornrows'")
        if create_item("Bob", "/hair/hair4", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Bob'")
        if create_item("Short Bangs", "/hair/hair5", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Short Bangs'")
        if create_item("Middle Part", "/hair/hair6", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Middle Part'")     
        if create_item("Bun", "/hair/hair7", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Bun'")   
        if create_item("High Pigtails", "/hair/hair8", 35, "avatar", "Hair") is None:
            print("Failed to create item 'High Pigtails'")
        if create_item("Twintails", "/hair/hair9", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Twintails'") 
        if create_item("Buzzed", "/hair/hair10", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Buzzed'")   
        if create_item("Ruffled", "/hair/hair11", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Ruffled'")
        if create_item("Unruly Long", "/hair/hair12", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Unruly Long'")
        if create_item("Pixie", "/hair/hair13", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Pixie'")
        if create_item("Shaggy", "/hair/hair14", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Shaggy'")
        if create_item("Upward", "/hair/hair15", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Upward'")
        if create_item("Semi-Bowl", "/hair/hair16", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Semi-Bowl'")
        if create_item("idk1", "/hair/hair17", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Cornrows'")
        if create_item("Sideswept", "/hair/hair18", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Sideswept'")
        if create_item("idk2", "/hair/hair19", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Curled Afro 1'")
        if create_item("Pixie 2", "/hair/hair20", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Pixie 2'")
        if create_item("idk3", "/hair/hair21", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Curled Afro 2'")
        if create_item("Ponytail", "/hair/hair22", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Ponytail'")
        if create_item("Afro", "/hair/hair23", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Afro'")
        if create_item("Long Anime", "/hair/hair24", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Long Anime'")
        if create_item("Long Side Bangs", "/hair/hair25", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Long Side Bangs'")
        if create_item("Layered", "/hair/hair26", 35, "avatar", "Hair") is None:
            print("Failed to create item 'Layered'")

        if create_item("T-Shirt", "/shirts/shirt2", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'T-Shirt'")
        if create_item("Long Sleeve", "/shirts/shirt3", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'Long Sleeve'")
        if create_item("Layered Heart", "/shirts/shirt4", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Layered Heart'")
        if create_item("Striped Tank", "/shirts/shirt5", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Striped Tank'")
        if create_item("Tank Top", "/shirts/shirt6", 30, "avatar", "Shirts") is None:
            print("Failed to create item 'Tank Top'")
        if create_item("Off-the-Shoulder", "/shirts/shirt7", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Off-the-Shoulder'")
        if create_item("Collared Sweatshirt", "/shirts/shirt8", 40, "avatar", "Shirts") is None:
            print("Failed to create item 'Collared Sweatshirt'")
        if create_item("Button-Up", "/shirts/shirt9", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Button-Up'")
        if create_item("Plain Sweatshirt", "/shirts/shirt10", 35, "avatar", "Shirts") is None:
            print("Failed to create item 'Plain Sweatshirt'")

        if create_item("Cardigan", "/outerwear/outerwear1", 35, "avatar", "Outerwear") is None:
            print("Failed to create item 'Cardigan'")
        if create_item("Plain Hoodie", "/outerwear/outerwear2", 35, "avatar", "Outerwear") is None:
            print("Failed to create item 'Plain Hoodie'")
        if create_item("Star Hoodie", "/outerwear/outerwear3", 45, "avatar", "Outerwear") is None:
            print("Failed to create item 'Star Hoodie'")

        if create_item("coins", "/images/coins", 0, "money", "money") is None:
            print("Failed to create item 'coins")

        """
        Usage:
        if create_item("Red Shirt", "/items/red_shirt.png", 100, "clothing", "body") is None:
            print("Failed to create item 'Red Shirt'")
        if create_item("Blue Hat", "/items/blue_hat.png", 50, "clothing", "head") is None:
        ....
        """
