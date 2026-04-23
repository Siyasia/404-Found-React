import fastapi
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
try:
    import dotenv as load_dotenv
except ImportError:
    import load_dotenv
import os
from state import database
from modules.habits import build_habits, break_habits
from modules import tasks, user, login, child, game, friends, action_plans, goals

load_dotenv.load_dotenv("../.env")
db_filename = os.getenv("DATABASE_FILE", "database.db")
origins = os.getenv("VITE_URL", "http://localhost:5173").split(",")
api_base = os.getenv("API_BASE", "/")
bind_address = os.getenv("BIND_ADDRESS", "0.0.0.0")
port = int(os.getenv("API_PORT", "8081"))

database.Database.init(db_filename)

app = fastapi.FastAPI()
app.include_router(build_habits.router, prefix=api_base)
app.include_router(break_habits.router, prefix=api_base)
app.include_router(tasks.router, prefix=api_base)
app.include_router(user.router, prefix=api_base)
app.include_router(login.router, prefix=api_base)
app.include_router(child.router, prefix=api_base)
app.include_router(game.router, prefix=api_base)
app.include_router(friends.router, prefix=api_base)
app.include_router(action_plans.router, prefix=api_base)
app.include_router(goals.router, prefix=api_base)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # must be explicit
    allow_credentials=True,                   # REQUIRED for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: fastapi.Request, exc: RequestValidationError):
    print("422 validation error:")
    print("URL:", request.url)
    print("Body:", await request.body())
    print("Errors:", exc.errors())

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "details": exc.errors(),
        },
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.get("/")
def read_root():
    return {"Hello": "World"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=bind_address, port=port)
