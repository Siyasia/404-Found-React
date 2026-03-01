import { Child, User } from '../../models';
import { getJSON, postJSON } from './api';
import { LoginResponse, ChildLoginResponse } from './response';

export async function loginAdult(email, password) {
    const data = {
        "type": "adult",
        "username": email,
        "password": password
    }
    const info = await postJSON('/login', data);
    return new LoginResponse(info.status, info.data);
}

export async function loginChild(code) {
    let data = {
        code: code
    }
    const info = await postJSON('/login/child', data);
    return new ChildLoginResponse(info.status, info.data);
}

export async function signupAdult(age, name, role, email, password) {
    const data = {
        "age": parseInt(age, 10),
        "name": name,
        "username": email,
        "role": role,
        "email": email,
        "password": password
    }
    const info = await postJSON('/signup', data);
    return new LoginResponse(info.status, info.data);
}

export async function signupChild(code, username, type) {
    const data = {
        "code": code
    }
    const info = await postJSON('/signup', data);
    return new LoginResponse(info.status, info.data);
}

export async function logout() {
    const info = await postJSON('/logout', {});
    return info.status === 200;
}

export async function userGet() {
    const info = await getJSON('/user/get');
    if (info.status === 200 && info.data) {
 
        const json = JSON.parse(info.data);
        console.log('Parsed user info:', json);
        if (Object.hasOwn(json, "code") && json.code) {
            return Child.from(json);
        }
        
        return User.from(json);
    }
}
