import { User } from '../../models';

export async function loginAdult(email, password) {
    // todo: unstub this later

    return User.from({
        id: "user-12345",
        username: email.split('@')[0] || 'User',
        email,
        type: 'adult',
        role: 'user',
    });
}

export async function loginChild(code) {
    return User.from({
        id: "child-12345",
        username: "Child User",
        email: null,
        type: 'child',
        role: 'child',
    });
}