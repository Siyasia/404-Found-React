import { useEffect, useState } from "react";
import { getGameProfile, updateGameProfile } from "../lib/api/game";
import { GameProfile } from "../models";

//used to load and update game profiles on relevant pages (shop, profile, etc)
export function useGameProfile() {

    //initialize profile and error message
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    //attempt to load the profile from database
    useEffect(() => {

        async function loadProfile() {
            //safely try to get the profile of current user
            try {
                const prof = await getGameProfile();
                console.log("getGameProfile(): ", prof);

                if (prof.status_code === 200) {
                    setProfile(GameProfile.from(prof.profile));
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
    }, []);

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
        profile, setProfile, saveProfile, loading, error
    };
}