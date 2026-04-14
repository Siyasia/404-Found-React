import { useMemo } from "react";

export function useInventory(profile, itemList) {
  return useMemo(() => {
    if (!profile || !itemList) return [];

    let inventory = [];

    try {
      inventory = Array.isArray(profile.inventory)
        ? profile.inventory
        : JSON.parse(profile.inventory || "[]");
    } catch {
      inventory = [];
    }

    const itemMap = new Map(
      itemList.map(item => [item.id, item])
    );

    return inventory
      .map(invItem => {
      const fullItem = itemMap.get(invItem.id ?? invItem.itemId);
        if (!fullItem) return null;

        return {
          ...fullItem,
          equipped: invItem.equipped,
          color: invItem.color
        };
      })
      .filter(Boolean);
  }, [
    profile?.inventory,
    itemList
  ]);
}
