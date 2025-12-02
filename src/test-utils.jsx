import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { UserProvider } from './UserContext.jsx';
import App from './App.jsx';

// Simple helper so each test doesn't repeat the provider + router setup.
export function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UserProvider>
        <App />
      </UserProvider>
    </MemoryRouter>
  );
}

// Helper to seed children for child login tests.
export function seedChildren(childrenArray) {
  localStorage.setItem('ns.children.v1', JSON.stringify(childrenArray));
}

export function clearStorage() {
  localStorage.clear();
}

export function seedUser(userObj) {
  localStorage.setItem('ns.currentUser.v1', JSON.stringify(userObj));
}