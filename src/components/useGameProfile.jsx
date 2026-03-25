import { useEffect, useState } from "react";
import { getGameProfile, updateGameProfile } from "../lib/api/game";
import { GameProfile } from "../models";
import { useItems } from "./useItems";

//used to load and update game profiles on relevant pages (shop, profile, etc)
export function useGameProfile() {

    //initialize profile and error message
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { items, loading: itemsLoading } = useItems();

    //attempt to load the profile from database
    useEffect(() => {

        if (itemsLoading || !items.length) return;

        async function loadProfile() {

            //safely try to get the profile of current user
            try {
                const prof = await getGameProfile();

                if (prof.status_code === 200) {

                    let loadedProfile = GameProfile.from(prof.game_profile);
                    const inventory = loadedProfile.inventory ?? [];
                    const defaultItems = items.filter(i => i.type === "Default");

                    let updated = [...inventory];

                    for (const def of defaultItems) {
                        const exists = updated.some(i => i.id === def.id);
                        if (!exists) {
                            updated.push({
                                id: def.id,
                                equipped: true,
                                color: 1
                            })
                        }
                    }

                    if (updated.length !== inventory.length) {
                        const updatedProfile = {
                            ...loadedProfile,
                            inventory: updated
                        };

                        setProfile({ ...loadedProfile, inventory: updated });
                    }
                    else {
                        setProfile(loadedProfile);
                    }
                }
                else {
                    setError("Could not load profile");
                }
            }
            catch (error) {
                console.error(error);
                setError("Server error")
            }
            finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, [items, itemsLoading]);

    async function saveProfile(updatedProfile) {
        try {
            const profileObj = updatedProfile instanceof GameProfile
                ? updatedProfile
                : GameProfile.from(updatedProfile);
            await updateGameProfile(profileObj);
            setProfile(profileObj);
        }        
        catch (error) {
            console.error("Unable to save profile", error);
            throw error;
        }
    }

    return {
        profile, setProfile, saveProfile, loading: loading || itemsLoading, error
    };
}
