import { useEffect, useState } from "react";
import { getItemList, getGameProfile } from "../lib/api/game";

//used to load items from database
export function useInventory(profile, itemList) {

    //initialize inventory and error
    const [items, setItems] = useState([]);

    useEffect(() => {

        //if either parameter is null, return
        if (!profile || !itemList) return;

        //ensures that inventory is always present, default to empty
        const inventory = profile.inventory ?? [];

        //create a map of all items
        const itemMap = new Map(
            itemList.map(item => [item.id, item])
        );

        //search the full list of items for matches to inventory IDs
        const merged = inventory.map(invItem => {
            //fullItem stores the entire information for the item
            const fullItem = itemMap.get(invItem.id);
            if (!fullItem) return null;

            return {
                ...fullItem,
                equipped: invItem.equipped
            };
        }).filter(Boolean);

        setItems(merged);

    }, [profile, itemList]);

    return items;
}