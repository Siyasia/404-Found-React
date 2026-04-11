import { useMemo } from "react";

export function useInventory(profile, itemList) {
  return useMemo(() => {
    if (!profile || !itemList) return [];

    const inventory = profile.inventory ?? [];

    const itemMap = new Map(
      itemList.map(item => [item.id, item])
    );

    return inventory
      .map(invItem => {
        const fullItem = itemMap.get(invItem.id);
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
