import { useEffect, useState } from "react";
import { getItemList } from "../lib/api/game.js";

export function useItems() {
  const [items, setItems] = useState([]);
  const [itemloading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadItems() {
      try {
        const itemList = await getItemList();

        if (itemList?.error) {
          setError(itemList.error);
          setItems([]);
        } else {
          setItems(Array.isArray(itemList?.items) ? itemList.items : []);
        }
      } catch (error) {
        console.error(error);
        setError("Server error");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, []);

  return {
    items,
    itemloading,
    loading: itemloading,
    error,
  };
}
