//Sprint 5 addon file to aid backend with friendlist:

import { getJSON, postJSON } from './api';

export async function friendsList() {
  const info = await getJSON('/friends/list');
  return { status: info.status, data: info.data };
}

export async function friendsAdd(friend) {
  const info = await postJSON('/friends/add', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsRemove(friend) {
  const info = await postJSON('/friends/remove', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsProfileGet(friend) {
  friend = friend.replace("#", "%23");
  const info = await getJSON(`/friends/get/${friend}`);
  return { status: info.status, data: info.data };
}
