// These tests cover: UI accessibility (login page), parent login, child login,
// independent (user) login, and basic login validation for missing fields or bad child code.

import { screen, fireEvent } from '@testing-library/react';
import { renderApp, seedChildren, clearStorage } from './test-utils.jsx';

beforeEach(() => {
  clearStorage();
});

test('UI Accessibility: login page loads and shows welcome heading', () => {
  renderApp();
  expect(screen.getByRole('heading', { name: /welcome back to next steps/i })).toBeInTheDocument();
  // Basic elements
  expect(screen.getByText(/Continue/i)).toBeInTheDocument();
});

test('Parent Login: selecting parent role and submitting shows parent tools on home', () => {
  renderApp();
  // Select role
  fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'parent' } });
  // Fill required fields
  fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'parent@example.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'secret123' } });
  // Submit
  fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
  // Home renders: look for Parent tools heading
  expect(screen.getByRole('heading', { name: /Parent tools/i })).toBeInTheDocument();
});

test('Child Login: child code flow navigates to home without parent tools', () => {
  // Seed one child in localStorage
  seedChildren([{ id: 'c1', name: 'Paxton', age: 10, code: '123456', createdAt: new Date().toISOString() }]);
  renderApp();
  fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'child' } });
  fireEvent.change(screen.getByLabelText(/Child code/i), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
  // Should land on home page greeting user name but NOT show Parent tools
  expect(screen.getByRole('heading', { name: /Good .* Paxton/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Parent tools/i })).not.toBeInTheDocument();
});

test('Independent Login (user role): shows habit plan tiles', () => {
  renderApp();
  fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'user' } });
  fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
  // Assert unique headings instead of ambiguous link text
  expect(screen.getByRole('heading', { name: /Your habit plans/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Build a habit/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Break a habit/i })).toBeInTheDocument();
});

test('Login Validation: missing fields + invalid child code show errors', () => {
  renderApp();
  // Try parent login without email/password
  fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'parent' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
  expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();

  // Switch to child role with wrong code
  fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'child' } });
  fireEvent.change(screen.getByLabelText(/Child code/i), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
  expect(screen.getByText(/No child account found/i)).toBeInTheDocument();
});
