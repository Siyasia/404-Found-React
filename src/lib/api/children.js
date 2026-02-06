import { getJSON, postJSON } from './api';
import { CreateChildResponse, DeleteResponse, GetChildResponse, ListChildResponse } from './response';


export async function childCreate(child) {
    // child is a Child object
    const json = child.toJSON()
    const info = await postJSON('/child/create/', json);
    return new CreateChildResponse(info.status, info.data);

}

export async function childDelete(child_id) {
    const info = await getJSON('/child/delete/' + child_id);
    return new DeleteResponse(info.status, info.data);
}

export async function childList() {
    const info = await getJSON('/child/list');
    return new ListChildResponse(info.status, info.data);
}

export async function childGet(child_id) {
    const info = await getJSON('/child/get/' + child_id);
    return new GetChildResponse(info.status, info.data);
}