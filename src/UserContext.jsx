import React, { createContext, useContext, useEffect, useState } from 'react';

const CURRENT_USER_KEY = 'ns.currentUser.v1';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);

  // Load user once on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        setUserState(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load user from localStorage', err);
    }
  }, []);

  const setUser = (newUser) => {
    setUserState(newUser);
    try {
      if (newUser) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    } catch (err) {
      console.error('Failed to save user to localStorage', err);
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
