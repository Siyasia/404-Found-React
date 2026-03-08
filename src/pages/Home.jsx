import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext.jsx';
import GoalCard from '../components/GoalCard.jsx';
import HabitPlanList from '../components/HabitPlanList.jsx';
import { goalList } from '../lib/api/goals.js';
import { actionPlanList } from '../lib/api/actionPlans.js';
import { isDueOnDate, toLocalISODate } from '../lib/schedule.js';
import '../dashboardTheme.css';

// PHASE 4: Home is now the first read-only surface for the new goal + action-plan system.
// This page deliberately avoids completion toggles, coins, badges, and calendar logic.
export default function Home() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [goals, setGoals] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayISO = useMemo(() => toLocalISODate(), []);

  useEffect(() => {
    let active = true;

    async function loadReadOnlyHabitData() {
      setLoading(true);
      try {
        const [goalResponse, planResponse] = await Promise.all([
          goalList(),
          actionPlanList(),
        ]);

        if (!active) return;

        const nextGoals = Array.isArray(goalResponse?.data) ? goalResponse.data : [];
        const nextPlans = Array.isArray(planResponse?.data) ? planResponse.data : [];

        setGoals(nextGoals);
        setActionPlans(nextPlans);
      } catch (error) {
        console.error('[PHASE 4] Failed to load goals/action plans for Home:', error);
        if (!active) return;
        setGoals([]);
        setActionPlans([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReadOnlyHabitData();

    return () => {
      active = false;
    };
  }, []);

  // PHASE 4: Show goals assigned to the current user, plus goals they created for others.
  const visibleGoals = useMemo(() => {
    if (!Array.isArray(goals) || !user?.id) return [];

    return goals.filter((goal) => {
      const isAssignedToUser = String(goal?.assigneeId) === String(user.id);
      const isCreatedByUser = String(goal?.createdById) === String(user.id);
      return isAssignedToUser || isCreatedByUser;
    });
  }, [goals, user]);

  const visibleActionPlans = useMemo(() => {
    const visibleGoalIds = new Set(visibleGoals.map((goal) => String(goal.id)));
    return (Array.isArray(actionPlans) ? actionPlans : []).filter((plan) =>
      visibleGoalIds.has(String(plan.goalId))
    );
  }, [actionPlans, visibleGoals]);

  const todaysPlans = useMemo(() => {
    return visibleActionPlans.filter((plan) => {
      const schedule =
        plan?.schedule && typeof plan.schedule === 'object'
          ? plan.schedule
          : plan?.frequency && typeof plan.frequency === 'object'
            ? plan.frequency
            : null;

      if (!schedule) return false;
      return isDueOnDate(schedule, todayISO);
    });
  }, [visibleActionPlans, todayISO]);

  const activeStreakCount = useMemo(() => {
    return visibleActionPlans.filter((plan) => Number(plan?.currentStreak || 0) > 0).length;
  }, [visibleActionPlans]);

  const assignedToMeCount = useMemo(() => {
    return visibleGoals.filter((goal) => String(goal?.assigneeId) === String(user?.id)).length;
  }, [visibleGoals, user]);

  const managedForOthersCount = useMemo(() => {
    return visibleGoals.filter(
      (goal) =>
        String(goal?.createdById) === String(user?.id) &&
        String(goal?.assigneeId) !== String(user?.id)
    ).length;
  }, [visibleGoals, user]);

  if (!user) {
    return (
      <section className="container" style={{ padding: '1.5rem 1rem' }}>
        <h1>Home</h1>
        <p className="sub hero">You need to log in first.</p>
      </section>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="homeDashboard">
        <header className="homeHeader">
          <div className="homeHeaderTop">
            <div>
              <h1 className="homeTitle">Good day, {user?.name || 'there'}</h1>
              <p className="homeSub">
                This is the first read-only home view for your saved goals and action plans.
              </p>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => navigate('/habit-wizard')}
            >
              Create habit
            </button>
          </div>
        </header>

        <div className="homeGrid">
          <main className="homeMain">
            <section className="dashboard-card">
              <h2 className="sectionTitle">Today&apos;s plans</h2>

              <div style={{ marginTop: 12 }}>
                {loading ? (
                  <p className="dashboard-emptyText">Loading your action plans…</p>
                ) : (
                  <HabitPlanList
                    plans={todaysPlans}
                    emptyTitle="Nothing due today"
                    emptyDescription="Once your schedules line up with today, they will show here."
                    limit={8}
                    showAssignee
                    showType
                    showTrigger
                    showStreak
                  />
                )}
              </div>
            </section>

            <section className="dashboard-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2 className="sectionTitle">Saved goals</h2>
                <span className="dashboardInlineChip">Read-only view</span>
              </div>

              {loading ? (
                <p className="dashboard-emptyText" style={{ marginTop: 12 }}>Loading your goals…</p>
              ) : visibleGoals.length > 0 ? (
                <ul className="goalCardsList">
                  {visibleGoals.map((goal) => (
                    <li key={goal.id}>
                      <GoalCard
                        goal={goal}
                        actionPlans={visibleActionPlans.filter(
                          (plan) => String(plan.goalId) === String(goal.id)
                        )}
                        todayISO={todayISO}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-emptyText" style={{ marginTop: 12 }}>
                  No goals are visible yet. Create one in the Habit Wizard or from the parent dashboard.
                </p>
              )}
            </section>
          </main>

          <aside className="homeSide">
            <section className="dashboard-card">
              <h2 className="sectionTitle">Overview</h2>
              <div className="statsGrid" style={{ marginTop: 12 }}>
                <div className="statCard">
                  <div className="statLabel">Visible goals</div>
                  <div className="statValue">{visibleGoals.length}</div>
                  <div className="statSub">Goals you own or created</div>
                </div>

                <div className="statCard">
                  <div className="statLabel">Plans due today</div>
                  <div className="statValue">{todaysPlans.length}</div>
                  <div className="statSub">Scheduled for {todayISO}</div>
                </div>

                <div className="statCard">
                  <div className="statLabel">Active streaks</div>
                  <div className="statValue">{activeStreakCount}</div>
                  <div className="statSub">Plans with a current streak above zero</div>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="sectionTitle">Breakdown</h2>
              <div className="infoList">
                <div className="infoRow">
                  <span className="infoLabel">Assigned to you</span>
                  <span className="infoValue">{assignedToMeCount}</span>
                </div>
                <div className="infoRow">
                  <span className="infoLabel">Created for others</span>
                  <span className="infoValue">{managedForOthersCount}</span>
                </div>
                <div className="infoRow">
                  <span className="infoLabel">Visible action plans</span>
                  <span className="infoValue">{visibleActionPlans.length}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}