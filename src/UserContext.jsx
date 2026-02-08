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
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = localStorage.getItem('user');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed) setUserState(User.from(parsed));
              if (parsed?.theme) applyTheme(parsed.theme);
            } catch (e) {}
          }
        }

        const fetched = await userGet();
        console.debug('userGet returned:', fetched);
        if (fetched) {
          let payload = null;
          if (fetched.user) payload = fetched.user;
          else if (fetched.data) payload = fetched.data.user ?? fetched.data;
          else if (fetched.json_data) payload = fetched.json_data.user ?? fetched.json_data;
          else payload = fetched;

          if (payload && typeof payload === 'object') {
            setUser(payload);
          } else {
            console.warn('No user payload extracted from userGet:', fetched);
          }
        }
      } catch (err) {
        console.error('Failed to load user', err);
      }
    }
    func();
  }, []);

  const setUser = (newUser) => {
    const instance = newUser ? User.from(newUser) : null;
    setUserState(instance);

    try {
      if (instance) {
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('user', JSON.stringify(instance.toJSON()));
          } catch (e) {
            console.warn('Failed to persist user to localStorage', e);
          }
        }
        if (instance.theme) applyTheme(instance.theme);
      } else {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('user');
        }
        try { logout(); } catch (e) { /* ignore logout errors */ }
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
