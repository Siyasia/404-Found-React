// These tests cover: parent dashboard flows (adding a child, assigning a
// simple task, toggling task status) ensuring localStorage + UI state sync.

import { screen, fireEvent } from '@testing-library/react';
import { renderApp, seedUser, seedChildren, clearStorage } from '../../src/test-utils.jsx';

beforeEach(() => {
  clearStorage();
});

function makeParentUser() {
  return {
    id: 'parent-1',
    role: 'parent',
    name: 'ParentOne',
    email: 'p@example.com',
    password: 'secret',
    age: 40,
    createdAt: new Date().toISOString(),
  };
}

test('Add child: shows name somewhere on page', () => {
  seedUser(makeParentUser());
  renderApp('/parent');
  fireEvent.change(screen.getByPlaceholderText(/Example: Paxton/i), { target: { value: 'Paxton' } });
  fireEvent.change(screen.getByPlaceholderText(/Example: 10/i), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /Add child/i }));
  // Child name appears both in list and select option – just confirm at least one
  const matches = screen.getAllByText(/Paxton/);
  expect(matches.length).toBeGreaterThan(0);
});

test('Assign simple task: appears under Assigned Tasks & Habits', () => {
  seedUser(makeParentUser());
  renderApp('/parent');
  fireEvent.change(screen.getByPlaceholderText(/Example: Paxton/i), { target: { value: 'Ava' } });
  fireEvent.change(screen.getByPlaceholderText(/Example: 10/i), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: /Add child/i }));
  const selects = screen.getAllByRole('combobox'); // assign to, type, frequency
  fireEvent.change(selects[1], { target: { value: 'simple' } });
  fireEvent.change(screen.getByLabelText(/Task name/i), { target: { value: 'Practice Reading' } });
  fireEvent.click(screen.getByRole('button', { name: /Assign/i }));
  expect(screen.getAllByText(/Practice Reading/i).length).toBeGreaterThan(0);
});

test('Toggle task status: button text changes', () => {
  const parent = makeParentUser();
  seedUser(parent);
  seedChildren([{ id: 'child-1', name: 'Leo', age: 11, code: '222222', createdAt: new Date().toISOString() }]);
  const tasks = [{
    id: 'task-1', assigneeId: 'child-1', assigneeName: 'Leo', title: 'Reading Practice', notes: 'Read 5 pages',
    status: 'pending', needsApproval: false, childCode: '222222', targetType: 'child', targetName: null,
    createdAt: new Date().toISOString(), createdById: parent.id, createdByName: parent.name, createdByRole: 'parent'
  }];
  localStorage.setItem('ns.childTasks.v1', JSON.stringify(tasks));
  renderApp('/parent');
  fireEvent.click(screen.getAllByRole('button', { name: /Mark done/i })[0]);
  expect(screen.getAllByRole('button', { name: /Mark not done/i }).length).toBeGreaterThan(0);
});
