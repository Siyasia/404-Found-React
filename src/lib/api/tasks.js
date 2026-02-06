import * as Responses from './response.js';
import { getJSON, postJSON } from './api.js';

export async function taskCreate(task) {
  const json_data = {
    ...task.toJSON()
  };
  const info = await postJSON('/task/create', json_data);
  return new Responses.CreateTaskResponse(info.status, info.data);
}

export async function taskGet(task_id) {
  const info = await getJSON('/task/get/' + task_id);
  return new Responses.GetTaskResponse(info.status, info.data)
}

export async function taskUpdate(task) {
  const info = await postJSON('/task/update/', task);
  return new Responses.UpdateTaskResponse(info.status, info.data);
}

export async function taskDelete(task_id) {
  const info = await getJSON('/task/delete/' + task_id);
  return new Responses.DeleteResponse(info.status, info.data);
}

export async function taskList() {
  const info = await getJSON('/task/list'); // list of task objects
  return new Responses.ListTaskResponse(info.status, info.data);
}
