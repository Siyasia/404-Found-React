import React, { useState, useRef, useEffect } from 'react';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';
import { useGameProfile } from '../components/useGameProfile.jsx';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';
import './Avatar.css';

const TAB_ICONS = {
  Base: '🧑',
  Hair: '💇',
  Eyebrows: '🤨',
  Eyes: '👀',
  Mouths: '😄',
  Shirts: '👕',
  Outerwear: '🧥',
  Pants: '👖',
  Shoes: '👟',
  Head: '🎩',
  Shirt: '👕',
};

const REACTIONS = [
  '✨ Looking amazing!',
  '🔥 So cool!',
  '💜 Love it!',
  '⭐ Awesome pick!',
  '🎉 Great style!',
  '🌈 So colorful!',
  '😍 Perfect!',
  '🚀 Super cool!',
];

const CONFETTI_COLORS = [
  '#f472b6',
  '#a855f7',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#818cf8',
  '#4ade80',
];

function Confetti({ active, onDone }) {
  const pieces = React.useMemo(() => {
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      duration: 1.2 + Math.random() * 0.8,
      delay: Math.random() * 0.4,
      size: 8 + Math.random() * 8,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    }));
  }, [active]);

  if (!active) return null;

  return (
    <div className="avatar-confetti-wrap">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="avatar-confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.borderRadius,
            animationDuration: `${piece.duration}s`,
            animationDelay: `${piece.delay}s`,
          }}
          onAnimationEnd={piece.id === 0 ? onDone : undefined}
        />
      ))}
    </div>
  );
}

function randomFrom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function sameInventoryState(nextInventory, currentInventory) {
  if (!Array.isArray(nextInventory) || !Array.isArray(currentInventory)) return false;
  if (nextInventory.length !== currentInventory.length) return false;

  for (let i = 0; i < nextInventory.length; i += 1) {
    const next = nextInventory[i];
    const current = currentInventory[i];

    if (!next || !current) return false;
    if (String(next.id) !== String(current.id)) return false;
    if (Boolean(next.equipped) !== Boolean(current.equipped)) return false;
    if ((next.color ?? null) !== (current.color ?? null)) return false;
  }

  return true;
}

export default function Avatar() {
  const { profile, saveProfile, loading, error } = useGameProfile();
  const { items, loading: itemLoading, error: itemError } = useItems();
  const invItems = useInventory(profile, items);

  const [selectedCategory, setSelectedCategory] = useState('Base');
  const [bouncing, setBouncing] = useState(false);
  const [reaction, setReaction] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const bounceTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (bounceTimeout.current) clearTimeout(bounceTimeout.current);
    };
  }, []);

  const COLOR_MAP = {
    Base: {
      1: '#BD894E',
      2: '#D8AE73',
      3: '#EAC487',
      4: '#F9DCB2',
      5: '#E5B696',
      6: '#E9BAA6',
      7: '#F6B889',
      8: '#D89C70',
      9: '#A77F61',
      10: '#B1815E',
      11: '#85582E',
      12: '#976641',
      13: '#6E513B',
      14: '#68462D',
      15: '#4B2F1A',
      16: '#532A0B',
      17: '#693E1E',
      18: '#734E32',
      19: '#9D96E5',
      20: '#233F8A',
      21: '#693AA1',
      22: '#D87BB7',
      23: '#7BD887',
      24: '#40AB8E',
    },
    Hair: {
      1: '#2A2828',
      2: '#E1EAEA',
      3: '#DB5B4C',
      4: '#E66695',
      5: '#CE68D1',
      6: '#9343DD',
      7: '#4643DD',
      8: '#4398DD',
      9: '#43DBDD',
      10: '#43DD7C',
      11: '#A8DD43',
      12: '#F0DC71',
      13: '#DD8642',
      14: '#BE3F3C',
      15: '#825929',
      16: '#B0A56B',
      17: '#55330A',
    },
    Eyebrows: null,
    Shirts: {
      1: '#2A2828',
      2: '#E1EAEA',
      3: '#DB5B4C',
      4: '#E66695',
      5: '#CE68D1',
      6: '#9343DD',
      7: '#4643DD',
      8: '#4398DD',
      9: '#43DBDD',
      10: '#43DD7C',
      11: '#A8DD43',
      12: '#F0DC71',
      13: '#DD8642',
      14: '#BE3F3C',
      15: '#55330A',
    },
    Outerwear: null,
    Eyes: {
      1: '#2A2828',
      2: '#E1EAEA',
      3: '#DB5B4C',
      4: '#E66695',
      5: '#CE68D1',
      6: '#9343DD',
      7: '#4643DD',
      8: '#4398DD',
      9: '#43DBDD',
      10: '#43DD7C',
      11: '#A8DD43',
      12: '#F0DC71',
      13: '#DD8642',
      14: '#BE3F3C',
      15: '#825929',
      16: '#55330A',
    },
    Pants: {
      1: '#2A2828',
      2: '#E1EAEA',
      3: '#DB5B4C',
      4: '#E66695',
      5: '#CE68D1',
      6: '#9343DD',
      7: '#4643DD',
      8: '#4398DD',
      9: '#43DBDD',
      10: '#43DD7C',
      11: '#A8DD43',
      12: '#F0DC71',
      13: '#DD8642',
      14: '#BE3F3C',
      15: '#55330A',
      16: '#B0A56B',
    },
    Shoes: null,
  };
  COLOR_MAP.Eyebrows = COLOR_MAP.Hair;
  COLOR_MAP.Outerwear = COLOR_MAP.Shirts;
  COLOR_MAP.Shoes = COLOR_MAP.Pants;

  if (loading || itemLoading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (itemError) return <p>{itemError}</p>;
  if (!profile) return <p>Could not load avatar profile.</p>;

  const triggerBounce = (withConfetti = false) => {
    setBouncing(false);

    requestAnimationFrame(() => {
      setBouncing(true);
      setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);

      if (withConfetti) setShowConfetti(true);

      clearTimeout(bounceTimeout.current);
      bounceTimeout.current = setTimeout(() => {
        setBouncing(false);
        setReaction('');
      }, 2200);
    });
  };

  const persistInventory = async (nextInventory, withConfetti = false) => {
    try {
      setIsSaving(true);
      await saveProfile({
        ...profile,
        inventory: nextInventory,
      });
      triggerBounce(withConfetti);
    } catch (saveError) {
      console.error('Failed to save avatar changes:', saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const equip = async (itemID, placement) => {
    const updated = profile.inventory.map((inv) => {
      const item = items.find((candidate) => String(candidate.id) === String(inv.id));

      if (String(inv.id) === String(itemID)) {
        return { ...inv, equipped: true };
      }

      if (item?.placement === placement) {
        return { ...inv, equipped: false };
      }

      return inv;
    });

    await persistInventory(updated, false);
  };

  const unequip = async (itemID) => {
    const invItem = profile.inventory.find((item) => String(item.id) === String(itemID));
    if (!invItem) return;

    const item = items.find((candidate) => String(candidate.id) === String(invItem.id));
    if (!item) return;

    const defaultItem = items.find(
      (candidate) => candidate.type === 'Default' && candidate.placement === item.placement
    );

    if (!defaultItem && item.placement !== 'Outerwear') return;
    if (String(invItem.id) === String(defaultItem?.id)) return;

    const updated = profile.inventory.map((inv) => {
      const fullItem = items.find((candidate) => String(candidate.id) === String(inv.id));

      if (String(inv.id) === String(itemID)) {
        return { ...inv, equipped: false };
      }

      if (fullItem?.placement === item.placement && String(inv.id) === String(defaultItem?.id)) {
        return { ...inv, equipped: true, color: inv.color ?? 1 };
      }

      return inv;
    });

    await persistInventory(updated, false);
  };

  const updateColor = async (itemID, color) => {
    const updated = profile.inventory.map((inv) =>
      String(inv.id) === String(itemID) ? { ...inv, color } : inv
    );

    await persistInventory(updated, false);
  };

  const surpriseMe = async () => {
    const itemMap = new Map(items.map((item) => [String(item.id), item]));
    const currentInventory = Array.isArray(profile.inventory) ? profile.inventory : [];

    const ownedByPlacement = {};

    currentInventory.forEach((inv) => {
      const item = itemMap.get(String(inv.id));
      if (!item) return;

      const placement = item.placement;
      if (!placement) return;

      if (!ownedByPlacement[placement]) ownedByPlacement[placement] = [];
      ownedByPlacement[placement].push({ inv, item });
    });

    const placements = Object.keys(ownedByPlacement);
    if (!placements.length) return;

    const pickRandomColor = (placement, fallbackColor = 1) => {
      const colorSet = COLOR_MAP[placement];
      if (!colorSet) return fallbackColor ?? 1;

      const options = Object.keys(colorSet).map(Number);
      return randomFrom(options) ?? fallbackColor ?? 1;
    };

    let updated = currentInventory;
    let attempts = 0;

    do {
      updated = currentInventory.map((inv) => ({ ...inv }));

      placements.forEach((placement) => {
        const group = ownedByPlacement[placement];
        if (!group?.length) return;

        const isOptionalSlot = placement === 'Outerwear';

        if (isOptionalSlot && Math.random() < 0.45) {
          updated = updated.map((inv) => {
            const item = itemMap.get(String(inv.id));
            if (item?.placement === placement) {
              return { ...inv, equipped: false };
            }
            return inv;
          });
          return;
        }

        const chosen = randomFrom(group);
        if (!chosen) return;

        updated = updated.map((inv) => {
          const fullItem = itemMap.get(String(inv.id));

          if (String(inv.id) === String(chosen.inv.id)) {
            const nextColor = pickRandomColor(placement, inv.color ?? 1);
            return {
              ...inv,
              equipped: true,
              color: nextColor,
            };
          }

          if (fullItem?.placement === placement) {
            return {
              ...inv,
              equipped: false,
            };
          }

          return inv;
        });
      });

      attempts += 1;
    } while (attempts < 8 && sameInventoryState(updated, currentInventory));

    await persistInventory(updated, true);
  };

  const categories = {};
  for (const item of invItems) {
    if (!categories[item.placement]) categories[item.placement] = [];
    categories[item.placement].push(item);
  }

  const categoryKeys = Object.keys(categories);
  const safeSelectedCategory = categoryKeys.includes(selectedCategory)
    ? selectedCategory
    : categoryKeys[0] || 'Base';

  return (
    <div className="avatar-page">
      <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />

      <div className="avatar-canvas">
        <h1>Build Your Avatar!</h1>

        <div className="avatar-body">
          <div className="avatar-preview-card">
            <span className="avatar-preview-label">Your Avatar</span>

            <div className={`avatar-preview-inner ${bouncing ? 'did-equip' : ''}`}>
              <DisplayAvatar invItems={invItems} />
            </div>

            {reaction ? (
              <div key={reaction} className="avatar-reaction">
                {reaction}
              </div>
            ) : (
              <div className="avatar-reaction" />
            )}

            <button
              type="button"
              className="avatar-surprise-btn"
              onClick={surpriseMe}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Surprise Me!'}
            </button>
          </div>

          <div>
            <div className="avatar-tabs">
              {categoryKeys.map((placement) => (
                <button
                  key={placement}
                  type="button"
                  className={`avatar-tab ${safeSelectedCategory === placement ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory(placement)}
                >
                  <span className="avatar-tab__icon">{TAB_ICONS[placement] || '🎨'}</span>
                  {placement.charAt(0).toUpperCase() + placement.slice(1)}
                </button>
              ))}
            </div>

            <div className="avatar-panel">
              <div className="avatar-panel__title">
                {safeSelectedCategory.charAt(0).toUpperCase() + safeSelectedCategory.slice(1)}
              </div>

              <div className="avatar-items-grid">
                {categories[safeSelectedCategory]?.map((item) => {
                  const isDefault = item.type === 'Default';

                  return (
                    <div
                      key={item.id}
                      className={`avatar-item-card ${item.equipped ? 'is-equipped' : ''}`}
                    >
                      <img
                        className="avatar-item-card__img"
                        src={`${item.path}.PNG`}
                        alt={item.name}
                      />

                      {item.equipped && COLOR_MAP[item.placement] && (
                        <div className="avatar-color-swatches">
                          {Object.entries(COLOR_MAP[item.placement]).map(([color, hex]) => (
                            <button
                              key={color}
                              type="button"
                              className={`avatar-swatch ${
                                (item.color ?? 1) === parseInt(color, 10) ? 'is-selected' : ''
                              }`}
                              style={{ backgroundColor: hex }}
                              onClick={() => updateColor(item.id, parseInt(color, 10))}
                              aria-label={`Color ${color}`}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      )}

                      {item.equipped ? (
                        !isDefault && (
                          <button
                            type="button"
                            className="avatar-btn avatar-btn--unequip"
                            onClick={() => unequip(item.id)}
                            disabled={isSaving}
                          >
                            Unequip
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="avatar-btn avatar-btn--equip"
                          onClick={() => equip(item.id, item.placement)}
                          disabled={isSaving}
                        >
                          Equip
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
