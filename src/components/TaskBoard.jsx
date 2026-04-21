import React, { useEffect, useMemo, useRef, useState } from 'react'
import './TaskBoard.css'

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

function formatSpentLabel(task, nowMs) {
  const startedMs = task?.startedAt ? new Date(task.startedAt).getTime() : null
  const endedMs = task?.completedAt ? new Date(task.completedAt).getTime() : nowMs

  if (startedMs && Number.isFinite(endedMs) && endedMs >= startedMs) {
    return formatHumanDuration(Math.floor((endedMs - startedMs) / 1000))
  }

  if (task?.useTimer && task?.durationMinutes) {
    return `${task.durationMinutes} min planned`
  }

  return null
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

function formatCompletedLabel(task) {
  if (!task?.completedAt) return 'Completed'

  return new Date(task.completedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getCompletionSourceLabel(source) {
  const safe = String(source || '').toLowerCase()
  if (safe === 'timer') return 'Timer'
  if (safe === 'checklist') return 'Checklist'
  if (safe === 'manual') return 'Manual'
  return 'Done'
}

function getChecklistSummary(task) {
  const total = Array.isArray(task?.checklist) ? task.checklist.length : 0
  const completed = total
    ? task.checklist.filter((item) => item?.isCompleted === true).length
    : 0

  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

function getTaskTiming(task, nowMs) {
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
      ? Math.min(100, Math.max(0, Math.round((Math.min(elapsedSeconds, totalSeconds) / totalSeconds) * 100)))
      : 0,
  }
}

function getLinkedMeta(task, plansById = {}, goalsById = {}) {
  if (!task?.linkedActionPlanId) return null

  const linkedPlan = plansById?.[String(task.linkedActionPlanId)] || null
  if (!linkedPlan) {
    return {
      planTitle: 'Linked action plan',
      goalTitle: '',
    }
  }

  const linkedGoal = linkedPlan?.goalId
    ? goalsById?.[String(linkedPlan.goalId)] || null
    : null

  return {
    planTitle: linkedPlan?.title || linkedPlan?.name || 'Linked action plan',
    goalTitle: linkedGoal?.title || linkedGoal?.name || '',
  }
}

function TaskCard({
  task,
  variant,
  nowMs,
  plansById,
  goalsById,
  onStartTask,
  onCompleteTask,
  onToggleChecklistItem,
  onDeleteTask,
}) {
  const checklist = getChecklistSummary(task)
  const timing = getTaskTiming(task, nowMs)
  const linkedMeta = getLinkedMeta(task, plansById, goalsById)
  const spentLabel = formatSpentLabel(task, nowMs)
  const timerLabel = task?.useTimer
    ? variant === 'active' && timing.remainingSeconds != null
      ? formatClockDuration(timing.remainingSeconds)
      : `${task.durationMinutes || 0} min`
    : 'No timer'

  return (
    <article className={`task-board__card task-board__card--${variant}`}>
      <div className="task-board__card-top">
        <div className="task-board__copy">
          <div className="task-board__title-row">
            <h4 className="task-board__title">{task.title}</h4>
            <span className={`task-board__badge task-board__badge--${variant}`}>
              {variant === 'completed' ? getCompletionSourceLabel(task?.completionSource) : timerLabel}
            </span>
          </div>

          {task?.note ? (
            <p className="task-board__note">{task.note}</p>
          ) : null}
        </div>
      </div>

      <div className="task-board__meta-list">
        {linkedMeta ? (
          <div className="task-board__meta-item">
            <span className="task-board__chip">Linked plan</span>
            <span className="task-board__meta-text">
              {linkedMeta.planTitle}
              {linkedMeta.goalTitle ? ` • ${linkedMeta.goalTitle}` : ''}
            </span>
          </div>
        ) : null}

        <div className="task-board__meta-item">
          <span className="task-board__chip">Checklist</span>
          <span className="task-board__meta-text">
            {checklist.total > 0
              ? `${checklist.completed}/${checklist.total} steps done`
              : 'No checklist'}
          </span>
        </div>

        {variant === 'completed' ? (
          <div className="task-board__meta-item">
            <span className="task-board__chip">Finished</span>
            <span className="task-board__meta-text">{formatCompletedLabel(task)}</span>
          </div>
        ) : (
          <div className="task-board__meta-item">
            <span className="task-board__chip">Due</span>
            <span className="task-board__meta-text">Today</span>
          </div>
        )}
      </div>

      {variant === 'active' && task?.useTimer ? (
        <div className="task-board__timer-shell">
          <div className="task-board__timer-label">Time left</div>
          <div className="task-board__timer-value">{formatClockDuration(timing.remainingSeconds ?? 0)}</div>
          <div className="task-board__progress-track">
            <div
              className="task-board__progress-fill"
              style={{ width: `${timing.progressPercent}%` }}
            />
          </div>
          <div className="task-board__timer-meta">
            <span>{timing.progressPercent}% done</span>
            <span>{spentLabel || 'Just started'}</span>
          </div>
        </div>
      ) : checklist.total > 0 ? (
        <div className="task-board__checklist-shell">
          <div className="task-board__progress-track task-board__progress-track--soft">
            <div
              className="task-board__progress-fill task-board__progress-fill--soft"
              style={{ width: `${checklist.percent}%` }}
            />
          </div>

          <div className="task-board__checklist-list">
            {task.checklist.map((item) => (
              <label key={item.id} className="task-board__checklist-item">
                <input
                  type="checkbox"
                  checked={item.isCompleted === true}
                  disabled={variant === 'completed'}
                  onChange={() => {
                    if (variant !== 'completed') {
                      onToggleChecklistItem?.(task.id, item.id)
                    }
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="task-board__footer">
        <div className="task-board__footer-copy">
          {variant === 'completed' ? (
            <span>{spentLabel || 'Done today'}</span>
          ) : task?.useTimer ? (
            <span>{task.durationMinutes || 0} minute focus block</span>
          ) : (
            <span>Quick win task</span>
          )}
        </div>

        <div className="task-board__actions">
          {variant === 'pending' ? (
            task?.useTimer ? (
              <button
                type="button"
                className="task-board__btn task-board__btn--primary"
                onClick={() => onStartTask?.(task.id)}
              >
                Start task
              </button>
            ) : (
              <button
                type="button"
                className="task-board__btn task-board__btn--primary"
                onClick={() => onCompleteTask?.(task.id, task.title, 'manual')}
              >
                Mark complete
              </button>
            )
          ) : null}

          {variant === 'active' ? (
            <button
              type="button"
              className="task-board__btn task-board__btn--primary"
              onClick={() => onCompleteTask?.(task.id, task.title, 'manual')}
            >
              Finish task
            </button>
          ) : null}

          {typeof onDeleteTask === 'function' && variant !== 'completed' ? (
            <button
              type="button"
              className="task-board__btn task-board__btn--secondary"
              onClick={() => onDeleteTask(task.id)}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function TaskBoard({
  className = '',
  tasksLoading = false,
  pendingTasks = [],
  activeTasks = [],
  completedTasks = [],
  plansById = {},
  goalsById = {},
  onStartTask,
  onCompleteTask,
  onToggleChecklistItem,
  onDeleteTask,
  pendingTitle = 'Pending',
  activeTitle = 'Active',
  completedTitle = 'Completed',
  pendingEmpty = 'No pending tasks.',
  activeEmpty = 'No active task right now.',
  completedEmpty = 'No completed tasks yet.',
}) {
  const [nowMs, setNowMs] = useState(Date.now())
  const autoCompletingIds = useRef(new Set())

  useEffect(() => {
    if (!activeTasks.some((task) => task?.useTimer && task?.startedAt)) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [activeTasks])

  useEffect(() => {
    const activeIds = new Set(activeTasks.map((task) => String(task?.id || '')))

    for (const taskId of [...autoCompletingIds.current]) {
      if (!activeIds.has(taskId)) {
        autoCompletingIds.current.delete(taskId)
      }
    }
  }, [activeTasks])

  const expiredTimedTasks = useMemo(() => {
    return activeTasks.filter((task) => {
      if (!task?.useTimer || !task?.startedAt || !task?.durationMinutes) return false
      const timing = getTaskTiming(task, nowMs)
      return timing.remainingSeconds === 0
    })
  }, [activeTasks, nowMs])

  useEffect(() => {
    expiredTimedTasks.forEach((task) => {
      const taskId = String(task.id)
      if (autoCompletingIds.current.has(taskId)) return

      autoCompletingIds.current.add(taskId)
      Promise.resolve(onCompleteTask?.(task.id, task.title, 'timer')).catch(() => {
        autoCompletingIds.current.delete(taskId)
      })
    })
  }, [expiredTimedTasks, onCompleteTask])

  const sections = [
    {
      key: 'active',
      title: activeTitle,
      emptyText: activeEmpty,
      tasks: activeTasks,
      variant: 'active',
    },
    {
      key: 'pending',
      title: pendingTitle,
      emptyText: pendingEmpty,
      tasks: pendingTasks,
      variant: 'pending',
    },
    {
      key: 'completed',
      title: completedTitle,
      emptyText: completedEmpty,
      tasks: completedTasks,
      variant: 'completed',
    },
  ]

  return (
    <div className={`task-board ${className}`.trim()}>
      <div className="task-board__overview">
        <div className="task-board__overview-pill task-board__overview-pill--active">
          <span className="task-board__overview-label">Doing now</span>
          <strong>{activeTasks.length}</strong>
        </div>
        <div className="task-board__overview-pill task-board__overview-pill--pending">
          <span className="task-board__overview-label">Ready</span>
          <strong>{pendingTasks.length}</strong>
        </div>
        <div className="task-board__overview-pill task-board__overview-pill--completed">
          <span className="task-board__overview-label">Finished</span>
          <strong>{completedTasks.length}</strong>
        </div>
      </div>

      <div className="task-board__sections">
        {sections.map((section) => (
          <section key={section.key} className={`task-board__section task-board__section--${section.variant}`}>
            <div className="task-board__section-header">
              <h3 className="task-board__section-title">{section.title}</h3>
              <span className={`task-board__section-count task-board__section-count--${section.variant}`}>
                {section.tasks.length}
              </span>
            </div>

            {tasksLoading ? (
              <p className="task-board__empty">Loading tasks…</p>
            ) : section.tasks.length === 0 ? (
              <p className="task-board__empty">{section.emptyText}</p>
            ) : (
              <div className="task-board__list">
                {section.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant={section.variant}
                    nowMs={nowMs}
                    plansById={plansById}
                    goalsById={goalsById}
                    onStartTask={onStartTask}
                    onCompleteTask={onCompleteTask}
                    onToggleChecklistItem={onToggleChecklistItem}
                    onDeleteTask={onDeleteTask}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
