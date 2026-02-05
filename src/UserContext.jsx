import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from './models';

const CURRENT_USER_KEY = 'ns.currentUser.v1';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);

  // Apply a simple theme class to the <body>
  const applyTheme = (theme) => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    body.classList.remove('theme-blue', 'theme-pink');
    if (theme === 'blue') body.classList.add('theme-blue');
    if (theme === 'pink') body.classList.add('theme-pink');
  };

  // Load user once on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const instance = User.from(parsed);
        setUserState(instance);
        // Re-apply theme on startup
        if (instance && instance.theme) {
          applyTheme(instance.theme);
        }
      }
    } catch (err) {
      console.error('Failed to load user from localStorage', err);
    }
  }, []);

  const setUser = (newUser) => {
    const instance = newUser ? User.from(newUser) : null;
    setUserState(instance);
    try {
      if (instance) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(instance.toJSON()));
        // Apply theme only if provided
        applyTheme(instance.theme);
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
        applyTheme(undefined);
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
