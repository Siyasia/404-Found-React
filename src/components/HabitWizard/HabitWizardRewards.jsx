import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useItems } from '../useItems.jsx';

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
  rewardType,
  rewardShopItemId,
  onRewardTypeChange,
  onRewardShopItemIdChange,
  completionsNeeded,
  error,
}) {
  const { items, itemloading: itemsLoading } = useItems();

  const shopItems = useMemo(
    () =>
      Array.isArray(items)
        ? items.filter(
            (item) =>
              item &&
              (item.name || item.title) &&
              item.type !== 'Default' &&
              item.placement !== 'Base'
          )
        : [],
    [items]
  );

  const handleShopSelect = (value) => {
    onRewardShopItemIdChange(value);
    onRewardTypeChange(value ? 'shop' : 'custom');

    if (!value) return;

    const item = shopItems.find((it) => String(it.id) === String(value));
    if (!item) return;

    const label = item.name || item.title || '';
    const price = item.price != null ? item.price : '';

    onSavingForChange(label);
    onRewardGoalTitleChange(label);
    onRewardGoalCostCoinsChange(price);
  };

  const isShopReward = rewardType === 'shop';

  return (
    <div className="hw-stack-md">
      <div className="hw-info-banner">
        <span>💰</span>
        <div>
          Set up one active reward to stay motivated. You&apos;ll earn {coinsPerCompletion} coins for each completed action plan.
        </div>
      </div>

      <div className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">✨</span>Base reward
        </div>
        <div className="hw-reward-summary">
          <div className="hw-reward-coins-row">{coinsPerCompletion} coins</div>
          <div className="hw-reward-coins-sub">per completed action plan</div>
        </div>
      </div>

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

      <section className="hw-section-card">
        <div className="hw-section-card-title">
          <span className="hw-section-icon">🎯</span>Active reward
        </div>
        <div className="muted">Pick one reward at a time. This is what the homepage reward bar will track.</div>

        <div className="hw-examples-chips hw-mt8">
          <button
            type="button"
            className={rewardType === 'custom' ? 'chip selected' : 'chip'}
            onClick={() => {
              onRewardTypeChange('custom');
              onRewardShopItemIdChange('');
            }}
          >
            Custom reward
          </button>

          <button
            type="button"
            className={rewardType === 'shop' ? 'chip selected' : 'chip'}
            onClick={() => onRewardTypeChange('shop')}
          >
            Shop item
          </button>
        </div>

        {isShopReward && (
          <div className="hw-mt8">
            <label className="hw-reward-field-label" htmlFor="hw-shop-item">
              Pick a shop item
            </label>

            <select
              id="hw-shop-item"
              className="hw-input"
              value={rewardShopItemId}
              disabled={itemsLoading || shopItems.length === 0}
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
              Choosing an item fills the title and cost automatically.
            </div>
          </div>
        )}

        <div className="hw-mt8">
          <label className="hw-reward-field-label" htmlFor="hw-savingfor">
            What are you saving for?
          </label>
          <input
            id="hw-savingfor"
            className="hw-input"
            value={savingFor}
            onChange={(e) => onSavingForChange(e.target.value)}
            placeholder={isShopReward ? 'Auto-filled from shop selection' : 'e.g. movie night'}
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
            placeholder="e.g. Movie night"
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
            💡 At {coinsPerCompletion} coins each, you&apos;ll reach this in about {completionsNeeded} completed action plans.
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
  rewardType: PropTypes.oneOf(['custom', 'shop']).isRequired,
  rewardShopItemId: PropTypes.string.isRequired,
  onRewardTypeChange: PropTypes.func.isRequired,
  onRewardShopItemIdChange: PropTypes.func.isRequired,
  completionsNeeded: PropTypes.number,
  error: PropTypes.string,
};

function ErrorText({ message }) {
  if (!message) return null;
  return <div className="hw-error">{message}</div>;
}
ErrorText.propTypes = { message: PropTypes.string };
