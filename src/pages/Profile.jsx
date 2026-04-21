import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import { useAppTheme } from '../styles/AppThemeContext.jsx';
import { ROLE } from '../Roles/roles.js';
import React, { useState, useEffect } from 'react';
import {
  friendsList,
  friendsAdd,
  friendsRemove,
  friendsAccept,
  friendsDecline,
  friendsProfileGet
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

function getFriendRowKey(friendObj) {
  if (!friendObj) return '';
  return String(
    friendObj.id ||
      (friendObj.code
        ? `${friendObj.username}#${friendObj.code}`
        : friendObj.username || friendObj.name || '')
  ).trim();
}

function getFriendLookupKey(friendObj) {
  if (!friendObj) return '';
  const username = String(friendObj.username || friendObj.name || '').trim();
  const code = String(friendObj.code || '').trim();

  if (!username) return '';
  return code ? `${username}#${code}` : username;
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
  console.log('themeId from provider:', themeId, 'allowedThemes:', allowedThemes);
  const { profile, loading } = useGameProfile();
  const { items, loading: itemLoading } = useItems();

  const invItems = useInventory(profile, items);

  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendInput, setFriendInput] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendNotice, setFriendNotice] = useState('');
  const [friendProfile, setFriendProfile] = useState(null);
  const [loadingFriend, setLoadingFriend] = useState(false);
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

  const { pendingCount, requests, refetch } = useFriendRequests(
    30000,
    showFriends && Boolean(user)
  );

  //Sprint 5: Comparing parent / provider for friends
  //Updated in Sprint 7:
    useEffect(() => {
    async function load() {
      if (user?.role === ROLE.PARENT || user?.role === ROLE.PROVIDER) return;
      const res = await friendsList();
      if (res.status === 200) {
        setFriends(res.data?.friends || []);
        setFriendRequests(res.data?.requests || []);
      }
    }
    load();
  }, [user?.role, refreshFriends]);

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
      const id = getFriendLookupKey(friend);
      return id.toLowerCase() === value.toLowerCase();
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

  const handleViewFriend = async (friendObj) => {
    const friendLookup = getFriendLookupKey(friendObj);

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

  const handleRemoveFriend = async (friendObj) => {
    const friendId = getFriendLookupKey(friendObj);

    if (!friendId) {
      setFriendError('Could not identify that friend.');
      return;
    }

    setFriendActionBusy(friendId);
    setFriendError('');
    setFriendNotice('');

    try {
      const res = await friendsRemove(friendId);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to remove friend');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(
        `Removed ${friendObj.name || friendObj.username || 'friend'} from your friends list.`
      );
    } finally {
      setFriendActionBusy('');
    }
  };

  const handleAcceptRequest = async (requester) => {
    setFriendError('');
    setFriendNotice('');
    setFriendActionBusy(requester);

    try {
      const res = await friendsAccept(requester);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to accept friend request');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(`Accepted ${getFriendDisplayName(requester)}'s friend request.`);
    } finally {
      setFriendActionBusy('');
    }
  };

  const handleDeclineRequest = async (requester) => {
    setFriendError('');
    setFriendNotice('');
    setFriendActionBusy(requester);

    try {
      const res = await friendsDecline(requester);

      if (res.status !== 200) {
        setFriendError(res.data?.error || 'Failed to decline friend request');
        return;
      }

      await refreshFriends();
      await refetch();
      emitFriendRequestsRefresh();
      setFriendNotice(`Declined ${getFriendDisplayName(requester)}'s friend request.`);
    } finally {
      setFriendActionBusy('');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-canvas">
        <div className="profile-header">
          <h1 className="app-page-title">Profile</h1>
          <p className="app-helper-text">Your account information</p>
        </div>

        <div className="profile-top-grid">
          <div className="profile-panel profile-info-card">
            <div className="profile-panel__title app-panel-title">Account</div>

            <div className="profile-info-row">
              <span className="profile-info-row__label app-field-label">Name</span>
              <span className="profile-info-row__value app-body-text">{user.name}</span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-row__label app-field-label">
                {usesUsernameIdentity ? 'Username' : 'Email'}
              </span>
              <span className="profile-info-row__value app-body-text">
                {usesUsernameIdentity
                  ? `${user.username}${user.code ? `#${user.code}` : ''}`
                  : user.email}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-row__label app-field-label">Role</span>
              <span className="profile-role-pill app-micro-text">{roleLabel(user.role)}</span>
            </div>
          </div>

          {friendError && <p style={{ color: 'crimson' }}>{friendError}</p>}
          {friendNotice && <p style={{ color: 'var(--text-muted, #666)' }}>{friendNotice}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              placeholder="Add a friend (username or child username#code)"
            />
            <button
              className="btn"
              onClick={async () => {
                setFriendError('');
                setFriendNotice('');
                const value = friendInput.trim();
                if (!value) return;
                const res = await friendsAdd(value);
                if (res.status !== 200) {
                  setFriendError(res.data?.error || 'Failed to send friend request');
                  return;
                }
                setFriends(res.data.friends || []);
                setFriendRequests(res.data.requests || []);
                setFriendNotice(res.data?.message || 'Friend request sent.');
                setFriendInput('');
              }}
              aria-label="Open avatar editor"
            >
              <DisplayAvatar invItems={invItems} />
            </div>
            <div className="profile-avatar-card__name app-card-title">{user.name}</div>
            <div className="profile-avatar-card__sub app-helper-text">{roleLabel(user.role)}</div>
          </div>
        </div>

        <div className="profile-panel profile-badge-panel">
          <div className="profile-badge-header">
            <div>
              <div className="profile-panel__title app-panel-title">Badge Shelf</div>
              <p className="profile-badge-subtitle app-helper-text">Your habit and streak achievements live here.</p>
            </div>

            <div className="profile-badge-summary">
              <span className="profile-badge-summary__count app-card-title">
                {earnedBadgeCount}/{badgeShelf.length}
              </span>
              <span className="profile-badge-summary__label app-meta-label">earned</span>
            </div>
          </div>

          <div className="friendsBox" style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginTop: 0 }}>Pending Friend Requests</h4>
            {friendRequests.length === 0 ? (
              <p style={{ margin: 0 }}>No pending requests.</p>
            ) : (
              <ul className="friendsList">
                {friendRequests.map((requester) => (
                  <li key={requester} className="friendsListRow">
                    <span>{requester}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        onClick={async () => {
                          setFriendError('');
                          setFriendNotice('');
                          const res = await friendsAccept(requester);
                          if (res.status !== 200) {
                            setFriendError(res.data?.error || 'Failed to accept friend request');
                            return;
                          }
                          setFriends(res.data.friends || []);
                          setFriendRequests(res.data.requests || []);
                          setFriendNotice(res.data?.message || 'Friend request accepted.');
                        }}
                      >
                        Accept
                      </button>
                      <button
                        className="btn"
                        onClick={async () => {
                          setFriendError('');
                          setFriendNotice('');
                          const res = await friendsDecline(requester);
                          if (res.status !== 200) {
                            setFriendError(res.data?.error || 'Failed to decline friend request');
                            return;
                          }
                          setFriends(res.data.friends || []);
                          setFriendRequests(res.data.requests || []);
                          setFriendNotice(res.data?.message || 'Friend request declined.');
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="friendsBox">
            <h4 style={{ marginTop: 0 }}>Friend List</h4>
            {friends.length === 0 ? (
              <p className="profile-friends-empty app-helper-text">No friends yet.</p>
            ) : (
              <ul className="friendsList">
                {friends.map((f) => (
                  <li key={f} className="friendsListRow">
                    <span
                      style={{
                        textDecoration: 'underline',
                        cursor: loadingFriend ? 'wait' : 'pointer',
                        opacity: loadingFriend ? 0.5 : 1
                      }}
                      onClick={async () => {
                        setFriendError('');
                        setFriendNotice('');
                        setLoadingFriend(true);
                        try {
                          const response = await friendsProfileGet(f);
                          if (response.status !== 200) {
                            setFriendError(response.data?.error || 'Failed to load friend profile');
                            return;
                          }

                          const friendUser = response.data.user;
                          const normalized = {
                            ...friendUser,
                            game_profile: GameProfile.from(friendUser.game_profile)
                          };
                          setFriendProfile(normalized);
                        } finally {
                          setLoadingFriend(false);
                        }
                      }}>
                      {f}
                    </span>
                    <button
                      className="btn"
                      onClick={async () => {
                        setFriendError('');
                        setFriendNotice('');
                        const res = await friendsRemove(f);
                        if (res.status !== 200) {
                          setFriendError(res.data?.error || 'Failed to remove');
                          return;
                        }
                        setFriends(res.data.friends || []);
                        setFriendRequests(res.data.requests || []);
                        setFriendNotice('Friend removed.');
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showFriends && (
          <div className="profile-panel">
            <div className="profile-panel__title app-panel-title">
              Friend Requests
              {pendingCount > 0 && (
                <span className="profile-count-badge app-micro-text">{pendingCount}</span>
              )}
            </div>

            {friendRequests.length === 0 ? (
              <p className="profile-friends-empty">No pending requests right now.</p>
            ) : (
              <div className="profile-request-list">
                {friendRequests.map((requester) => {
                  const busy = friendActionBusy === requester;

                  return (
                    <div key={requester} className="profile-request-row">
                      <div className="profile-request-copy app-body-text">
                        <strong className="app-card-title">{getFriendDisplayName(requester)}</strong> wants to connect.
                      </div>
                      <div className="profile-request-actions">
                        <button
                          type="button"
                          className="profile-request-accept-btn app-button-label"
                          onClick={() => handleAcceptRequest(requester)}
                          disabled={busy}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="profile-request-decline-btn app-button-label"
                          onClick={() => handleDeclineRequest(requester)}
                          disabled={busy}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="profile-panel profile-appearance-panel">
          <div className="profile-panel__title app-panel-title">Appearance</div>
          <p className="profile-appearance-copy app-helper-text">
            Choose your app theme and viewing mode.
          </p>

          <div className="profile-appearance-grid">
            <div className="profile-appearance-column">
              <div className="profile-appearance-subtitle app-field-label">Theme</div>

              <div className="profile-theme-card-grid">
                {allowedThemes.map((id) => {
                  const option = allThemes[id];
                  const active = themeId === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      className={`profile-theme-card ${active ? 'is-active' : ''}`}
                      onClick={() => handleAppThemeChange(id)}
                      disabled={savingAppTheme || savingTheme}
                    >
                      <span
                        className="profile-theme-card__preview"
                        style={{ background: option.preview }}
                      />
                      <span className="profile-theme-card__copy">
                        <span>{option.label}</span>
                        <small>{option.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="profile-appearance-column">
              <div className="profile-appearance-subtitle app-field-label">Mode</div>

              <div className="profile-theme-options">
                <label className="profile-theme-option app-body-text">
                  <span className="profile-theme-icon">☀️</span>
                  <span className="profile-theme-copy">
                    <span>Light</span>
                    <small>Brighter surfaces and softer contrast</small>
                  </span>
                  <input
                    type="radio"
                    name="themeMode"
                    value="light"
                    checked={themeMode !== 'dark'}
                    onChange={handleModeChange}
                    disabled={savingTheme || savingAppTheme}
                  />
                </label>

                <label className="profile-theme-option app-body-text">
                  <span className="profile-theme-icon">🌙</span>
                  <span className="profile-theme-copy">
                    <span>Dark</span>
                    <small>Deeper contrast for low-light viewing</small>
                  </span>
                  <input
                    type="radio"
                    name="themeMode"
                    value="dark"
                    checked={themeMode === 'dark'}
                    onChange={handleModeChange}
                    disabled={savingTheme || savingAppTheme}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {friendProfile && items && (
        <div
          className="profile-modal-overlay"
          onClick={() => setFriendProfile(null)}
        >
          <div
            className="profile-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="profile-modal__username app-card-title">
              {friendProfile.username}
              {friendProfile.code ? `#${friendProfile.code}` : ''}
            </h2>

            <div className="profile-modal__avatar">
              <DisplayAvatar invItems={friendInvItems} />
            </div>

            <div className="profile-modal__stats">
              <div className="profile-modal__stat">
                <div className="profile-modal__stat-label app-meta-label">Tasks</div>
                <div className="profile-modal__stat-value app-micro-text">
                  {friendProfile.stats?.tasksCompleted || 0}
                </div>
              </div>
              <div className="profile-modal__stat">
                <div className="profile-modal__stat-label app-meta-label">Habits</div>
                <div className="profile-modal__stat-value app-micro-text">
                  {friendProfile.stats?.habitsBuilt || 0}
                </div>
              </div>
              <div className="profile-modal__stat">
                <div className="profile-modal__stat-label app-meta-label">Streak</div>
                <div className="profile-modal__stat-value app-micro-text">
                  {friendProfile.stats?.longestStreak || 0}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="profile-modal__close app-button-label"
              onClick={() => setFriendProfile(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
