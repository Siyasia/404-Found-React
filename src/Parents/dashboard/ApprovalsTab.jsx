import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ParentDashboardTabs.css';

export default function ApprovalsTab({ data }) {
  const navigate = useNavigate();

  const pendingCount = Array.isArray(data?.pendingTasks)
    ? data.pendingTasks.filter((task) => task?.needsApproval).length
    : 0;

  return (
    <div className="parent-tab-shell">
      <section className="parent-tab-card">
        <div className="approvals-hero">
          <div className="parent-tab-pill-row">
            <span className="parent-tab-pill parent-tab-pill--accent app-micro-text">Parent dashboard</span>
            <span className="parent-tab-pill parent-tab-pill--warm app-micro-text">Read-only for now</span>
          </div>

          <div>
            <h2 className="approvals-hero__title app-page-title">Approvals are parked for now</h2>
            <p className="approvals-hero__text app-helper-text">
              This tab is intentionally read-only until the provider approval flow is wired end to
              end. It is better to make this clear than leave a half-working approval system on the
              parent side.
            </p>
          </div>

          <div className="approvals-banner app-helper-text">
            {pendingCount > 0
              ? `${pendingCount} item${pendingCount === 1 ? ' is' : 's are'} still flagged as needing approval in data, but this screen will not try to process them until the full flow is ready.`
              : 'No active approvals are being handled in this build.'}
          </div>

          <div className="approvals-grid">
            <div className="approvals-info-card">
              <div className="approvals-info-card__title app-card-title">Use children</div>
              <div className="approvals-info-card__text app-helper-text">
                Manage child accounts, quick summaries, and parent-side support from the children
                tab.
              </div>
            </div>

            <div className="approvals-info-card">
              <div className="approvals-info-card__title app-card-title">Use goals</div>
              <div className="approvals-info-card__text app-helper-text">
                Create and assign real habits from the goal system instead of trying to manage them
                here.
              </div>
            </div>
          </div>

          <div className="approvals-actions">
            <button
              type="button"
              className="approvals-action-btn approvals-action-btn--primary app-button-label"
              onClick={() => navigate('/parent/dashboard?tab=children')}
            >
              Open children
            </button>

            <button
              type="button"
              className="approvals-action-btn approvals-action-btn--ghost app-button-label"
              onClick={() => navigate('/parent/dashboard?tab=goals')}
            >
              Open goals
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
