import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from './EmptyState.jsx';
import './CuePlanCard.css';
import { CUE_PRESETS } from '../lib/cuePresets.js';

const DEFAULT_ORDER = CUE_PRESETS.map((item) => item.key);

function normalizeSections(sections = []) {
  const orderMap = new Map(DEFAULT_ORDER.map((key, index) => [key, index]));

  return [...sections]
    .filter((section) => Array.isArray(section?.items) && section.items.length > 0)
    .sort((a, b) => {
      const aIndex = orderMap.has(a?.key) ? orderMap.get(a.key) : 999;
      const bIndex = orderMap.has(b?.key) ? orderMap.get(b.key) : 999;

      if (aIndex !== bIndex) return aIndex - bIndex;
      return String(a?.label || '').localeCompare(String(b?.label || ''));
    });
}

function deriveProgress(sections) {
  let total = 0;
  let done = 0;

  for (const section of sections) {
    for (const item of section.items) {
      total++;
      if (item?.isComplete) done++;
    }
  }

  if (total === 0) return { value: 0, text: '0 / 0' };
  return { value: Math.round((done / total) * 100), text: `${done} / ${total}` };
}

function normalizeHabitType(value) {
  const raw = String(value || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (raw.includes('break')) return 'break-habit';
  if (raw.includes('build')) return 'build-habit';
  return 'build-habit';
}

export default function CuePlanCard({
  title = 'Action plan',
  progressLabel = 'Daily Progress',
  // Optional overrides — derived from sections if omitted
  progressValue,
  progressValueText,
  headerAction = null,
  sections = [],
  loading = false,
  loadingText = 'Loading…',
  emptyIcon = '📋',
  emptyTitle = 'Nothing due today',
  emptyDescription = 'Plans due today will show here.',
  onItemClick,
}) {
  const [mounted, setMounted] = useState(false)
  const safeSections = useMemo(() => normalizeSections(sections), [sections]);

  const progress = useMemo(() => deriveProgress(safeSections), [safeSections]);
  const displayValue = progressValue ?? progress.value;
  const displayText = progressValueText || progress.text;

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section className="cueCard">
      <div className="cueCard__header">
        <h2 className="cueCard__title app-panel-title">{title}</h2>
        {headerAction}
      </div>

      <div className="cueCard__progress">
        <div className="cueCard__progressRow">
          <span className="app-meta-label">{progressLabel}</span>
          <strong className="app-micro-text">{displayText}</strong>
        </div>

        <div className="cueCard__progressTrack">
          <div
            className="cueCard__progressFill"
            style={{
              width: mounted ? `${Math.max(0, Math.min(100, Number(displayValue) || 0))}%` : '0%',
            }}
          />
        </div>
      </div>

      <div className="cueCard__body">
        {loading ? (
          <p className="cueCard__muted app-helper-text">{loadingText}</p>
        ) : safeSections.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          safeSections.map((section, sectionIndex) => {
            const total = section.items.length;
            const done = section.items.filter((i) => i?.isComplete).length;
            const allDone = total > 0 && done === total;

            return (
              <div
                className={`cueCard__group ${allDone ? 'is-all-done' : ''}`}
                key={section.key || section.label || `cue-section-${sectionIndex}`}
              >
                <div className="cueCard__groupHeader">
                  <span className="cueCard__groupTitle app-meta-label">{section.label}</span>
                  <span className="cueCard__groupCount app-micro-text">{done}/{total}</span>
                  <span className="cueCard__groupLine" />
                </div>

                <div className="cueCard__groupItems">
                  {section.items.map((item, itemIndex) => {
                    const clickValue = item?.raw ?? item;
                    const isComplete = !!item?.isComplete;

                    const normalizedHabitType = normalizeHabitType(item?.habitType)
                    const habitTypeClass = normalizedHabitType === 'break-habit' ? 'is-break' : 'is-build'

                    return (
                      <button
                        key={item.id || item.tempId || `${section.key || section.label || sectionIndex}-item-${itemIndex}`}
                        type="button"
                        className={`cueCard__item ${isComplete ? 'is-complete' : ''} ${habitTypeClass}`}
                        aria-pressed={isComplete}
                        onClick={() => onItemClick?.(clickValue)}
                      >
                        <div className="cueCard__itemCheck">
                          {isComplete ? '✓' : ''}
                        </div>

                        <div className="cueCard__itemContent">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="cueCard__itemTitle app-card-title">
                              {item?.title || 'Untitled plan'}
                            </div>
                            <span className={`cueCard__typePill app-meta-label ${habitTypeClass}`}>
                              {normalizedHabitType === 'break-habit' ? 'Break' : 'Build'}
                            </span>
                          </div>

                          {item?.subLabel && (
                            <div className="cueCard__itemSubLabel app-helper-text">{item.subLabel}</div>
                          )}

                          {item?.detail && (
                            <div className="cueCard__itemDetail app-micro-text">{item.detail}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
