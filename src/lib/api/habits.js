import { getJSON, postJSON } from "./api";
import * as Responses from "./response";

export async function buildHabitCreate(goal, cue, steps, savedOn, reward) {
    const json_data = {
        "goal": goal,
        "cue": cue,
        "steps": [
            ...steps
        ],
        "savedOn": savedOn,
        "reward": reward
    };
    const info = await postJSON('/habit/build/create', json_data);
    return new Responses.CreateBuildHabitResponse(info.status, info.data);
}

export async function buildHabitDelete(habit_id) {
    const info = await getJSON('/habit/build/delete/' + habit_id);
    return new Responses.DeleteResponse(info.status, info.data);
}

export async function buildHabitGet(habit_id) {
    const info = await getJSON('/habit/build/get/' + habit_id);
    return new Responses.GetBuildHabitResponse(info.status, info.data);
}

export async function buildHabitUpdate(goal, cue, steps, savedOn, reward) {
    const json_data = {
        "goal": goal,
        "cue": cue,
        "steps": [
            ...steps
        ],
        "savedOn": savedOn,
        "reward": reward
    };
    const info = await postJSON('/habit/build/update/', json_data);
    return new Responses.UpdateBuildHabitResponse(info.status, info.data);
}

export async function buildHabitList() {
    const info = await getJSON('/habit/build/list');
    return new Responses.ListBuildHabitResponse(info.status, info.data);
}

export async function breakHabitCreate(habit, replacements, microSteps, savedOn, reward) {
    const json_data = {
        "habit": habit,
        "replacements": [
            ...replacements
        ],
        "microSteps": [
            ...microSteps
        ],
        "savedOn": savedOn,
        "reward": reward
    };
    const info = await postJSON('/habit/break/create', json_data);
    return new Responses.CreateBreakHabitResponse(info.status, info.data);
}

export async function breakHabitDelete(habit_id) {
    const info = await getJSON('/habit/break/delete/' + habit_id);
    return new Responses.DeleteResponse(info.status, info.data);
}

export async function breakHabitGet(habit_id) {
    const info = await getJSON('/habit/break/get/' + habit_id);
    return new Responses.GetBreakHabitResponse(info.status, info.data);
}

export async function breakHabitUpdate(habit, replacements, microSteps, savedOn, reward) {
    const json_data = {
        "habit": habit,
        "replacements": [
            ...replacements
        ],
        "microSteps": [
            ...microSteps
        ],
        "savedOn": savedOn,
        "reward": reward
    };
    const info = await postJSON('/habit/break/update/', json_data);
    return new Responses.UpdateBreakHabitResponse(info.status, info.data);
}

export async function breakHabitList() {
    const info = await getJSON('/habit/break/list');
    return new Responses.ListBreakHabitResponse(info.status, info.data);
}


export async function formedHabitCreate(habit_id, date) {
    const json_data = {
        "habit_id": habit_id,
        "date": date
    };
    const info = await postJSON('/habit/formed/create', json_data);
    return new Responses.CreateFormedHabitResponse(info.status, info.data);
}

export async function formedHabitGet(habit_id) {
    const info = await getJSON('/habit/formed/get/' + habit_id);
    return new Responses.GetFormedHabitResponse(info.status, info.data);
}

export async function formedHabitDelete(habit_id) {
    const info = await getJSON('/habit/formed/delete/' + habit_id);
    return new Responses.DeleteResponse(info.status, info.data);
}

export async function formedHabitList() {
    const info = await getJSON('/habit/formed/list');
    return new Responses.ListFormedHabitResponse(info.status, info.data);
}
