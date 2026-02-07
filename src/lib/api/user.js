import { getJSON, postJSON } from './api';
import { User } from '../../models';
import * as Responses from './response';

export async function userCreate(username, email, password, type) {
    const json_data = {
        "username": username,
        "email": email,
        "password": password,
        "type": type
    };
    const json = await postJSON('/user/create/', json_data);
    // Return the created user id (API returns user_id) for compatibility
    return json.user_id;
}

export async function userUpdate(user) {
    const json = await postJSON('/user/update', user);
    return new Responses.UpdateUserResponse(json.status, json.data);
}