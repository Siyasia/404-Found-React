import { getJSON, postJSON } from './api';
import { User } from '../../models';

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

export async function userUpdate(user_id, username, email, password, type) {
    const json_data = {
        "user_id": user_id,
        "username": username,
        "email": email,
        "password": password,
        "type": type
    };
    const json = await postJSON('/user/update/', json_data);
    return parseUserInfo(json);
}

function parseUserInfo(data) {
    // parseResponse returns parsed JSON (object), text, or null.
    // Be defensive: if data is null/undefined, return null.
    if (!data) return null;

    // Some APIs wrap payload in a `data` field. Unwrap if present.
    const obj = (data && typeof data === 'object' && data.data) ? data.data : data;

    // Map API response to frontend User model
    return User.from({
      id: obj.user_id ?? null,
      username: obj.username ?? '',
      email: obj.email ?? '',
      type: obj.type ?? 'user',
      theme: obj.theme ?? undefined,
    });
}
