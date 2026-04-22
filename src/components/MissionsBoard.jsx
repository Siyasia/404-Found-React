import React from 'react'
import './MissionsBoard.css'

function formatCompletedAt(value) {
  if (!value) return 'Completed'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Completed'

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTaskStatus(task) {
  const safe = String(task?.status || '').toLowerCase()
  if (safe === 'active') return 'active'
  if (safe === 'completed' || safe === 'done') return 'completed'
  return 'pending'
}

function getTaskMeta(task, showAssignee = false) {
  const bits = []

  if (showAssignee && task?.assigneeName) {
    bits.push(task.assigneeName)
  }

  if (task?.useTimer && task?.durationMinutes) {
    bits.push(`${task.durationMinutes} min`)
  } else {
    bits.push('Quick task')
  }

  const checklistCount = Array.isArray(task?.checklist) ? task.checklist.length : 0
  if (checklistCount > 0) {
    bits.push(`${checklistCount} step${checklistCount === 1 ? '' : 's'}`)
  }

  return bits.join(' • ')
}

function ReadyTaskCard({ task, showAssignee, onOpenTask, onStartTask, onCompleteTask, onDeleteTask }) {
  const status = getTaskStatus(task)
  const isTimedPending = status === 'pending' && task?.useTimer
  const isQuickPending = status === 'pending' && !task?.useTimer

  return (
    <article className={`missions-board__task-card missions-board__task-card--${status}`}>
      <div className="missions-board__task-copy">
        <h4 className="missions-board__task-title app-card-title">{task?.title || 'Untitled task'}</h4>
        {task?.note ? <p className="missions-board__task-note app-helper-text">{task.note}</p> : null}
        <div className="missions-board__meta app-micro-text">{getTaskMeta(task, showAssignee)}</div>
      </div>

      <div className="missions-board__actions">
        <button
          type="button"
          className="missions-board__btn missions-board__btn--ghost app-button-label"
          onClick={() => onOpenTask?.(task.id)}
        >
          Open
        </button>

        {status === 'active' ? (
          <button
            type="button"
            className="missions-board__btn missions-board__btn--primary app-button-label"
            onClick={() => onOpenTask?.(task.id)}
          >
            Continue
          </button>
        ) : null}

        {isTimedPending ? (
          <button
            type="button"
            className="missions-board__btn missions-board__btn--primary app-button-label"
            onClick={() => onStartTask?.(task.id)}
          >
            Start
          </button>
        ) : null}

        {isQuickPending ? (
          <button
            type="button"
            className="missions-board__btn missions-board__btn--primary app-button-label"
            onClick={() => onCompleteTask?.(task.id, task.title, 'manual')}
          >
            Complete
          </button>
        ) : null}

        {typeof onDeleteTask === 'function' ? (
          <button
            type="button"
            className="missions-board__btn missions-board__btn--danger app-button-label"
            onClick={() => onDeleteTask(task.id)}
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  )
}

function FinishedTaskCard({ task, showAssignee, onOpenTask }) {
  return (
    <article className="missions-board__task-card missions-board__task-card--completed">
      <div className="missions-board__task-copy">
        <h4 className="missions-board__task-title app-card-title">{task?.title || 'Untitled task'}</h4>
        <div className="missions-board__meta app-micro-text">
          {showAssignee && task?.assigneeName ? `${task.assigneeName} • ` : ''}
          {formatCompletedAt(task?.completedAt)}
        </div>
      </div>

      <div className="missions-board__actions">
        <button
          type="button"
          className="missions-board__btn missions-board__btn--ghost app-button-label"
          onClick={() => onOpenTask?.(task.id)}
        >
          View
        </button>
      </div>
    </article>
  )
}

export default function MissionsBoard({
  title = 'Your missions',
  primaryActionLabel = null,
  onPrimaryAction,
  activeTasks = [],
  pendingTasks = [],
  completedTasks = [],
  onOpenTask,
  onStartTask,
  onCompleteTask,
  onDeleteTask,
  showAssignee = false,
  emptyReadyText = 'Nothing is waiting right now.',
  emptyFinishedText = 'No finished missions yet.',
}) {
  const readyTasks = [...activeTasks, ...pendingTasks]
  const finishedTasks = completedTasks.slice(0, 4)

  return (
    <section className="missions-board">
      <div className="missions-board__header">
        <h3 className="missions-board__title app-section-title">{title}</h3>
        {primaryActionLabel ? (
          <button
            type="button"
            className="missions-board__header-btn app-button-label"
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
          </button>
        ) : null}
      </div>

      <div className="missions-board__columns">
        <section className="missions-board__column">
          <div className="missions-board__column-title app-meta-label">Ready to start / assigned</div>
          <div className="missions-board__list">
            {readyTasks.length === 0 ? (
              <p className="missions-board__empty app-helper-text">{emptyReadyText}</p>
            ) : (
              readyTasks.map((task, index) => (
                <ReadyTaskCard
                  key={`ready-task-${task.id || task.tempId || index}`}
                  task={task}
                  showAssignee={showAssignee}
                  onOpenTask={onOpenTask}
                  onStartTask={onStartTask}
                  onCompleteTask={onCompleteTask}
                  onDeleteTask={onDeleteTask}
                />
              ))
            )}
          </div>
        </section>

        <section className="missions-board__column missions-board__column--finished">
          <div className="missions-board__column-title app-meta-label">Last 4 finished</div>
          <div className="missions-board__list">
            {finishedTasks.length === 0 ? (
              <p className="missions-board__empty app-helper-text">{emptyFinishedText}</p>
            ) : (
              finishedTasks.map((task, index) => (
                <FinishedTaskCard
                  key={`finished-task-${task.id || task.tempId || index}`}
                  task={task}
                  showAssignee={showAssignee}
                  onOpenTask={onOpenTask}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
