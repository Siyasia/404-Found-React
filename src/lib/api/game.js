import { getJSON, patchJSON, postJSON } from './api';
import {
  CreateGameProfileResponse,
  GetGameProfileResponse,
  GetItemListResponse,
  GetItemResponse,
  UpdateGameProfileResponse,
} from './response';

function normalizeProfilePayload(value) {
  if (!value) return {};

  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  return { ...value };
}

export async function updateGameProfile(gameProfile, userId = null) {
  const json = normalizeProfilePayload(gameProfile);
  const suffix = userId != null ? `?userId=${encodeURIComponent(String(userId))}` : '';
  const info = await patchJSON(`/game/profile${suffix}`, json);
  return new UpdateGameProfileResponse(info.status, info.data);
}

export async function getGameProfile(userId = null) {
  const suffix = userId != null ? `?userId=${encodeURIComponent(String(userId))}` : '';
  const info = await getJSON(`/game/profile${suffix}`);
  return new GetGameProfileResponse(info.status, info.data);
}

export async function createGameProfile(gameProfile) {
  const json = normalizeProfilePayload(gameProfile);
  const info = await postJSON('/game/profile', json);
  return new CreateGameProfileResponse(info.status, info.data);
}

export async function getItemList() {
  const info = await getJSON('/game/item/list');
  return new GetItemListResponse(info.status, info.data);
}

export async function getItem(itemid) {
  const info = await getJSON('/game/item/' + itemid);
  return new GetItemResponse(info.status, info.data);
}
