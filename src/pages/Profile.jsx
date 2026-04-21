import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { useAppTheme } from '../styles/AppThemeContext.jsx';
import { ROLE } from '../Roles/roles.js';
import {
  friendsList,
  friendsAdd,
  friendsRemove,
  friendsAccept,
  friendsDecline,
  friendsProfileGet,
} from '../lib/api/friends.js';
import { useGameProfile } from '../components/useGameProfile';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';
import { GameProfile } from '../models';
import { userUpdate } from '../lib/api/user.js';
import {
  emitFriendRequestsRefresh,
  useFriendRequests,
} from '../lib/hooks/useFriendRequests.js';
import { getFriendDisplayName } from '../lib/friendsIdentity.js';
import { BADGE_DEFINITIONS, evaluateBadgeIds } from '../lib/api/badges.js';
import { goalList } from '../lib/api/goals.js';
import { actionPlanList } from '../lib/api/actionPlans.js';
import { taskList } from '../lib/api/tasks.js';
import './Profile.css';

function roleLabel(role) {
  if (role === ROLE.PARENT) return 'Parent';
  if (role === ROLE.PROVIDER) return 'Provider';
  if (role === ROLE.CHILD) return 'Child';
  return 'User';
}

function getFriendRowKey(friend) {
  return String(friend || '').trim();
}

function getFriendLookupKey(friend) {
  return String(friend || '').trim();
}

function getFriendModalStats(friendProfile) {
  const stats = friendProfile?.stats || {};
  const meta = friendProfile?.game_profile?.meta || {};

  const tasks =
    Number(stats.tasksCompleted) ||
    Number(meta.tasksCompleted) ||
    0;

  const habits =
    Number(stats.habitsBuilt) ||
    Number(meta.habitsBuilt) ||
    0;

  const streak =
    Number(stats.longestStreak) ||
    Number(meta.longestStreak) ||
    Number(meta.bestStreak) ||
    0;

  return { tasks, habits, streak };
}

function extractGoals(response) {
  if (Array.isArray(response?.goals)) return response.goals;
  if (Array.isArray(response?.data?.goals)) return response.data.goals;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function extractPlans(response) {
  if (Array.isArray(response?.plans)) return response.plans;
  if (Array.isArray(response?.data?.plans)) return response.data.plans;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function extractTasks(response) {
  if (Array.isArray(response?.tasks)) return response.tasks;
  if (Array.isArray(response?.data?.tasks)) return response.data.tasks;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function toId(value) {
  if (value == null) return '';
  return String(value);
}

function planBestStreak(plan) {
  const best = Number(plan?.bestStreak ?? plan?.meta?.bestStreak);
  if (Number.isFinite(best) && best >= 0) return best;

  const current = Number(plan?.currentStreak ?? plan?.streak ?? plan?.meta?.currentStreak);
  if (Number.isFinite(current) && current >= 0) return current;

  return 0;
}

function planCurrentStreak(plan) {
  const current = Number(plan?.currentStreak ?? plan?.streak ?? plan?.meta?.currentStreak);
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

function planTotalCompletions(plan) {
  const directTotal = Number(plan?.totalCompletions ?? plan?.meta?.totalCompletions);
  if (Number.isFinite(directTotal) && directTotal >= 0) return directTotal;

  const completedDates = plan?.completedDates;
  if (completedDates && typeof completedDates === 'object' && !Array.isArray(completedDates)) {
    return Object.values(completedDates).filter(Boolean).length;
  }

  const completionLog = plan?.completionLog ?? plan?.meta?.completionLog;
  if (completionLog && typeof completionLog === 'object' && !Array.isArray(completionLog)) {
    return Object.values(completionLog).filter(Boolean).length;
  }

  return 0;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { themeId, setThemeId, allowedThemes, allThemes } = useAppTheme();

  const { profile, loading } = useGameProfile();
  const { items, loading: itemLoading } = useItems();
  const invItems = useInventory(profile, items);

  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendNotice, setFriendNotice] = useState('');
  const [friendProfile, setFriendProfile] = useState(null);
  const [, setLoadingFriend] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingAppTheme, setSavingAppTheme] = useState(false);
  const [friendActionBusy, setFriendActionBusy] = useState('');
  const [realStats, setRealStats] = useState({
    tasksCompleted: 0,
    habitsBuilt: 0,
    habitsBroken: 0,
    longestStreak: 0,
  });
  const [badgeProgressStats, setBadgeProgressStats] = useState({
    current: 0,
    longest: 0,
    totalCompletions: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const themeMode = user?.themeMode || (user?.theme === 'dark' ? 'dark' : 'light');
  const friendInvItems = useInventory(friendProfile?.game_profile, items);

  const usesUsernameIdentity = user?.role === ROLE.CHILD || user?.role === ROLE.USER;
  const showFriends = user?.role !== ROLE.PROVIDER;

  const { requests, refetch } = useFriendRequests(
    30000,
    showFriends && Boolean(user)
  );

  const refreshFriends = useCallback(async () => {
    if (!showFriends || !user || user.role === ROLE.PARENT || user.role === ROLE.PROVIDER) {
      setFriends([]);
      setFriendRequests([]);
      return;
    }

    try {
      const res = await friendsList();

      if (res.status === 200) {
        setFriends(Array.isArray(res.data?.friends) ? res.data.friends : []);
        setFriendRequests(Array.isArray(res.data?.requests) ? res.data.requests : []);
      } else {
        setFriendError(res.data?.error || 'Failed to load friends');
      }
    } catch (error) {
      console.error('Failed to refresh friends', error);
      setFriendError('Failed to load friends');
    }
  }, [showFriends, user]);

  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  useEffect(() => {
    setFriendRequests(Array.isArray(requests) ? requests : []);
  }, [requests]);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      if (!user?.id) {
        if (active) {
          setRealStats({
            tasksCompleted: 0,
            habitsBuilt: 0,
            habitsBroken: 0,
            longestStreak: 0,
          });
          setBadgeProgressStats({
            current: 0,
            longest: 0,
            totalCompletions: 0,
          });
          setStatsLoading(false);
        }
        return;
      }

      setStatsLoading(true);

      try {
        const [goalsResp, plansResp, tasksResp] = await Promise.all([
          goalList(),
          actionPlanList(),
          taskList({ assigneeId: user.id }),
        ]);

        if (!active) return;

        const goals = extractGoals(goalsResp);
        const plans = extractPlans(plansResp);
        const tasks = extractTasks(tasksResp);

        const visibleGoals = goals.filter((goal) => {
          const assignedToUser = toId(goal?.assigneeId) === toId(user.id);
          const createdByUser = toId(goal?.createdById) === toId(user.id);
          const ownedByUser = toId(goal?.userId) === toId(user.id);
          return assignedToUser || createdByUser || ownedByUser;
        });

        const visiblePlans = plans.filter((plan) => {
          const assignedToUser = toId(plan?.assigneeId) === toId(user.id);
          const createdByUser = toId(plan?.createdById) === toId(user.id);
          const ownedByUser = toId(plan?.userId) === toId(user.id);
          return assignedToUser || createdByUser || ownedByUser;
        });

        const tasksCompleted = tasks.filter((task) => {
          const status = String(task?.status || '').toLowerCase();
          return status === 'completed' || status === 'done';
        }).length;

        const habitsBuilt = visibleGoals.filter((goal) => {
          const type = String(goal?.goalType || goal?.type || goal?.taskType || '').toLowerCase();
          return type === 'build';
        }).length;

        const habitsBroken = visibleGoals.filter((goal) => {
          const type = String(goal?.goalType || goal?.type || goal?.taskType || '').toLowerCase();
          return type === 'break';
        }).length;

        const longestStreak = visiblePlans.reduce((max, plan) => {
          return Math.max(max, planBestStreak(plan));
        }, 0);

        const currentStreak = visiblePlans.reduce((max, plan) => {
          return Math.max(max, planCurrentStreak(plan));
        }, 0);

        const totalCompletions = visiblePlans.reduce((sum, plan) => {
          return sum + planTotalCompletions(plan);
        }, 0);

        const inferredCurrentStreak = Math.max(currentStreak, longestStreak);
        const inferredTotalCompletions = Math.max(totalCompletions, longestStreak);

        setRealStats({
          tasksCompleted,
          habitsBuilt,
          habitsBroken,
          longestStreak,
        });

        setBadgeProgressStats({
          current: inferredCurrentStreak,
          longest: longestStreak,
          totalCompletions: inferredTotalCompletions,
        });
      } catch (error) {
        console.error('Failed to load profile stats:', error);
        if (active) {
          setRealStats({
            tasksCompleted: 0,
            habitsBuilt: 0,
            habitsBroken: 0,
            longestStreak: 0,
          });
          setBadgeProgressStats({
            current: 0,
            longest: 0,
            totalCompletions: 0,
          });
        }
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadStats();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const badgeMeta =
    profile?.meta && typeof profile.meta === 'object' && !Array.isArray(profile.meta)
      ? profile.meta
      : {};

  const earnedBadgeIds = useMemo(() => {
    const storedIds = Array.isArray(badgeMeta.earnedBadges)
      ? badgeMeta.earnedBadges
      : Array.isArray(profile?.earnedBadges)
        ? profile.earnedBadges
        : [];
    const progressIds = evaluateBadgeIds(badgeProgressStats);

    return Array.from(new Set([...storedIds, ...progressIds]));
  }, [badgeMeta, profile, badgeProgressStats]);

  const badgeEarnedDates = useMemo(() => {
    if (
      badgeMeta.badgeEarnedDates &&
      typeof badgeMeta.badgeEarnedDates === 'object' &&
      !Array.isArray(badgeMeta.badgeEarnedDates)
    ) {
      return badgeMeta.badgeEarnedDates;
    }

    if (
      profile?.badgeEarnedDates &&
      typeof profile.badgeEarnedDates === 'object' &&
      !Array.isArray(profile.badgeEarnedDates)
    ) {
      return profile.badgeEarnedDates;
    }

    return {};
  }, [badgeMeta, profile]);

  const badgeShelf = useMemo(() => {
    return BADGE_DEFINITIONS.map((badge) => {
      const earned = earnedBadgeIds.includes(badge.id);
      return {
        ...badge,
        earned,
        earnedAt: badgeEarnedDates[badge.id] || null,
      };
    });
  }, [earnedBadgeIds, badgeEarnedDates]);

  const earnedBadgeCount = badgeShelf.filter((badge) => badge.earned).length;
  const friendModalStats = getFriendModalStats(friendProfile);

  if (loading || itemLoading) return <p>Loading...</p>;

  if (!user) {
    return (
      <section className="container">
        <h1 className="app-page-title">Profile</h1>
        <p className="app-helper-text"><a href="/login">You need to log in first</a></p>
      </section>
    );
  }

  const handleModeChange = async (event) => {
    const newMode = event.target.value;
    const previousUser = user;
    const nextUser = { ...user, themeMode: newMode, theme: newMode };

    setFriendError('');
    setFriendNotice('');
    setSavingTheme(true);
    setUser(nextUser);

    try {
      const response = await userUpdate({
        id: user.id,
        theme: newMode,
        themeMode: newMode,
      });

      const ok =
        response &&
        (response.status_code === 200 ||
          response.status === 200 ||
          response.status_code === '200' ||
          response.status === '200');

      if (!ok) {
        throw new Error(response?.error || 'Failed to save appearance mode');
      }

      setFriendNotice(`Appearance updated to ${newMode} mode.`);
    } catch (err) {
      console.error('Failed to save appearance mode', err);
      setUser(previousUser);
      setFriendError('Could not save appearance mode. Your previous setting was restored.');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleAppThemeChange = async (nextThemeId) => {
    if (!nextThemeId || nextThemeId === themeId) return;

    const previousUser = user;
    const previousThemeId = themeId;
    const nextUser = { ...user, appTheme: nextThemeId };

    setFriendError('');
    setFriendNotice('');
    setSavingAppTheme(true);

    setThemeId(nextThemeId);
    setUser(nextUser);

    try {
      const response = await userUpdate({
        id: user.id,
        theme: themeMode,
        themeMode,
        appTheme: nextThemeId,
      });

      const ok =
        response &&
        (response.status_code === 200 ||
          response.status === 200 ||
          response.status_code === '200' ||
          response.status === '200');

      if (!ok) {
        throw new Error(response?.error || 'Failed to save app theme');
      }

      setFriendNotice(`Theme updated to ${allThemes[nextThemeId]?.label || nextThemeId}.`);
    } catch (err) {
      console.error('Failed to save app theme', err);
      setThemeId(previousThemeId);
      setUser(previousUser);
      setFriendError('Could not save theme. Your previous theme was restored.');
    } finally {
      setSavingAppTheme(false);
    }
  };

  const handleAddFriend = async () => {
    setFriendError('');
    setFriendNotice('');

    const value = friendInput.trim();
    if (!value) return;

    if (value === user.username || value === `${user.username}#${user.code || ''}`) {
      setFriendError('You cannot add yourself.');
      return;
    }

    const alreadyAdded = friends.some((friend) => {
      return String(friend).toLowerCase() === value.toLowerCase();
    });

    if (alreadyAdded) {
      setFriendError('That friend is already in your list.');
      return;
    }

    const res = await friendsAdd(value);

    if (res.status !== 200) {
      setFriendError(res.data?.error || 'Failed to add friend');
      return;
    }

    await refreshFriends();
    await refetch();
    emitFriendRequestsRefresh();
    setFriendNotice(`Sent a friend request to ${getFriendDisplayName(value)}.`);
    setFriendInput('');
  };

 const handleViewFriend = async (friend) => {
  const friendLookup = getFriendLookupKey(friend);

  if (!friendLookup) {
    setFriendError('Could not identify that friend.');
    return;
  }

  setFriendError('');
  setFriendNotice('');
  setLoadingFriend(true);

  try {
    const response = await friendsProfileGet(friendLookup);

    if (response.status !== 200) {
      setFriendError(response.data?.error || 'Could not load friend profile');
      return;
    }

    const u = response.data?.user;
    if (!u) {
      setFriendError('Friend profile data was missing.');
      return;
    }

    setFriendProfile({
      ...u,
      game_profile: GameProfile.from(u.game_profile),
    });
  } catch (error) {
    console.error(error);
    setFriendError('Could not load friend profile');
  } finally {
    setLoadingFriend(false);
  }
};
  const handleRemoveFriend = async (friend) => {
    const lookup = getFriendLookupKey(friend);

    if (!lookup) {
      setFriendError('Could not identify that friend.');
      return;
    }

    setFriendActionBusy(lookup);
    setFriendError('');
    setFriendNotice('');

    try {
      const res = await friendsRemove(lookup);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to remove friend');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(`Removed ${getFriendDisplayName(lookup)} from your friends list.`);
    } finally {
      setFriendActionBusy('');
    }
  };

  const handleAcceptRequest = async (requester) => {
    setFriendActionBusy(requester);
    setFriendError('');
    setFriendNotice('');

    try {
      const res = await friendsAccept(requester);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to accept friend request');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(res.data?.message || 'Friend request accepted.');
    } finally {
      setFriendActionBusy('');
    }
  };

  const handleDeclineRequest = async (requester) => {
    setFriendActionBusy(requester);
    setFriendError('');
    setFriendNotice('');

    try {
      const res = await friendsDecline(requester);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to decline friend request');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(res.data?.message || 'Friend request declined.');
    } finally {
      setFriendActionBusy('');
    }
  };

  return (
    <section className="profile-page">
      <div className="profile-canvas">
        <header className="profile-header profile-panel">
          <div className="profile-hero">
            <div>
              <div className="profile-kicker">Next Steps account</div>
              <h1>Profile</h1>
              <p>
                View your identity, progress, earned badges, friends, and appearance settings in one place.
              </p>
            </div>

            <button
              className="profile-hero__avatarButton"
              type="button"
              onClick={() => navigate('/shop')}
            >
              Customize avatar
            </button>
          </div>
        </header>

        <div className="profile-top-grid">
          <div className="profile-panel profile-info-card">
            <h2 className="profile-panel__title">Account</h2>

            <div className="profile-info-row">
              <span className="profile-info-row__label">Name</span>
              <span className="profile-info-row__value">{user.name || '—'}</span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-row__label">
                {usesUsernameIdentity ? 'Username' : 'Email'}
              </span>
              <span className="profile-info-row__value">
                {usesUsernameIdentity
                  ? `${user.username || ''}${user.code ? `#${user.code}` : ''}`
                  : user.email || '—'}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-row__label">Role</span>
              <span className="profile-role-pill">{roleLabel(user.role)}</span>
            </div>
          </div>

          <div className="profile-panel">
            <h2 className="profile-panel__title">Progress snapshot</h2>

            <div className="profile-stats-grid">
              <div className="profile-stat-tile">
                <span className="profile-stat-tile__label">Tasks completed</span>
                <span className="profile-stat-tile__value">
                  {statsLoading ? '…' : realStats.tasksCompleted}
                </span>
              </div>

              <div className="profile-stat-tile">
                <span className="profile-stat-tile__label">Build habits</span>
                <span className="profile-stat-tile__value">
                  {statsLoading ? '…' : realStats.habitsBuilt}
                </span>
              </div>

              <div className="profile-stat-tile">
                <span className="profile-stat-tile__label">Break habits</span>
                <span className="profile-stat-tile__value">
                  {statsLoading ? '…' : realStats.habitsBroken}
                </span>
              </div>

              <div className="profile-stat-tile">
                <span className="profile-stat-tile__label">Longest streak</span>
                <span className="profile-stat-tile__value">
                  {statsLoading ? '…' : realStats.longestStreak}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-panel profile-avatar-card">
            <div
              className="profile-avatar-card__inner"
              role="button"
              tabIndex={0}
              onClick={() => navigate('/shop')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate('/shop');
              }}
            >
              <DisplayAvatar invItems={invItems} />
            </div>

            <div className="profile-avatar-card__name">{user.name || 'Your avatar'}</div>
            <div className="profile-avatar-card__sub">Tap to customize</div>
          </div>
        </div>

        <div className="profile-lower-grid">
          <div className="profile-lower-main">
            <div className="profile-panel profile-badge-panel">
              <div className="profile-badge-header">
                <div>
                  <h2 className="profile-panel__title">Badge shelf</h2>
                  <p className="profile-badge-subtitle">
                    Progress badges earned across habits, streaks, and consistency.
                  </p>
                </div>

                <div className="profile-badge-summary">
                  <span className="profile-badge-summary__count">{earnedBadgeCount}</span>
                  <span className="profile-badge-summary__label">Earned</span>
                </div>
              </div>

              {badgeShelf.length === 0 ? (
                <div className="profile-badges-empty">
                  Your badges will appear here as you complete plans and hit streak milestones.
                </div>
              ) : (
                <div className="profile-badge-grid">
                  {badgeShelf.map((badge) => (
                    <article
                      key={badge.id}
                      className={`profile-badge-card ${badge.earned ? 'is-earned' : 'is-locked'}`}
                    >
                      <div className="profile-badge-card__icon">{badge.icon || '🏅'}</div>

                      <div className="profile-badge-card__content">
                        <div className="profile-badge-card__top">
                          <h3 className="profile-badge-card__label">{badge.label}</h3>
                          <span
                            className={`profile-badge-card__status ${
                              badge.earned ? 'is-earned' : 'is-locked'
                            }`}
                          >
                            {badge.earned ? 'Earned' : 'Locked'}
                          </span>
                        </div>

                        <p className="profile-badge-card__description">
                          {badge.description || 'Complete milestones to unlock this badge.'}
                        </p>

                        <div className="profile-badge-card__meta">
                          <span
                            className={`profile-badge-card__coins ${
                              badge.coins ? '' : 'is-empty'
                            }`}
                          >
                            {badge.coins ? `+${badge.coins} coins` : 'No coin bonus'}
                          </span>

                          {badge.earnedAt ? (
                            <span className="profile-badge-card__date">
                              Earned {badge.earnedAt}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {showFriends && (
              <div className="profile-panel">
                <h2 className="profile-panel__title">
                  Friends
                  {friendRequests.length > 0 ? (
                    <span className="profile-count-badge">{friendRequests.length}</span>
                  ) : null}
                </h2>

                {friendError ? <p className="profile-friends-error">{friendError}</p> : null}
                {friendNotice ? <p className="profile-friends-note">{friendNotice}</p> : null}

                <div className="profile-friends-add">
                  <input
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    placeholder="Add a friend (username or child username#code)"
                  />
                  <button
                    type="button"
                    className="profile-friends-add-btn"
                    onClick={handleAddFriend}
                  >
                    Add
                  </button>
                </div>

                <div className="profile-friends-block">
                  <h3 className="profile-subtitle">Pending Friend Requests</h3>

                  {friendRequests.length === 0 ? (
                    <p className="profile-friends-empty">No pending requests.</p>
                  ) : (
                    <ul className="profile-friends-list">
                      {friendRequests.map((requester) => (
                        <li key={requester} className="profile-friend-row">
                          <span className="profile-friend-name">
                            {getFriendDisplayName(requester)}
                          </span>

                          <div className="profile-friend-actions">
                            <button
                              type="button"
                              className="profile-friend-accept-btn"
                              disabled={friendActionBusy === requester}
                              onClick={() => handleAcceptRequest(requester)}
                            >
                              Accept
                            </button>

                            <button
                              type="button"
                              className="profile-friend-decline-btn"
                              disabled={friendActionBusy === requester}
                              onClick={() => handleDeclineRequest(requester)}
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="profile-friends-block">
                  <h3 className="profile-subtitle">Friend List</h3>

                  {friends.length === 0 ? (
                    <p className="profile-friends-empty">No friends yet.</p>
                  ) : (
                    <ul className="profile-friends-list">
                      {friends.map((friend) => {
                        const rowKey = getFriendRowKey(friend);
                        const lookup = getFriendLookupKey(friend);

                        return (
                          <li key={rowKey} className="profile-friend-row">
                            <span
                              className="profile-friend-name"
                              onClick={() => handleViewFriend(lookup)}
                            >
                              {getFriendDisplayName(lookup)}
                            </span>

                            <button
                              type="button"
                              className="profile-friend-remove-btn"
                              disabled={friendActionBusy === lookup}
                              onClick={() => handleRemoveFriend(lookup)}
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="profile-lower-side">
            <div className="profile-panel">
              <h2 className="profile-panel__title">Appearance mode</h2>

              <div className="profile-setting-group">
                <label className="profile-radio">
                  <input
                    type="radio"
                    name="themeMode"
                    value="light"
                    checked={themeMode !== 'dark'}
                    onChange={handleModeChange}
                    disabled={savingTheme}
                  />
                  <span>Light</span>
                </label>

                <label className="profile-radio">
                  <input
                    type="radio"
                    name="themeMode"
                    value="dark"
                    checked={themeMode === 'dark'}
                    onChange={handleModeChange}
                    disabled={savingTheme}
                  />
                  <span>Dark</span>
                </label>
              </div>
            </div>

            <div className="profile-panel">
              <h2 className="profile-panel__title">App theme</h2>

              <div className="profile-theme-grid">
                {(allowedThemes || []).map((allowedThemeId) => {
                  const theme = allThemes?.[allowedThemeId];
                  if (!theme) return null;

                  return (
                    <button
                      key={allowedThemeId}
                      type="button"
                      className={`profile-theme-card ${
                        themeId === allowedThemeId ? 'is-active' : ''
                      }`}
                      onClick={() => handleAppThemeChange(allowedThemeId)}
                      disabled={savingAppTheme}
                    >
                      <span className="profile-theme-card__label">
                        {theme.label || allowedThemeId}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {friendProfile && items && (
          <div
            className="profile-modal-backdrop"
            onClick={() => setFriendProfile(null)}
          >
            <div
              className="profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="profile-modal__title">
                {friendProfile.username}
                {friendProfile.code ? `#${friendProfile.code}` : ''}
              </h2>

              <div className="profile-modal__avatar">
                <DisplayAvatar invItems={friendInvItems} />
              </div>

              <div className="profile-modal__stats">
                <div className="profile-modal__stat">
                  <div className="profile-modal__stat-label">Tasks</div>
                  <div className="profile-modal__stat-value">{friendModalStats.tasks}</div>
                </div>

                <div className="profile-modal__stat">
                  <div className="profile-modal__stat-label">Habits</div>
                  <div className="profile-modal__stat-value">{friendModalStats.habits}</div>
                </div>

                <div className="profile-modal__stat">
                  <div className="profile-modal__stat-label">Streak</div>
                  <div className="profile-modal__stat-value">{friendModalStats.streak}</div>
                </div>
              </div>

              <button
                type="button"
                className="profile-modal__close"
                onClick={() => setFriendProfile(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
