import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useItems } from '../useItems.jsx';

/**
 * Reward configuration step for the Habit Wizard.
 * Allows users to set up coin rewards per completion and milestone rewards.
 */
export function RewardsStep({
  coinsPerCompletion,
  milestoneRewards,
  onMilestoneRewardChange,
  savingFor,
  onSavingForChange,
  rewardGoalTitle,
  onRewardGoalTitleChange,
  rewardGoalCostCoins,
  onRewardGoalCostCoinsChange,
  completionsNeeded,
  error,
}) {
  const { items, itemloading } = useItems();
  const [selectedShopItemId, setSelectedShopItemId] = useState('');

  const shopItems = useMemo(
    () => (Array.isArray(items) ? items.filter((it) => it && (it.name || it.title)) : []),
    [items]
  );

  const handleShopSelect = (value) => {
    setSelectedShopItemId(value);
    if (!value) return;
    const item = shopItems.find((it) => String(it.id) === String(value));
    if (!item) return;

    const label = item.name || item.title || '';
    const price = item.price != null ? item.price : '';
    onSavingForChange(label);
    onRewardGoalTitleChange(label);
    if (price !== '') onRewardGoalCostCoinsChange(price);
  };
  return (
    <div className="hw-stack-md">
      <div className="hw-info-banner">
        <span>💰</span>
        <div>
          Set up rewards to stay motivated. You'll earn {coinsPerCompletion} coins for each completed action plan.
        </div>
      </div>

      {/* Base reward display */}
      <div className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">✨</span>Base reward
        </div>
        <div className="hw-reward-summary">
          <div className="hw-reward-coins-row">{coinsPerCompletion} coins</div>
          <div className="hw-reward-coins-sub">per completed action plan</div>
        </div>
      </div>

      {/* Milestone rewards */}
      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">🏅</span>Milestone rewards
        </div>
        <div className="muted">Earn bonus coins when you reach consistency milestones.</div>
        <div className="hw-mt8">
          {Array.isArray(milestoneRewards) &&
            milestoneRewards.map((m, idx) => (
              <div key={`ms-${idx}`} className="hw-milestone-row hw-mt6">
                <div style={{ minWidth: 140 }}>
                  <strong>{m.days} days</strong>
                  <div className="muted">Milestone</div>
                  {m.badge && <span className="hw-milestone-badge">{m.badge}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    className="hw-input"
                    value={m.coins}
                    onChange={(e) => onMilestoneRewardChange(idx, e.target.value)}
                    placeholder="Coins"
                  />
                  <div className="muted">coins</div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Savings goal */}
      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">🎯</span>What are you saving for?
        </div>
        <div className="muted">Optional: Set a reward goal to work toward.</div>

        <div className="hw-mt8">
          <label className="hw-reward-field-label" htmlFor="hw-shop-item">
            Pick from the shop (optional)
          </label>
          <select
            id="hw-shop-item"
            className="hw-input"
            value={selectedShopItemId}
            disabled={itemloading || shopItems.length === 0}
            onChange={(e) => handleShopSelect(e.target.value)}
          >
            <option value="">Select an item…</option>
            {shopItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.title} {item.price != null ? `(${item.price} coins)` : ''}
              </option>
            ))}
          </select>
          <div className="muted" style={{ marginTop: 4 }}>
            Choosing an item fills the goal name and cost automatically.
          </div>
        </div>

        <div className="hw-mt8">
          <label className="hw-reward-field-label" htmlFor="hw-savingfor">
            I'm saving for...
          </label>
          <input
            id="hw-savingfor"
            className="hw-input"
            value={savingFor}
            onChange={(e) => onSavingForChange(e.target.value)}
            placeholder="e.g. a new book, a movie night, a nice dinner"
          />
        </div>

        <div className="hw-mt8">
          <label className="hw-reward-field-label" htmlFor="hw-goal-name">
            Reward goal name
          </label>
          <input
            id="hw-goal-name"
            className="hw-input"
            value={rewardGoalTitle}
            onChange={(e) => onRewardGoalTitleChange(e.target.value)}
            placeholder="e.g. My treat"
          />
        </div>

        <div className="hw-mt8">
          <label className="hw-reward-field-label" htmlFor="hw-goal-cost">
            Cost (coins)
          </label>
          <input
            id="hw-goal-cost"
            type="number"
            min="0"
            className="hw-input"
            value={rewardGoalCostCoins}
            onChange={(e) => onRewardGoalCostCoinsChange(e.target.value)}
            placeholder="100"
          />
        </div>

        {completionsNeeded > 0 && (
          <div className="hw-goal-hint hw-mt8">
            💡 At {coinsPerCompletion} coins each, you'll reach this in about {completionsNeeded} completed action plans.
          </div>
        )}
      </section>

      {error && <ErrorText message={error} />}
    </div>
  );
}

RewardsStep.propTypes = {
  coinsPerCompletion: PropTypes.number.isRequired,
  milestoneRewards: PropTypes.array.isRequired,
  onMilestoneRewardChange: PropTypes.func.isRequired,
  savingFor: PropTypes.string.isRequired,
  onSavingForChange: PropTypes.func.isRequired,
  rewardGoalTitle: PropTypes.string.isRequired,
  onRewardGoalTitleChange: PropTypes.func.isRequired,
  rewardGoalCostCoins: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onRewardGoalCostCoinsChange: PropTypes.func.isRequired,
  completionsNeeded: PropTypes.number,
  error: PropTypes.string,
};

// Simple inline error display component (reuse from HabitWizardSteps.jsx or duplicate)
function ErrorText({ message }) {
  if (!message) return null;
  return <div className="hw-error">{message}</div>;
}
ErrorText.propTypes = { message: PropTypes.string };