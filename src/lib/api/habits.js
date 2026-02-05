import { getJSON, postJSON } from "./api";
import { BuildHabit, BreakHabit } from '../../models';

export async function buildHabitCreate(goal, cue, steps) {
    const json_data = {
        "goal": goal,
        "cue": cue,
        "steps": [
            ...steps
        ]
    };
    const json = await postJSON('/habit/build/create', json_data);
    return parseHabitInfo(json);
}

export async function buildHabitDelete(habit_id) {
    return getJSON('/habit/build/delete/' + habit_id);
}

export async function buildHabitGet(habit_id) {
    const json = await getJSON('/habit/build/get/' + habit_id);
    return parseHabitInfo(json);
}

export async function buildHabitUpdate(goal, cue, steps) {
    const json_data = {
        "goal": goal,
        "cue": cue,
        "steps": [
            ...steps
        ]
    };
    const json = await postJSON('/habit/build/update/', json_data);
    return parseHabitInfo(json);
}

export async function buildHabitList(account_id) {
    return getJSON('/habit/build/list/' + account_id);
}

function parseHabitInfo(data) {
    // parseResponse returns parsed JSON (object), text, or null.
    // Be defensive: if data is null/undefined, return null.
    if (!data) return null;

    // Some APIs wrap payload in a `data` field. Unwrap if present.
    const obj = (data && typeof data === 'object' && data.data) ? data.data : data;

    // Provide defaults for fields that may be missing.
    const steps = Array.isArray(obj.steps) ? obj.steps : [];

    // Use frontend BuildHabit model for return value
    return BuildHabit.from({
      id: obj.id ?? null,
      account_id: obj.account_id ?? null,
      goal: obj.goal ?? '',
      cue: obj.cue ?? '',
      steps,
    });
}

export async function breakHabitCreate(habit, replacements, microSteps, savedOn) {
    const json_data = {
        "habit": habit,
        "replacements": [
            ...replacements
        ],
        "microSteps": [
            ...microSteps
        ],
        "savedOn": savedOn
    };
    const json = await postJSON('/habit/break/create', json_data);
    return parseBreakHabitInfo(json);
}

export async function breakHabitDelete(habit_id) {
    return getJSON('/habit/break/delete/' + habit_id);
}

export async function breakHabitGet(habit_id) {
    const json = await getJSON('/habit/break/get/' + habit_id);
    return parseBreakHabitInfo(json);
}

export async function breakHabitUpdate(habit, replacements, microSteps, savedOn) {
    const json_data = {
        "habit": habit,
        "replacements": [
            ...replacements
        ],
        "microSteps": [
            ...microSteps
        ],
        "savedOn": savedOn
    };
    const json = await postJSON('/habit/break/update/', json_data);
    return parseBreakHabitInfo(json);
}

export async function breakHabitList(account_id) {
    return getJSON('/habit/break/list/' + account_id);
}

function parseBreakHabitInfo(data) {
    // parseResponse returns parsed JSON (object), text, or null.
    // Be defensive: if data is null/undefined, return null.
    if (!data) return null;

    // Some APIs wrap payload in a `data` field. Unwrap if present.
    const obj = (data && typeof data === 'object' && data.data) ? data.data : data;

    // Provide defaults for fields that may be missing.
    const replacements = Array.isArray(obj.replacements) ? obj.replacements : [];
    const microSteps = Array.isArray(obj.microSteps) ? obj.microSteps : [];

    // Use frontend BreakHabit model for return value
    return BreakHabit.from({
      id: obj.id ?? null,
      account_id: obj.account_id ?? null,
      habit: obj.habit ?? '',
      replacements,
      microSteps,
      savedOn: obj.savedOn ?? 0,
    });
}
