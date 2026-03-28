// Hey guys, I’m adding authReady so the app waits until authentication is fully checked before deciding which homepage or redirect to show.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from './models';
import { logout, userGet } from './lib/api/authentication';


const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [authReady, setAuthReady] = useState(false); // tracks if we've attempted to load user (successfully or not)

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

  const setUser = useCallback((newUser) => {
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
  }, []);  

  // Load user once on startup — reads localStorage first, falls back to userGet()
  useEffect(() => {
    async function func() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = localStorage.getItem('user');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed) {
                setUser(parsed);
                return;
              }
            } catch (e) {}
          }
        }

        const fetched = await userGet();
        if (fetched) {
          let payload = null;
          if (fetched.user) payload = fetched.user;
          else if (fetched.data) payload = fetched.data.user ?? fetched.data;
          else if (fetched.json_data) payload = fetched.json_data.user ?? fetched.json_data;
          else payload = fetched;

          if (payload && typeof payload === 'object') {
            setUser(payload);
          }
        }
      } catch (err) {
        console.error('Failed to load user', err);
      } finally { // we attempted to load user, whether successfully or not, so we can render the app now
        setAuthReady(true);
      }
    }
    func();
  }, [setUser]);

  return (
    <UserContext.Provider value={{ user, setUser, authReady }}> {/* expose authReady so we can conditionally render the app only after we've attempted to load user */}
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}