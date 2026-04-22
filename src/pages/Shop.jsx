import React, { useState } from 'react';
import { useUser } from '../UserContext.jsx';
import { useGameProfile } from '../components/useGameProfile.jsx';
import { GameProfile } from '../models/index.js';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';
import { getActiveReward, setActiveReward, clearActiveReward } from '../lib/api/reward.js';
import './Shop.css';

export default function Shop() {
  const { user } = useUser();
  const { profile, saveProfile, loading, error } = useGameProfile();
  const { items, itemloading: itemLoading, error: itemError } = useItems();
  const invItems = useInventory(profile, items);

  const [modal, setModal] = useState(null);
  const [chosenCategory, setChosenCategory] = useState('all');
  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeReward, setActiveRewardState] = useState(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadReward() {
      try {
        const reward = await getActiveReward({ userId: user?.id });
        if (mounted) setActiveRewardState(reward);
      } catch (err) {
        console.error('Failed to load active reward', err);
      }
    }

    loadReward();
    return () => { mounted = false; };
  }, [user?.id]);

  if (loading || itemLoading) return <p>Loading...</p>;

  const shopItems = items.filter(item =>
    item.type !== 'Default' &&
    item.placement !== 'Base' &&
    item.name !== 'coins'
  );

  const filteredInv = invItems.filter(item =>
    item.type !== 'Default' && item.placement !== 'Base'
  );

  const categories = ['all', ...new Set(shopItems.map(i => i.placement))];
  const filtered =
    chosenCategory === 'all'
      ? shopItems
      : shopItems.filter(item => item.placement === chosenCategory);

  /* --------------------------------------------------
     Helpers
  -------------------------------------------------- */
  const showModal = (message) => setModal(message);
  const closeModal = () => setModal(null);

  /* --------------------------------------------------
     Buy item
  -------------------------------------------------- */
  async function buyItem(item) {
    const updated = new GameProfile({
      id: profile.id,
      coins: profile.coins,
      inventory: profile.inventory,
    });

    if (profile.inventory.find(i => i.id === item.id)) {
      showModal(`You already own a(n) ${item.name}.`);
      return;
    }

    if (profile.coins < item.price) {
      showModal('Not enough coins.');
      return;
    }

    updated.coins -= item.price;
    updated.inventory.push({
      id: item.id,
      name: item.name,
      path: item.path,
      price: item.price,
      type: item.type,
      placement: item.placement,
      equipped: false,
    });
    updated.inventory.sort((a, b) => a.id - b.id);

    showModal(`You bought a(n) ${item.name} ${item.placement}!`);
    await saveProfile(updated);

    if (
      activeReward?.type === 'shop' &&
      String(activeReward.shopItemId) === String(item.id)
    ) {
      await clearActiveReward({ reward: activeReward, userId: user?.id });
      setActiveRewardState(null);
    }
  }

  /* --------------------------------------------------
     Preview inventory helper
  -------------------------------------------------- */
  const getPreviewInventory = () => {
    if (!preview) return invItems;
    const withoutSlot = invItems.filter(
      i => !(i.equipped && i.placement === preview.placement)
    );
    return [...withoutSlot, { ...preview, equipped: true }];
  };

  /* --------------------------------------------------
     Set item as reward goal
  -------------------------------------------------- */
  async function chooseShopReward(item) {
    if (activeReward?.sourceType === 'goal') {
      showModal(`You already have an assigned reward: ${activeReward.title}. Redeem that one first.`);
      return;
    }

    const reward = {
      type: 'shop',
      title: item.name || item.title || 'Shop reward',
      costCoins: Number(item.price || 0),
      shopItemId: String(item.id),
    };

    const saved = await setActiveReward(reward, { userId: user?.id });
    setActiveRewardState(saved);
    showModal(`Now saving for ${saved.title}!`);
  }

  /* --------------------------------------------------
     Reward progress
  -------------------------------------------------- */
  const rewardProgress =
    activeReward?.costCoins > 0
      ? Math.min(100, Math.round((profile.coins / activeReward.costCoins) * 100))
      : 0;

  const activeRewardItem = activeReward?.shopItemId
    ? shopItems.find(i => String(i.id) === String(activeReward.shopItemId))
    : null;

  /* ====================================================
     RENDER
  ==================================================== */
  return (
    <div className="shop-page">
      <div className="shop-canvas">

        {/* ---- TOP BAR ---- */}
        <div className="shop-panel shop-topbar">
          <div className="shop-topbar__left">
            <h1>Shop</h1>
            <p>Trade your coins for items to customise your avatar</p>
          </div>

          <div className="shop-coin-badge">
            <span className="shop-coin-badge__icon">🪙</span>
            <span className="shop-coin-badge__label">Your coins</span>
            <span className="shop-coin-badge__count">{profile.coins.toLocaleString()}</span>
          </div>
        </div>

        {/* ---- BODY: grid + sidebar ---- */}
        <div className="shop-body">

          {/* LEFT: tabs + item grid */}
          <div>
            {/* Category tabs */}
            <div className="shop-tabs">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  className={`shop-tab ${chosenCategory === category ? 'is-active' : ''}`}
                  onClick={() => setChosenCategory(category)}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            {/* Items grid */}
            <div className="shop-items-grid">
              {filtered.map(item => {
                const owned = profile.inventory.some(inv => inv.id === item.id);
                const isActiveReward =
                  activeReward?.type === 'shop' &&
                  String(activeReward.shopItemId) === String(item.id);

                return (
                  <div
                    key={item.id}
                    className={`shop-item-card ${owned ? 'is-owned' : ''}`}
                  >
                    {owned && (
                      <span className="shop-item-card__badge shop-item-card__badge--owned">
                        Owned
                      </span>
                    )}
                    {isActiveReward && (
                      <span className="shop-item-card__badge shop-item-card__badge--reward">
                        Saving
                      </span>
                    )}

                    <div className="shop-item-card__img-wrap">
                      <img src={`${item.path}.PNG`} alt={item.name} />
                    </div>

                    <div className="shop-item-card__name">{item.name}</div>

                    <div className="shop-item-card__price">
                      <span className="shop-item-card__price-dot" />
                      {item.price} coins
                    </div>

                    <div className="shop-item-card__actions">
                      <button
                        type="button"
                        className="shop-btn shop-btn--primary"
                        onClick={() => buyItem(item)}
                        disabled={owned}
                      >
                        {owned ? 'Owned' : 'Buy'}
                      </button>

                      <button
                        type="button"
                        className="shop-btn shop-btn--secondary"
                        onClick={() => { setPreview(item); setPreviewOpen(true); }}
                        disabled={owned}
                      >
                        Preview
                      </button>

                      <button
                        type="button"
                        className={`shop-btn ${isActiveReward ? 'shop-btn--reward' : 'shop-btn--secondary'}`}
                        onClick={() => chooseShopReward(item)}
                        disabled={owned}
                      >
                        {isActiveReward ? 'Saving for this' : 'Set as reward'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="shop-sidebar">

            {/* Active reward card */}
            {activeReward && (
              <div className="shop-panel">
                <div className="shop-panel__title">Saving for</div>

                <div className="shop-reward-card">
                  <div className="shop-reward-card__img">
                    {activeRewardItem
                      ? <img src={`${activeRewardItem.path}.PNG`} alt={activeRewardItem.name} />
                      : <span>🎁</span>}
                  </div>
                  <div>
                    <div className="shop-reward-card__name">
                      {activeReward.title}
                    </div>
                    <div className="shop-reward-card__meta">
                      {activeReward.costCoins} coins needed
                    </div>
                  </div>
                </div>

                <div className="shop-reward-progress-track">
                  <div
                    className="shop-reward-progress-fill"
                    style={{ width: `${rewardProgress}%` }}
                  />
                </div>

                <div className="shop-reward-progress-label">
                  <span>{profile.coins} coins</span>
                  <span>{rewardProgress}%</span>
                </div>
              </div>
            )}

            {/* Inventory */}
            <div className="shop-panel">
              <div className="shop-panel__title">Your inventory</div>

              {filteredInv.length === 0 ? (
                <p className="shop-inv-empty">
                  No items yet. Buy something from the shop!
                </p>
              ) : (
                <div className="shop-inv-grid">
                  {filteredInv.map(item => (
                    <div key={item.id} className="shop-inv-item">
                      <div className="shop-inv-item__img">
                        <img src={`${item.path}.PNG`} alt={item.name} />
                      </div>
                      <div className="shop-inv-item__name">{item.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ---- INFO MODAL ---- */}
      {modal && (
        <div className="shop-modal-overlay">
          <div className="shop-modal">
            <p className="shop-modal__message">{modal}</p>
            <button type="button" className="shop-btn shop-btn--secondary shop-modal__close" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ---- PREVIEW MODAL ---- */}
      {previewOpen && preview && (
        <div
          className="shop-modal-overlay"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="shop-preview-modal"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="shop-preview-modal__title">Preview</h2>

            <DisplayAvatar invItems={getPreviewInventory()} />

            <p className="shop-preview-modal__name">{preview.name}</p>
            <p className="shop-preview-modal__price">{preview.price} coins</p>

            <div className="shop-preview-modal__actions">
              <button
                type="button"
                className="shop-btn shop-btn--primary"
                onClick={() => { buyItem(preview); setPreviewOpen(false); }}
              >
                Buy
              </button>

              <button
                type="button"
                className="shop-btn shop-btn--secondary"
                onClick={() => { setPreviewOpen(false); setPreview(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
