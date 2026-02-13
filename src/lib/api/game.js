import {getJSON, patchJSON, postJSON} from './api';
import {
  CreateGameProfileResponse,
  GetGameProfileResponse, GetItemListResponse, GetItemResponse,
  UpdateGameProfileResponse
} from './response';


export async function updateGameProfile(gameProfile) {
  const json = gameProfile.toJSON();
  const info = await patchJSON('/game/profile', json);
  return new UpdateGameProfileResponse(info.status, info.data);
}

export async function getGameProfile() {
  const info = await getJSON('/game/profile');
  return new GetGameProfileResponse(info.status, info.data);
}

export async function createGameProfile(gameProfile) {
  const json = gameProfile.toJSON();
  const info = await postJSON('/game/profile', json);
  return new CreateGameProfileResponse(info.status, info.data);
}

export async function getItem(itemid) {
  const info = await getJSON('/game/item/' + itemid);
  return new GetItemResponse(info.status, info.data);
}

export async function getItemList() {
  const info = await getJSON('/game/items');
  return new GetItemListResponse(info.status, info.data);
}
