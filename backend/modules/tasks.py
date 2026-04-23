import json
import traceback

import fastapi
from fastapi.params import Depends

import state
from modules.datatypes import TaskInfo, UserInfo, ChildInfo
from state import SQLHelper
from state.database import Database

router = fastapi.APIRouter()


@router.post("/task/create")
def task_create(
    info: TaskInfo,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        with Database() as db:
            if db.try_execute(*SQLHelper.task_create(info)):
                response.status_code = 200
                db.write()
                task_id = db.created_id()
                return {"id": task_id}

            response.status_code = 500
            return {"error": "Failed to create task"}
    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_create crashed: {str(exc)}"}


@router.get("/task/delete/{task_id}")
def task_delete(
    task_id: int,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        with Database() as db:
            if db.try_execute(*SQLHelper.task_delete(task_id)):
                response.status_code = 200
                db.write()
                return {"success": True}

            response.status_code = 500
            return {"error": "Failed to delete task"}
    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_delete crashed: {str(exc)}"}


@router.get("/task/get/{task_id}")
def task_get(
    task_id: int,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        with Database() as db:
            if not db.try_execute(*SQLHelper.task_get(task_id)):
                response.status_code = 500
                return {"error": "Failed to fetch task"}

            row = db.cursor().fetchone()

        if row is None:
            response.status_code = 404
            return {"error": "Task not found"}

        response.status_code = 200
        return {"task": row_to_task(row)}
    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_get crashed: {str(exc)}"}


@router.post("/task/update/")
def task_update(
    info: TaskInfo,
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        if getattr(info, "id", None) is None:
            response.status_code = 400
            return {"error": "task id required in payload"}

        task_id = info.id
        updates = info.model_dump(exclude_unset=True)
        updates.pop("id", None)

        if not updates:
            response.status_code = 400
            return {"error": "no fields to update"}

        sql_and_params = SQLHelper.task_update_partial(updates, task_id)

        with Database() as db:
            if db.try_execute(*sql_and_params):
                response.status_code = 200
                db.write()
                return {"id": task_id}

            response.status_code = 500
            return {"error": "Failed to update task"}
    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_update crashed: {str(exc)}"}


@router.get("/task/list")
def task_list(
    response: fastapi.Response,
    user: UserInfo | ChildInfo = Depends(state.require_user),
):
    try:
        if isinstance(user, ChildInfo):
            return task_list_child(response, user)

        out = []

        with Database() as db:
            if db.try_execute(*SQLHelper.task_list(user.id)):
                rows = db.cursor().fetchall() or []
                for row in rows:
                    try:
                        out.append(row_to_task(row))
                    except Exception:
                        traceback.print_exc()
            else:
                print("task_list: failed to fetch own user tasks for user.id =", user.id)

            children = []
            try:
                if db.try_execute(*SQLHelper.child_list(user.id)):
                    children = db.cursor().fetchall() or []
                else:
                    print("task_list: child_list query failed for user.id =", user.id)
            except Exception:
                traceback.print_exc()

            for child in children:
                try:
                    child_id = safe_get(child, "id")
                    if child_id is None:
                        continue

                    if not db.try_execute(*SQLHelper.child_task_list(int(child_id))):
                        print("task_list: child_task_list query failed for child_id =", child_id)
                        continue

                    child_rows = db.cursor().fetchall() or []
                    for row in child_rows:
                        try:
                            out.append(row_to_task(row))
                        except Exception:
                            traceback.print_exc()
                except Exception:
                    traceback.print_exc()
                    continue

        response.status_code = 200
        return {"tasks": out}

    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_list crashed: {str(exc)}"}


def task_list_child(response: fastapi.Response, user: ChildInfo):
    try:
        if user.id is None:
            response.status_code = 400
            return {"error": "Child id missing from session"}

        with Database() as db:
            if not db.try_execute(*SQLHelper.child_task_list(int(user.id))):
                response.status_code = 500
                return {"error": "Failed to fetch child tasks"}

            rows = db.cursor().fetchall()

        out = [row_to_task(row) for row in (rows or [])]
        response.status_code = 200
        return {"tasks": out}

    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_list_child crashed: {str(exc)}"}


@router.get("/task/list/pending")
def task_list_pending(
    response: fastapi.Response,
    user: UserInfo = Depends(state.require_user),
):
    try:
        tasks = []

        with Database() as db:
            if not db.try_execute(*SQLHelper.child_list(user.id)):
                response.status_code = 500
                return {"error": "Failed to fetch child list"}

            child_rows = db.cursor().fetchall()

            for child in child_rows or []:
                child_id = safe_get(child, "id")
                if child_id is None:
                    continue

                if not db.try_execute(*SQLHelper.task_list_pending(int(child_id))):
                    continue

                pending_rows = db.cursor().fetchall()
                for row in pending_rows or []:
                    tasks.append(row_to_task(row))

        response.status_code = 200
        return {"tasks": tasks}

    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"task_list_pending crashed: {str(exc)}"}


@router.get("/task/list/child")
def get_child_tasks(
    response: fastapi.Response,
    user: ChildInfo = Depends(state.require_user),
):
    try:
        with Database() as db:
            if not db.try_execute(
                "SELECT * FROM tasks WHERE needsApproval = 0 AND assigneeId = ?",
                (user.id,),
            ):
                response.status_code = 500
                return {"error": "Failed to fetch child-visible tasks"}

            rows = db.cursor().fetchall()

        out = [row_to_task(row) for row in (rows or [])]
        response.status_code = 200
        return {"tasks": out}

    except Exception as exc:
        traceback.print_exc()
        response.status_code = 500
        return {"error": f"get_child_tasks crashed: {str(exc)}"}


def safe_get(row, key, default=None):
    try:
        if isinstance(row, dict):
            return row.get(key, default)
        return row[key]
    except Exception:
        try:
            return getattr(row, key, default)
        except Exception:
            return default


def row_to_task(row) -> dict:
    data = dict(row)

    if data.get("steps"):
        try:
            data["steps"] = json.loads(data["steps"])
        except Exception:
            data["steps"] = [data["steps"]]

    if data.get("replacements"):
        try:
            data["replacements"] = json.loads(data["replacements"])
        except Exception:
            data["replacements"] = [data["replacements"]]

    if data.get("completedDates"):
        try:
            data["completedDates"] = json.loads(data["completedDates"])
        except Exception:
            data["completedDates"] = [data["completedDates"]]

    if data.get("frequency"):
        try:
            data["frequency"] = json.loads(data["frequency"])
        except Exception:
            pass

    if data.get("needsApproval") is not None:
        data["needsApproval"] = bool(data.get("needsApproval"))

    if data.get("meta"):
        try:
            data["meta"] = json.loads(data["meta"])
        except Exception:
            pass

    return data
