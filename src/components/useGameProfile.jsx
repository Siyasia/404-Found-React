import { useEffect, useState } from "react";
import { getGameProfile, updateGameProfile } from "../lib/api/game.js";
import { GameProfile } from "../models";
import { useItems } from "./useItems.jsx";
import { getJSON } from "../lib/api/api.js";

export async function getFriendProfile(username) {
  try {
    const safeUsername = encodeURIComponent(String(username || "").trim());
    const response = await getJSON(`/friends/get/${safeUsername}`);
    return { status: response.status, data: response.data };
  } catch (err) {
    return { status: 500, data: { error: "Request failed" } };
  }
}

export function useGameProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { items, loading: itemsLoading } = useItems();

  useEffect(() => {
    if (itemsLoading) return;

    async function loadProfile() {
      try {
        const prof = await getGameProfile();

        if (prof.status_code === 200) {
          const loadedProfile = GameProfile.from(prof.game_profile);
          const inventory = Array.isArray(loadedProfile.inventory)
            ? loadedProfile.inventory
            : [];
          const defaultItems = items.filter((i) => i.type === "Default");

          const updatedInventory = [...inventory];

          for (const def of defaultItems) {
            const exists = updatedInventory.some(
              (i) => String(i.id) === String(def.id)
            );
            if (!exists) {
              updatedInventory.push({
                id: def.id,
                equipped: true,
                color: 1,
              });
            }
          }

          if (updatedInventory.length !== inventory.length) {
            const nextProfile = GameProfile.from({
              ...loadedProfile,
              inventory: updatedInventory,
            });

            await updateGameProfile(nextProfile);
            setProfile(nextProfile);
          } else {
            setProfile(loadedProfile);
          }
        } else {
          setError("Could not load profile");
        }
      } catch (error) {
        console.error(error);
        setError("Server error");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [items, itemsLoading]);

  async function saveProfile(updatedProfile) {
    try {
      const profileObj =
        updatedProfile instanceof GameProfile
          ? updatedProfile
          : GameProfile.from(updatedProfile);

      await updateGameProfile(profileObj);
      setProfile(profileObj);
    } catch (error) {
      console.error("Unable to save profile", error);
      throw error;
    }
  }

  return {
    profile,
    setProfile,
    saveProfile,
    loading: loading || itemsLoading,
    error,
  };
}
