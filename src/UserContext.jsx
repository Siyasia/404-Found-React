import { createContext, useContext, useEffect, useState } from 'react';
import { User } from './models';
import { logout, userGet } from './lib/api/authentication';


const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);

  const applyTheme = (prefs) => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const palette = prefs?.palette || 'gold';
    const mode = prefs?.themeMode || prefs?.mode || (prefs?.theme === 'dark' ? 'dark' : 'light');

    body.classList.remove(
      'mode-light', 'mode-dark',
      'theme-gold', 'theme-cool', 'theme-morning',
      'theme-blue', 'theme-pink', 'theme-light', 'theme-dark'
    );

    body.classList.add(mode === 'dark' ? 'mode-dark' : 'mode-light');

    if (palette === 'cool') body.classList.add('theme-cool');
    else if (palette === 'morning') body.classList.add('theme-morning');
    else body.classList.add('theme-gold');
  };

  // Load user once on startup
  useEffect(() => {
    async function func () {
      try {
        let localUser = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = localStorage.getItem('user');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed) {
                const isChild = parsed?.role === 'child' || (parsed?.code && !parsed?.role);
                const normalized = isChild ? { ...parsed, role: 'child', type: 'child' } : parsed;
                localUser = User.from(normalized);
                setUserState(localUser);
                applyTheme(localUser);
              }
            } catch (e) {}
          }
        }

        // Only fetch from backend if no local user exists
        if (localUser) return;
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
    const mode = newUser?.themeMode || (newUser?.theme === 'dark' ? 'dark' : newUser?.theme) || 'light';
    const palette = newUser?.palette || 'gold';
    const isChild = newUser?.role === 'child' || (newUser?.code && !newUser?.role);
    const normalized = isChild ? { ...newUser, role: 'child', type: 'child' } : newUser;
    const instance = normalized ? User.from({ ...normalized, themeMode: mode, theme: mode, palette }) : null;
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
          applyTheme(instance);
        } else {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('user');
        }
        try { logout(); } catch (e) { /* ignore logout errors */ }
          applyTheme({});
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
