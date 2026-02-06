import { createContext, useContext, useEffect, useState } from 'react';
import { User } from './models';
import { logout, userGet } from './lib/api/authentication';


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
    async function func () {
      
    
    try {
      const user = await userGet();
      if (user) {
        setUserState(user);
        // Re-apply theme on startup
        if (user.theme) {
          applyTheme(user.theme);
        }
      }
    } catch (err) {
      console.error('Failed to load user', err);
    }
  } func();
  }, []);

  const setUser = (newUser) => {
    let instance;
    if (typeof newUser !== 'User' && newUser !== null) {
       instance = newUser ? User.from(newUser) : null;
    }
    instance = newUser;
    setUserState(instance);
    try {
      if (instance) {
        // Apply theme only if provided
        applyTheme(instance.theme || undefined);
      } else {
        logout(); // Clear session on logout
        applyTheme(undefined);
      }
    } catch (err) {
      console.error('Failed to set user', err);
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
