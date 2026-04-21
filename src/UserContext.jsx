import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from './models';
import { logout, userGet } from './lib/api/authentication';

const UserContext = createContext(null);

let externalSetUser = null;

function applyThemeMode() {
  if (typeof document === 'undefined') return;

  const body = document.body;
  body.classList.remove('mode-light', 'mode-dark');
}

export function nullifyLogin() {
  if (typeof externalSetUser === 'function') {
    externalSetUser(null);
  } else {
    console.warn('UserProvider not mounted; cannot set user');
  }

  if (typeof window === 'undefined') return;

  if (window.localStorage) {
    try {
      window.localStorage.removeItem('user');
    } catch {
      // ignore
    }
  }

  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const setUser = useCallback((newUser) => {
    const mode =
      newUser?.themeMode ||
      (newUser?.theme === 'dark' ? 'dark' : 'light');

    const isChild = newUser?.role === 'child' || (newUser?.code && !newUser?.role);
    const normalized = isChild ? { ...newUser, role: 'child', type: 'child' } : newUser;

    const instance = normalized
      ? User.from({ ...normalized, themeMode: mode, theme: mode })
      : null;

    setUserState(instance);

    try {
      if (instance) {
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('user', JSON.stringify(instance.toJSON()));
          } catch (e) {
            console.warn('Failed to persist user to localStorage', e);
          }
        }
        applyThemeMode(instance);
      } else {
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem('user');
          } catch {
            // ignore
          }
        }
        try {
          logout();
        } catch {
          // ignore logout errors
        }
        applyThemeMode({ themeMode: 'light' });
      }
    } catch (err) {
      console.error('Failed to set user', err);
    }
  }, []);

  useEffect(() => {
    externalSetUser = setUser;
    return () => {
      if (externalSetUser === setUser) {
        externalSetUser = null;
      }
    };
  }, [setUser]);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem('user');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && mounted) {
                setUser(parsed);
                setAuthReady(true);
                return;
              }
            } catch {
              // ignore bad local user payload
            }
          }
        }

        const fetched = await userGet();

        if (!mounted) return;

        if (fetched == null) {
          setUser(null);
          return;
        }

        let payload = null;
        if (fetched.user) payload = fetched.user;
        else if (fetched.data) payload = fetched.data.user ?? fetched.data;
        else if (fetched.json_data) payload = fetched.json_data.user ?? fetched.json_data;
        else payload = fetched;

        if (payload && typeof payload === 'object') {
          setUser(payload);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to load user', err);
      } finally {
        if (mounted) setAuthReady(true);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [setUser]);

  return (
    <UserContext.Provider value={{ user, setUser, authReady }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
