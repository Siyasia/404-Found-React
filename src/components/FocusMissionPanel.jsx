import React, { useEffect, useMemo, useRef, useState } from 'react'
import './FocusMissionPanel.css'

function formatClockDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatHumanDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function getTaskStatus(task) {
  const safe = String(task?.status || '').toLowerCase()
  if (safe === 'active') return 'active'
  if (safe === 'completed' || safe === 'done') return 'completed'
  return 'pending'
}

function getTiming(task, nowMs) {
  const totalSeconds = task?.useTimer && task?.durationMinutes
    ? Math.max(0, Number(task.durationMinutes) * 60)
    : null

  const startedMs = task?.startedAt ? new Date(task.startedAt).getTime() : null
  const elapsedSeconds = startedMs && Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0

  if (!totalSeconds) {
    return {
      totalSeconds: null,
      elapsedSeconds,
      remainingSeconds: null,
      progressPercent: 0,
    }
  }

  const remainingSeconds = startedMs && Number.isFinite(startedMs)
    ? Math.max(0, totalSeconds - elapsedSeconds)
    : totalSeconds

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    progressPercent: totalSeconds > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((Math.min(elapsedSeconds, totalSeconds) / totalSeconds) * 100))
        )
      : 0,
  }
}

export default function FocusMissionPanel({
  task,
  plansById = {},
  goalsById = {},
  onBack,
  onStartTask,
  onCompleteTask,
  onToggleChecklistItem,
  onDeleteTask,
}) {
  const [nowMs, setNowMs] = useState(Date.now())
  const autoCompletingRef = useRef(false)

  const status = getTaskStatus(task)
  const linkedPlan = task?.linkedActionPlanId ? plansById[String(task.linkedActionPlanId)] || null : null
  const linkedGoal = linkedPlan?.goalId ? goalsById[String(linkedPlan.goalId)] || null : null
  const timing = useMemo(() => getTiming(task, nowMs), [task, nowMs])
  const checklist = Array.isArray(task?.checklist) ? task.checklist : []
  const checklistDone = checklist.filter((item) => item?.isCompleted === true).length

  useEffect(() => {
    if (!task?.useTimer || status !== 'active') return undefined

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [task?.useTimer, status])

  useEffect(() => {
    autoCompletingRef.current = false
  }, [task?.id, status])

  useEffect(() => {
    if (!task?.useTimer || status !== 'active') return
    if (timing.remainingSeconds == null || timing.remainingSeconds > 0) return
    if (autoCompletingRef.current) return

    autoCompletingRef.current = true
    Promise.resolve(onCompleteTask?.(task.id, task.title, 'timer')).catch(() => {
      autoCompletingRef.current = false
    })
  }, [task, status, timing.remainingSeconds, onCompleteTask])

  if (!task) {
    return (
      <section className="focus-mission focus-mission--empty">
        <div className="focus-mission__empty-copy">That mission could not be found.</div>
        <button type="button" className="focus-mission__back" onClick={onBack}>Back</button>
      </section>
    )
  }

  return (
    <section className="focus-mission">
      <div className="focus-mission__header">
        <button type="button" className="focus-mission__back" onClick={onBack}>← Back</button>
        <h3 className="focus-mission__title">{task?.title || 'Mission'}</h3>
      </div>

      <div className="focus-mission__body">
        <div className="focus-mission__left">
          <article className="focus-mission__timer-card">
            <div className="focus-mission__card-label">Timer</div>

            {task?.useTimer ? (
              <>
                <div className="focus-mission__timer-value">
                  {status === 'active'
                    ? formatClockDuration(timing.remainingSeconds ?? 0)
                    : `${task.durationMinutes || 0} min`}
                </div>

                <div className="focus-mission__progress-track">
                  <div
                    className="focus-mission__progress-fill"
                    style={{ width: `${timing.progressPercent}%` }}
                  />
                </div>

                <div className="focus-mission__timer-meta">
                  <span>{timing.progressPercent}% complete</span>
                  <span>{formatHumanDuration(timing.elapsedSeconds)}</span>
                </div>
              </>
            ) : (
              <div className="focus-mission__timer-empty">No timer set for this mission.</div>
            )}

            <div className="focus-mission__actions">
              {status === 'pending' && task?.useTimer ? (
                <button
                  type="button"
                  className="focus-mission__btn focus-mission__btn--primary"
                  onClick={() => onStartTask?.(task.id)}
                >
                  Start timer
                </button>
              ) : null}

              {status !== 'completed' ? (
                <button
                  type="button"
                  className="focus-mission__btn focus-mission__btn--primary"
                  onClick={() => onCompleteTask?.(task.id, task.title, 'manual')}
                >
                  Mark complete
                </button>
              ) : null}
            </div>
          </article>

          <article className="focus-mission__summary-card">
            <div className="focus-mission__card-label">Summary</div>
            <div className="focus-mission__summary-list">
              <div><strong>Status:</strong> {status}</div>
              {task?.assigneeName ? <div><strong>Assigned to:</strong> {task.assigneeName}</div> : null}
              {linkedPlan ? <div><strong>Linked plan:</strong> {linkedPlan?.title || 'Action plan'}</div> : null}
              {linkedGoal ? <div><strong>Goal:</strong> {linkedGoal?.title || linkedGoal?.name || 'Goal'}</div> : null}
              {task?.note ? <div><strong>Note:</strong> {task.note}</div> : null}
              {task?.startedAt ? <div><strong>Time spent:</strong> {formatHumanDuration(timing.elapsedSeconds)}</div> : null}
            </div>

            {typeof onDeleteTask === 'function' ? (
              <button
                type="button"
                className="focus-mission__btn focus-mission__btn--danger"
                onClick={() => onDeleteTask(task.id)}
              >
                Delete mission
              </button>
            ) : null}
          </article>
        </div>

        <article className="focus-mission__checklist-card">
          <div className="focus-mission__card-label">Checklist</div>
          {checklist.length > 0 ? (
            <>
              <div className="focus-mission__checklist-meta">
                <span>{checklistDone}/{checklist.length} steps done</span>
              </div>

              <div className="focus-mission__checklist-list">
                {checklist.map((item, index) => (
                  <label key={item.id || item.tempId || `checklist-item-${index}`} className="focus-mission__checklist-item">
                    <input
                      type="checkbox"
                      checked={item?.isCompleted === true}
                      disabled={status === 'completed'}
                      onChange={() => onToggleChecklistItem?.(task.id, item.id)}
                    />
                    <span>{item?.label || 'Step'}</span>
                  </label>
                ))}
              </div>
            </>
          ) : task?.note ? (
            <div className="focus-mission__instructions">{task.note}</div>
          ) : (
            <div className="focus-mission__instructions">No checklist for this mission yet.</div>
          )}
        </article>
      </div>
    </section>
  )
}
