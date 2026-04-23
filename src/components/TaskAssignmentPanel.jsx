import React, { useMemo, useState } from 'react'
import { taskCreate, taskCreateMany } from '../lib/api/tasks.js'
import './TaskAssignmentPanel.css'

function toId(value) {
  if (value == null) return ''
  return String(value)
}

function getDisplayName(user) {
  if (!user) return ''
  return user.name || user.fullName || user.username || user.email || ''
}

function normalizeActionPlanOptions(options = []) {
  if (!Array.isArray(options)) return []

  return options
    .map((item) => {
      if (!item) return null
      const id = toId(item.id ?? item.value)
      if (!id) return null

      return {
        id,
        title: item.title || item.name || item.label || 'Untitled action plan',
        label: item.label || item.displayLabel || item.title || item.name || 'Untitled action plan',
        goalId: item.goalId ?? null,
        notes: item.notes ?? '',
      }
    })
    .filter(Boolean)
}

function normalizeAssigneeOptions(options = []) {
  if (!Array.isArray(options)) return []

  return options
    .map((item) => {
      if (!item) return null
      const id = toId(item.id ?? item.userId ?? item.assigneeId ?? item.value)
      if (!id) return null

      const name = item.name || item.assigneeName || item.displayName || item.label || 'Unnamed'
      return {
        id,
        name,
        label: item.label || name,
      }
    })
    .filter(Boolean)
}

function cleanChecklistRows(rows = []) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => String(row || '').trim()).filter(Boolean)
}

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

export default function TaskAssignmentPanel({
  mode = 'self',
  currentUser = null,
  actionPlanOptions = [],
  assigneeOptions = [],
  onCreated = null,
  onCancel = null,
  title: panelTitle,
  submitLabel,
  className = '',
}) {
  const normalizedActionPlans = useMemo(
    () => normalizeActionPlanOptions(actionPlanOptions),
    [actionPlanOptions]
  )
  const normalizedAssignees = useMemo(
    () => normalizeAssigneeOptions(assigneeOptions),
    [assigneeOptions]
  )

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [linkedActionPlanId, setLinkedActionPlanId] = useState('')
  const [useTimer, setUseTimer] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [checklistRows, setChecklistRows] = useState([''])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isParentMode = mode === 'parent'
  const selectedActionPlan = normalizedActionPlans.find((plan) => plan.id === linkedActionPlanId) || null
  const displayName = getDisplayName(currentUser)

  function resetForm() {
    setTitle('')
    setNote('')
    setLinkedActionPlanId('')
    setUseTimer(false)
    setDurationMinutes(15)
    setChecklistRows([''])
    setSelectedAssigneeIds([])
    setError('')
  }

  function handleChecklistChange(index, value) {
    setChecklistRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? value : row)))
  }

  function handleAddChecklistRow() {
    setChecklistRows((prev) => [...prev, ''])
  }

  function handleRemoveChecklistRow(index) {
    setChecklistRows((prev) => (prev.length === 1 ? [''] : prev.filter((_, rowIndex) => rowIndex !== index)))
  }

  function handleLinkedActionPlanChange(event) {
    const nextId = event.target.value
    setLinkedActionPlanId(nextId)

    const matched = normalizedActionPlans.find((item) => item.id === nextId) || null
    if (!matched) return

    if (!title.trim()) setTitle(matched.title || '')
    if (!note.trim() && matched.notes) setNote(matched.notes)
  }

  function handleAssigneeMultiSelect(event) {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value)
    setSelectedAssigneeIds(values)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!currentUser || !toId(currentUser.id)) {
      setError('Missing current user. Reload and try again.')
      return
    }

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Please enter a task title.')
      return
    }

    if (isParentMode && selectedAssigneeIds.length === 0) {
      setError('Please select at least one person to assign this to.')
      return
    }

    const checklist = cleanChecklistRows(checklistRows)
    const createdByName = getDisplayName(currentUser)
    const createdByRole =
      currentUser?.role || currentUser?.type || (mode === 'parent' ? 'parent' : 'user')

    const basePayload = {
      title: trimmedTitle,
      note: note.trim(),
      linkedActionPlanId: linkedActionPlanId || null,
      linkedGoalId: selectedActionPlan?.goalId ?? null,
      useTimer,
      durationMinutes: useTimer ? Number(durationMinutes) : null,
      checklist,
      createdById: toId(currentUser.id),
      createdByName,
      createdByRole,
      needsApproval: createdByRole === 'provider',
    }

    try {
      setSaving(true)

      if (isParentMode) {
        const selectedAssignees = normalizedAssignees.filter((person) => selectedAssigneeIds.includes(person.id))
        const response = await taskCreateMany(basePayload, selectedAssignees)

        if (!response || response.status_code >= 400) {
          throw new Error(response?.error || 'Unable to create tasks.')
        }

        resetForm()
        onCreated?.(response?.data?.tasks || [])
      } else {
        const response = await taskCreate({
          ...basePayload,
          assigneeId: toId(currentUser.id),
          assigneeName: createdByName,
        })

        if (!response || response.status_code >= 400) {
          throw new Error(response?.error || 'Unable to create task.')
        }

        resetForm()
        onCreated?.(response?.data?.task || null)
      }
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  const finalPanelTitle = panelTitle || (isParentMode ? 'Task assignment' : 'Task builder')
  const finalSubmitLabel = submitLabel || (isParentMode ? 'Assign task' : 'Create task')

  return (
    <section className={`task-assignment-panel ${className}`.trim()}>
      <form className="task-assignment-panel__form" onSubmit={handleSubmit}>
        <div className="task-assignment-panel__header">
          <h3 className="task-assignment-panel__title">{finalPanelTitle}</h3>
        </div>

        <div className="task-assignment-panel__top-row">
          <label className="task-assignment-panel__field">
            <span className="task-assignment-panel__label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Finish math worksheet"
              disabled={saving}
            />
          </label>

          <label className="task-assignment-panel__field">
            <span className="task-assignment-panel__label">Link to action plan</span>
            <select
              value={linkedActionPlanId}
              onChange={handleLinkedActionPlanChange}
              disabled={saving}
            >
              <option value="">None</option>
              {normalizedActionPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="task-assignment-panel__body">
          <div className="task-assignment-panel__left">
            <section className="task-assignment-panel__box task-assignment-panel__box--assign">
              <div className="task-assignment-panel__box-title">Assign to</div>

              {isParentMode ? (
                <>
                  <select
                    multiple
                    value={selectedAssigneeIds}
                    onChange={handleAssigneeMultiSelect}
                    disabled={saving}
                    className="task-assignment-panel__multi"
                  >
                    {normalizedAssignees.map((person) => (
                      <option key={person.id} value={person.id}>{person.label}</option>
                    ))}
                  </select>
                  <div className="task-assignment-panel__hint">Hold command or control to select multiple people.</div>
                </>
              ) : (
                <div className="task-assignment-panel__for-you">For: {displayName || 'You'}</div>
              )}
            </section>

            <section className="task-assignment-panel__box task-assignment-panel__box--timer">
              <div className="task-assignment-panel__box-title">Timer setup</div>

              <label className="task-assignment-panel__toggle">
                <input
                  type="checkbox"
                  checked={useTimer}
                  onChange={(event) => setUseTimer(event.target.checked)}
                  disabled={saving}
                />
                <span>Use timer</span>
              </label>

              {useTimer ? (
                <select
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  disabled={saving}
                  className="task-assignment-panel__timer-select"
                >
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} min</option>
                  ))}
                </select>
              ) : (
                <div className="task-assignment-panel__helper">This mission will be a quick manual task.</div>
              )}

              <label className="task-assignment-panel__field task-assignment-panel__field--notes">
                <span className="task-assignment-panel__label">Instructions</span>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note or instructions"
                  disabled={saving}
                />
              </label>
            </section>
          </div>

          <section className="task-assignment-panel__box task-assignment-panel__box--checklist">
            <div className="task-assignment-panel__box-title">Checklist</div>

            <div className="task-assignment-panel__checklist-list">
              {checklistRows.map((row, index) => (
                <div key={`checklist-row-${index}`} className="task-assignment-panel__checklist-row">
                  <input
                    type="text"
                    value={row}
                    onChange={(event) => handleChecklistChange(index, event.target.value)}
                    placeholder={`Step ${index + 1}`}
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="task-assignment-panel__small-btn"
                    onClick={() => handleRemoveChecklistRow(index)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="task-assignment-panel__link-btn"
              onClick={handleAddChecklistRow}
              disabled={saving}
            >
              + Add step
            </button>
          </section>
        </div>

        <div className="task-assignment-panel__footer">
          <div className="task-assignment-panel__footer-left">
            {error ? <div className="task-assignment-panel__error">{error}</div> : null}
            {typeof onCancel === 'function' ? (
              <button type="button" className="task-assignment-panel__cancel" onClick={onCancel}>
                Back
              </button>
            ) : null}
          </div>

          <div className="task-assignment-panel__footer-right">
            <button type="submit" className="task-assignment-panel__submit" disabled={saving}>
              {saving ? 'Saving…' : finalSubmitLabel}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
