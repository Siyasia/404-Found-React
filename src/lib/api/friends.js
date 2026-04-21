import { getJSON, postJSON } from './api';

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && typeof value !== 'object') {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return '';
}

function splitFriendCode(value) {
  const text = String(value || '').trim();
  if (!text) return { username: '', code: '' };

  const [username, code = ''] = text.split('#');
  return {
    username: username || text,
    code,
  };
}

function normalizeFriend(friendLike) {
  if (!friendLike) {
    return {
      id: '',
      username: '',
      name: '',
      code: '',
      streak: 0,
      coins: 0,
      lastActive: null,
    };
  }

  if (typeof friendLike === 'string') {
    const friendString = friendLike.trim();
    const { username, code } = splitFriendCode(friendString);

    return {
      id: friendString,
      username,
      name: username || friendString,
      code,
      streak: 0,
      coins: 0,
      lastActive: null,
    };
  }

  const nested =
    friendLike.friend && typeof friendLike.friend === 'object'
      ? friendLike.friend
      : friendLike.user && typeof friendLike.user === 'object'
        ? friendLike.user
        : null;

  const nestedId = nested
    ? firstString(nested.id, nested.username, nested.name, nested.email)
    : '';
  const rawFriendString = firstString(
    typeof friendLike.friend === 'string' ? friendLike.friend : '',
    friendLike.from,
    friendLike.requester,
    friendLike.id,
    nestedId
  );
  const parsed = splitFriendCode(rawFriendString);

  const username = firstString(
    friendLike.username,
    friendLike.friend_username,
    friendLike.from_username,
    friendLike.name,
    nested?.username,
    nested?.name,
    parsed.username
  );
  const code = firstString(
    friendLike.code,
    friendLike.friend_code,
    friendLike.from_code,
    nested?.code,
    parsed.code
  );
  const id = firstString(
    friendLike.id,
    code ? `${username}#${code}` : username,
    rawFriendString
  );
  const displayName = firstString(friendLike.name, nested?.name, username, id);

  return {
    id,
    username: username || id,
    name: displayName,
    code,
    streak: Number(friendLike.streak || nested?.streak || 0) || 0,
    coins: Number(friendLike.coins || nested?.coins || 0) || 0,
    lastActive: friendLike.lastActive || nested?.lastActive || null,
  };
}

function normalizeRequest(requestLike) {
  if (!requestLike) return '';
  if (typeof requestLike === 'string') return requestLike.trim();

  if (typeof requestLike.from === 'string') {
    return requestLike.from.trim();
  }

  const username = firstString(
    requestLike.username,
    requestLike.name,
    requestLike.friend,
    requestLike.from_username,
    requestLike.requester,
    requestLike.requesterUsername,
    requestLike.sender,
    requestLike.senderUsername
  );
  const code = firstString(
    requestLike.code,
    requestLike.from_code,
    requestLike.requesterCode,
    requestLike.senderCode
  );

  if (!username) return '';
  return code ? `${username}#${code}` : username;
}

export async function friendsList() {
  try {
    const info = await getJSON('/friends/list');

    const rawFriends = Array.isArray(info.data?.friends)
      ? info.data.friends
      : Array.isArray(info.data?.acceptedFriends)
        ? info.data.acceptedFriends
        : Array.isArray(info.data?.friend_list)
          ? info.data.friend_list
          : [];

    const rawRequests = Array.isArray(info.data?.requests)
      ? info.data.requests
      : Array.isArray(info.data?.pendingRequests)
        ? info.data.pendingRequests
        : Array.isArray(info.data?.friend_requests)
          ? info.data.friend_requests
          : Array.isArray(info.data?.incomingRequests)
            ? info.data.incomingRequests
            : Array.isArray(info.data?.received_requests)
              ? info.data.received_requests
              : [];

    return {
      status: info.status,
      data: {
        friends: rawFriends.map(normalizeFriend).filter((friend) => friend.id || friend.username || friend.name),
        requests: rawRequests.map(normalizeRequest).filter(Boolean),
      },
    };
  } catch (err) {
    return {
      status: err?.status || 500,
      data: {
        error: err?.message || 'Failed to load friends',
        friends: [],
        requests: [],
      },
    };
  }
}

export async function friendsAdd(friend) {
  const info = await postJSON('/friends/add', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsRemove(friend) {
  const info = await postJSON('/friends/remove', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsAccept(friend) {
  const info = await postJSON('/friends/accept', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsDecline(friend) {
  const info = await postJSON('/friends/decline', { friend });
  return { status: info.status, data: info.data };
}

export async function friendsProfileGet(friend) {
  const safeFriend = encodeURIComponent(String(friend || '').trim());
  const info = await getJSON(`/friends/get/${safeFriend}`);
  return { status: info.status, data: info.data };
}
