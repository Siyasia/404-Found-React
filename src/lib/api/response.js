import {User, BuildHabit, BreakHabit, FormedHabit, Task, Child, GameItem, GameProfile, Goal, ActionPlan} from "../../models";

class Response {
    constructor(status, json_data) {
        this.status_code = status; 
        if (json_data && json_data.error) {
            this.error = json_data.error;
        } else {
            this.error = null;
        }
    }
}

export class CreateResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.id = json_data.id || null;
    }
}

export class GetBuildHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habit = json_data.habit ? BuildHabit.from(json_data.habit) : null;
    }
}

export class GetBreakHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habit = json_data.habit ? BreakHabit.from(json_data.habit) : null;
    }
}

export class GetFormedHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habit = json_data.habit ? FormedHabit.from(json_data.habit) : null;
    }
}

export class ListFormedHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habits = Array.isArray(json_data.habits)
            ? json_data.habits.map((habit_json) => FormedHabit.from(habit_json))
            : [];
    }
}

export class ListBreakHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habits = Array.isArray(json_data.habits)
            ? json_data.habits.map((habit_json) => BreakHabit.from(habit_json))
            : [];
    }
}

export class ListBuildHabitResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.habits = Array.isArray(json_data.habits)
            ? json_data.habits.map((habit_json) => BuildHabit.from(habit_json))
            : [];
    }
}

export class GetTaskResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.task = json_data.task ? Task.from(json_data.task) : null;
    }
}

export class ListTaskResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.tasks = Array.isArray(json_data.tasks)
            ? json_data.tasks.map((task_json) => Task.from(task_json))
            : [];
    }
}

export class LoginResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.user = json_data.user ? User.from(json_data.user) : null;        
    }   
}


export class ListChildResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.children = Array.isArray(json_data.children)
            ? json_data.children.map((child_json) => Child.from(child_json))
            : [];
    }
}

export class GetChildResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
    }
}

//Spring 5 addition:
export class ChildLoginResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.child = json_data?.child ? Child.from(json_data.child) : null;
    }
}

// New: Goal responses
export class GetGoalResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        // support multiple shapes from backend: { goal: {...} } or raw goal object
        const raw = json_data?.goal ?? json_data?.data ?? json_data ?? null;
        this.goal = raw ? Goal.from(raw) : null;
    }
}

export class ListGoalResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        const arr = json_data?.goals ?? json_data?.data ?? json_data ?? [];
        this.goals = Array.isArray(arr) ? arr.map((g) => Goal.from(g)) : [];
    }
}

export class GetGameProfileResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.game_profile = json_data.profile ? GameProfile.from(json_data.profile) : null;
    }
}

export class GetItemResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.item = json_data.item ? GameItem.from(json_data.item) : null;
    }
}

export class GetItemListResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        this.items = Array.isArray(json_data.items)
            ? json_data.items.map((item_json) => GameItem.from(item_json))
            : [];
    }
}

// Action plan responses
export class GetActionPlanResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        // backend may return { plan: {...} } or raw object
        const raw = json_data?.plan ?? json_data?.data ?? json_data ?? null;
        this.plan = raw ? (Array.isArray(raw) ? raw.map((p) => ActionPlan.from(p)) : ActionPlan.from(raw)) : null;
        // If it's a single plan object, convert to ActionPlan in callers; keep flexible here.
    }
}

export class ListActionPlanResponse extends Response {
    constructor(status, json_data) {
        super(status, json_data);
        const arr = json_data?.plans ?? json_data?.data ?? json_data ?? [];
        this.plans = Array.isArray(arr) ? arr.map((p) => ActionPlan.from(p)) : [];
    }
}

export const CreateBuildHabitResponse = CreateResponse;
export const CreateBreakHabitResponse = CreateResponse;
export const CreateTaskResponse = CreateResponse;
export const CreateFormedHabitResponse = CreateResponse;
export const CreateChildResponse = CreateResponse;
export const CreateGameProfileResponse = CreateResponse;
export const UpdateBuildHabitResponse = CreateResponse;
export const UpdateBreakHabitResponse = CreateResponse;
export const UpdateFormedHabitResponse = CreateResponse;
export const UpdateTaskResponse = CreateResponse;
export const UpdateUserResponse = CreateResponse;
export const UpdateGameProfileResponse = CreateResponse;
export const DeleteResponse = Response;

// Goal aliases - standardized names used across API modules
export const CreateGoalResponse = CreateResponse;
export const UpdateGoalResponse = CreateResponse;

// Action plan aliases
export const CreateActionPlanResponse = CreateResponse;
export const UpdateActionPlanResponse = CreateResponse;

// Note: GetGoalResponse and ListGoalResponse are exported as named classes above.
