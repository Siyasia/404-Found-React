import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { childCreate, childDelete, childUpdate } from '../../lib/api/children.js';
import { Child } from '../../models/index.js';
import { DisplayAvatar } from '../../components/DisplayAvatar.jsx';
import './ParentDashboardTabs.css';

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value);
}

function getInitials(name) {
  if (!name) return '?';

  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function isTaskComplete(task) {
  const status = String(task?.status || '').toLowerCase();
  return status === 'completed' || status === 'done';
}

function StatMiniCard({ label, value }) {
  return (
    <div className="children-mini-card">
      <div className="children-mini-card__label app-meta-label">{label}</div>
      <div className="children-mini-card__value app-section-title">{value}</div>
    </div>
  );
}

function ChildAvatarVisual({ child, isOpen = false, size = 180 }) {
  const avatarUrl = child?.avatarUrl || child?.avatarImage || child?.photoUrl || '';
  const avatarItems =
    child?.avatarItems ||
    child?.inventoryItems ||
    child?.invItems ||
    child?.profile?.avatarItems ||
    child?.profile?.inventoryItems ||
    null;

  if (Array.isArray(avatarItems) && avatarItems.length > 0) {
    return (
      <div
        className="children-avatar-visual children-avatar-visual--display"
        style={{ '--avatar-size': `${size}px` }}
      >
        <div
          className="children-avatar-visual__display-inner"
          style={{ transform: size >= 170 ? 'scale(0.95)' : 'scale(0.8)' }}
        >
          <DisplayAvatar invItems={avatarItems} />
        </div>
      </div>
    );
  }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${child?.name || 'Child'} avatar`}
        className="children-avatar-visual children-avatar-visual--image"
        style={{ '--avatar-size': `${size}px` }}
      />
    );
  }

  return (
    <div
      className={`children-avatar-visual children-avatar-visual--initials ${isOpen ? 'is-open' : ''}`}
      style={{
        '--avatar-size': `${Math.min(size, 120)}px`,
        fontSize: size >= 170 ? 42 : 34,
      }}
    >
      {getInitials(child?.name)}
    </div>
  );
}

export default function ChildrenTab({ data, onRefresh, user, showSuccess }) {
  const navigate = useNavigate();
  const { children = [], goals = [], actionPlans = [], tasks = [] } = data || {};

  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [childError, setChildError] = useState('');

  const [openPanel, setOpenPanel] = useState('');
  const [childPasswordDrafts, setChildPasswordDrafts] = useState({});
  const [childPasswordSavingId, setChildPasswordSavingId] = useState(null);
  const [savingNewChild, setSavingNewChild] = useState(false);

  const childSummaries = useMemo(() => {
    return children.map((child) => {
      const childId = normalizeId(child.id);

      const childGoals = goals.filter((goal) => normalizeId(goal.assigneeId) === childId);
      const childPlans = actionPlans.filter((plan) => normalizeId(plan.assigneeId) === childId);
      const childTasks = tasks.filter(
        (task) => normalizeId(task.assigneeId || task.childId) === childId
      );

      const pendingTasks = childTasks.filter((task) => !isTaskComplete(task));

      return {
        child,
        childId,
        goals: childGoals,
        plans: childPlans,
        tasks: childTasks,
        pendingTasks,
        stats: {
          goals: childGoals.length,
          plans: childPlans.length,
          tasks: childTasks.length,
          pendingTasks: pendingTasks.length,
        },
      };
    });
  }, [children, goals, actionPlans, tasks]);

  const selectedSummary = useMemo(() => {
    if (!openPanel || openPanel === 'add') return null;

    return (
      childSummaries.find((entry) => normalizeId(entry.childId) === normalizeId(openPanel)) || null
    );
  }, [childSummaries, openPanel]);

  const selectedChild = selectedSummary?.child || null;
  const selectedStats = selectedSummary?.stats || {
    goals: 0,
    plans: 0,
    tasks: 0,
    pendingTasks: 0,
  };

  const generateChildCode = (existing) => {
    const existingCodes = new Set((existing || []).map((entry) => entry?.code).filter(Boolean));

    let code = '';
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (existingCodes.has(code));

    return code;
  };

  const resetAddForm = () => {
    setChildName('');
    setChildUsername('');
    setChildPassword('');
    setChildAge('');
    setChildError('');
  };

  const handleOpenAdd = () => {
    setChildError('');
    setOpenPanel((current) => (current === 'add' ? '' : 'add'));
  };

  const handleSelectChild = (childId) => {
    setChildError('');
    setOpenPanel((current) => (normalizeId(current) === normalizeId(childId) ? '' : childId));
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    setChildError('');

    const name = childName.trim();
    const username = childUsername.trim();
    const password = childPassword.trim();
    const ageNumber = Number(childAge);

    if (!name || !username || !password || !childAge) {
      setChildError('Please enter name, username, password, and age.');
      return;
    }

    if (!Number.isFinite(ageNumber) || ageNumber <= 0) {
      setChildError('Please enter a valid age.');
      return;
    }

    try {
      setSavingNewChild(true);

      const newChild = Child.from({
        parentId: user?.id,
        name,
        username,
        password,
        age: ageNumber,
        code: generateChildCode(children),
      });

      const result = await childCreate(newChild, password);

      if (result?.status_code === 200) {
        const createdName = name;
        resetAddForm();
        await onRefresh?.();
        setOpenPanel('');
        showSuccess?.(`Child ${createdName} created successfully.`);
      } else {
        setChildError(result?.error || 'Failed to add child.');
      }
    } catch (err) {
      console.error(err);
      setChildError('Failed to add child.');
    } finally {
      setSavingNewChild(false);
    }
  };

  const handleChangeChildPassword = async (child) => {
    const nextPassword = String(childPasswordDrafts[child.id] || '').trim();

    if (!nextPassword) {
      setChildError(`Please enter a new password for ${child.name}.`);
      return;
    }

    setChildPasswordSavingId(child.id);
    setChildError('');

    try {
      const result = await childUpdate({ id: child.id, password: nextPassword });

      if (result?.status_code === 200) {
        setChildPasswordDrafts((prev) => ({ ...prev, [child.id]: '' }));
        showSuccess?.(`Password updated for ${child.name}.`);
      } else {
        setChildError(result?.error || 'Failed to update password.');
      }
    } catch (err) {
      console.error(err);
      setChildError('Failed to update password.');
    } finally {
      setChildPasswordSavingId(null);
    }
  };

  const handleRemoveChild = async (childId) => {
    const confirmed = window.confirm(
      'Remove this child? This can leave old goals and tasks behind unless your backend also cleans them up.'
    );

    if (!confirmed) return;

    try {
      await childDelete(childId);
      await onRefresh?.();
      setOpenPanel('');
      showSuccess?.('Child removed.');
    } catch (err) {
      console.error(err);
      setChildError('Failed to remove child.');
    }
  };

  return (
    <div className="parent-tab-shell">
      <section className="parent-tab-card">
        <div className="parent-tab-header">
          <div>
            <h2 className="parent-tab-title app-page-title">Children</h2>
            <p className="parent-tab-subtitle app-helper-text">
              Start with a child snapshot. Click one to open their management panel.
            </p>
          </div>

          <div className="parent-tab-count app-micro-text">
            {children.length} child{children.length === 1 ? '' : 'ren'}
          </div>
        </div>

        {children.length === 0 ? (
          <div className="children-empty-state">
            <div className="children-empty-state__title app-card-title">No child accounts yet</div>
            <div className="children-empty-state__text app-helper-text">
              Add your first child to start assigning goals, plans, and simple tasks.
            </div>
            <div>
              <button
                type="button"
                className="children-action-btn children-action-btn--primary app-button-label"
                onClick={handleOpenAdd}
              >
                Add child
              </button>
            </div>
          </div>
        ) : (
          <div className="children-grid">
            {childSummaries.map((entry) => {
              const isOpen = normalizeId(openPanel) === normalizeId(entry.childId);

              return (
                <button
                  key={entry.child.id}
                  type="button"
                  onClick={() => handleSelectChild(entry.childId)}
                  className={`children-avatar-tile ${isOpen ? 'is-active' : ''}`}
                >
                  <div className="children-avatar-stage">
                    <ChildAvatarVisual child={entry.child} isOpen={isOpen} size={180} />
                  </div>

                  <div className="children-avatar-name app-card-title">{entry.child.name}</div>
                  <div className="children-avatar-role app-micro-text">Child account</div>

                  <div className="children-stat-list">
                    <div className="children-stat-pill app-micro-text">
                      <strong>Code:</strong> {entry.child.code || '—'}
                    </div>
                    <div className="children-stat-pill app-micro-text">
                      <strong>{entry.stats.goals}</strong> goal{entry.stats.goals === 1 ? '' : 's'}
                    </div>
                    <div className="children-stat-pill app-micro-text">
                      <strong>{entry.stats.plans}</strong> plan
                      {entry.stats.plans === 1 ? '' : 's'} • <strong>{entry.stats.tasks}</strong>{' '}
                      task{entry.stats.tasks === 1 ? '' : 's'}
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleOpenAdd}
              className={`children-add-tile ${openPanel === 'add' ? 'is-active' : ''}`}
            >
              <div className="children-avatar-stage">
                <div className="children-add-circle">+</div>
              </div>

              <div className="children-avatar-name app-card-title">Add child</div>
              <div className="children-avatar-role app-helper-text">
                Create a new child account for goals, habits, and simple tasks
              </div>

              <div className="children-stat-list">
                <div className="children-stat-pill app-micro-text" style={{ color: 'var(--app-link)', fontWeight: 700 }}>
                  New child profile
                </div>
                <div className="children-stat-pill app-micro-text">Username, password, age</div>
              </div>
            </button>
          </div>
        )}
      </section>

      {openPanel === 'add' && (
        <section className="parent-tab-card">
          <div className="parent-tab-header">
            <div>
              <h3 className="parent-tab-title app-section-title">
                Add child account
              </h3>
              <p className="parent-tab-subtitle app-helper-text">
                Create a child profile so you can assign goals, habits, and simple tasks.
              </p>
            </div>

            <button type="button" className="parent-tab-close app-button-label" onClick={() => setOpenPanel('')}>
              Close
            </button>
          </div>

          <div className="children-panel">
            <div className="parent-tab-pill-row">
              <span className="parent-tab-pill parent-tab-pill--accent app-micro-text">Username + password setup</span>
              <span className="parent-tab-pill app-micro-text">Child code is generated automatically</span>
            </div>

            <form onSubmit={handleAddChild} className="children-form-grid">
              <label className="children-field">
                <span className="children-label app-field-label">Name</span>
                <input
                  className="children-input"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Mia"
                />
              </label>

              <label className="children-field">
                <span className="children-label app-field-label">Age</span>
                <input
                  className="children-input"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  placeholder="9"
                  inputMode="numeric"
                />
              </label>

              <label className="children-field">
                <span className="children-label app-field-label">Username</span>
                <input
                  className="children-input"
                  value={childUsername}
                  onChange={(e) => setChildUsername(e.target.value)}
                  placeholder="mia123"
                />
              </label>

              <label className="children-field">
                <span className="children-label app-field-label">Password</span>
                <input
                  className="children-input"
                  type="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  placeholder="Create password"
                />
              </label>

              <div className="children-note-row">
                <div style={{ minHeight: 20 }}>
                  {childError ? (
                    <div className="children-status-message children-status-message--error app-helper-text">
                      {childError}
                    </div>
                  ) : (
                    <div className="children-muted-note app-helper-text">
                      This child will appear in your children list after creation.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="children-action-btn children-action-btn--primary app-button-label"
                  disabled={savingNewChild}
                >
                  {savingNewChild ? 'Adding…' : 'Add child'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {selectedChild && (
        <section className="parent-tab-card">
          <div className="parent-tab-header">
            <div>
              <h3 className="parent-tab-title app-section-title">
                {selectedChild.name}
              </h3>
              <p className="parent-tab-subtitle app-helper-text">
                Manage this child’s account, goals, and task activity.
              </p>
            </div>

            <button type="button" className="parent-tab-close app-button-label" onClick={() => setOpenPanel('')}>
              Close
            </button>
          </div>

          <div className="children-panel">
            <div className="children-summary-hero">
              <div className="children-summary-hero__frame">
                <ChildAvatarVisual child={selectedChild} isOpen size={96} />
              </div>

              <div>
                <div className="children-summary-hero__name app-section-title">{selectedChild.name}</div>
                <div className="children-summary-hero__meta app-helper-text">
                  {selectedChild.username || 'No username'} • Code: {selectedChild.code || '—'} •
                  Age {selectedChild.age || '—'}
                </div>

                <div className="children-summary-hero__badges">
                  <span className="parent-tab-pill parent-tab-pill--accent app-micro-text">Child account</span>
                  <span className="parent-tab-pill app-micro-text">Parent-managed profile</span>
                </div>
              </div>
            </div>

            <div className="children-stats-grid">
              <StatMiniCard label="Goals" value={selectedStats.goals} />
              <StatMiniCard label="Action plans" value={selectedStats.plans} />
              <StatMiniCard label="Simple tasks" value={selectedStats.tasks} />
              <StatMiniCard label="Pending tasks" value={selectedStats.pendingTasks} />
            </div>

            <div className="children-summary-grid">
              <div className="children-summary-card">
                <div className="children-section-label app-meta-label">Quick summary</div>

                <div className="children-summary-rows">
                  <div className="children-summary-row">
                    <span>Assigned goals</span>
                    <strong>{selectedStats.goals}</strong>
                  </div>

                  <div className="children-summary-row">
                    <span>Action plans</span>
                    <strong>{selectedStats.plans}</strong>
                  </div>

                  <div className="children-summary-row">
                    <span>Simple tasks</span>
                    <strong>{selectedStats.tasks}</strong>
                  </div>

                  <div className="children-summary-row">
                    <span>Still pending</span>
                    <strong>{selectedStats.pendingTasks}</strong>
                  </div>
                </div>
              </div>

              <div className="children-summary-card">
                <div className="children-section-label app-meta-label">Quick actions</div>

                <div className="children-actions-stack">
                  <button
                    type="button"
                    className="children-action-btn children-action-btn--primary app-button-label"
                    onClick={() => navigate('/parent/habit-wizard')}
                  >
                    Open habit wizard
                  </button>

                  <button
                    type="button"
                    className="children-action-btn children-action-btn--ghost app-button-label"
                    onClick={() => navigate('/parent/dashboard?tab=goals')}
                  >
                    View goals
                  </button>
                </div>
              </div>
            </div>

            <div className="children-account-actions">
              <div className="children-section-label app-meta-label">Account actions</div>

              <div className="children-account-actions__panel">
                <div className="children-account-actions__row">
                  <label className="children-field">
                    <span className="children-label app-field-label">New password</span>
                    <input
                      className="children-input"
                      type="password"
                      value={childPasswordDrafts[selectedChild.id] || ''}
                      onChange={(e) =>
                        setChildPasswordDrafts((prev) => ({
                          ...prev,
                          [selectedChild.id]: e.target.value,
                        }))
                      }
                      placeholder={`New password for ${selectedChild.name}`}
                    />
                  </label>

                  <button
                    type="button"
                    className="children-action-btn children-action-btn--ghost children-password-btn app-button-label"
                    onClick={() => handleChangeChildPassword(selectedChild)}
                    disabled={childPasswordSavingId === selectedChild.id}
                  >
                    {childPasswordSavingId === selectedChild.id ? 'Saving…' : 'Update password'}
                  </button>

                  <button
                    type="button"
                    className="children-action-btn children-action-btn--danger children-remove-btn app-button-label"
                    onClick={() => handleRemoveChild(selectedChild.id)}
                  >
                    Remove child
                  </button>
                </div>

                {childError ? (
                  <div className="children-status-message children-status-message--error app-helper-text">
                    {childError}
                  </div>
                ) : (
                  <div className="children-muted-note app-helper-text">
                    Update this child’s password or remove the account from your family dashboard.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
