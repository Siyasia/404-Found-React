import { useEffect, useState } from "react";
import { getItemList } from "../lib/api/game";

//used to load items from database
export function useItems() {

    //initialize items and error message
    const [items, setItems] = useState([]);
    const [itemloading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    //attempt to load the items from the database
    useEffect(() => {

        async function loadItems() {
            //safely try to get the items list
            try {
                const itemList = await getItemList();
                console.log("RAW RESPONSE:", itemList);

                if (itemList.error) {
                    setError(itemList.error);
                } 
                else {
                    setItems(itemList.items); 
                }   
            }
            catch (error) {
                console.error(error);
                setError("Server error")
            } finally {
                setLoading(false);
            }
        }

        loadItems();
    }, []);

    return { items, itemloading, error };
}