// These tests cover: baseline App rendering navigation links when no user
// is logged in (layout/context safety and presence of public nav items).

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { UserProvider } from '../src/UserContext.jsx';

// Provide minimal context so Layout can destructure user/setUser safely.
it('renders navigation links without a logged in user', () => {
  render(
    <BrowserRouter>
      <UserProvider>
        <App />
      </UserProvider>
    </BrowserRouter>
  );
  // Header navigation items should exist even when no user is logged in
  expect(screen.getByText(/Home/i)).toBeInTheDocument();
  expect(screen.getByText(/Features/i)).toBeInTheDocument();
  expect(screen.getByText(/About/i)).toBeInTheDocument();
});
