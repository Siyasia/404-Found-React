import React, { useMemo, useState } from 'react'
import {
  taskCreate,
  taskCreateMany,
} from '../lib/api/tasks.js'
import './TaskComposer.css'

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

      const title = item.title || item.name || item.label || 'Untitled action plan'
      const label = item.label || item.displayLabel || title

      return {
        id,
        title,
        label,
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

  return rows
    .map((row) => String(row || '').trim())
    .filter(Boolean)
}

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

export default function TaskComposer({
  mode = 'self',
  currentUser = null,
  actionPlanOptions = [],
  assigneeOptions = [],
  onCreated = null,
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
  const [useChecklist, setUseChecklist] = useState(false)
  const [checklistRows, setChecklistRows] = useState([''])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isParentMode = mode === 'parent'
  const selectedActionPlan =
    normalizedActionPlans.find((plan) => plan.id === linkedActionPlanId) || null

  function resetForm() {
    setTitle('')
    setNote('')
    setLinkedActionPlanId('')
    setUseTimer(false)
    setDurationMinutes(15)
    setUseChecklist(false)
    setChecklistRows([''])
    setSelectedAssigneeIds([])
    setError('')
  }

  function handleChecklistChange(index, value) {
    setChecklistRows((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function handleAddChecklistRow() {
    setChecklistRows((prev) => [...prev, ''])
  }

  function handleRemoveChecklistRow(index) {
    setChecklistRows((prev) => {
      if (prev.length === 1) return ['']
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleChecklistToggle(checked) {
    setUseChecklist(checked)

    if (checked && (!Array.isArray(checklistRows) || checklistRows.length === 0)) {
      setChecklistRows([''])
    }
  }

  function handleLinkedActionPlanChange(event) {
    const nextId = event.target.value
    setLinkedActionPlanId(nextId)

    const matched = normalizedActionPlans.find((item) => item.id === nextId) || null
    if (!matched) return

    if (!title.trim()) {
      setTitle(matched.title || '')
    }

    if (!note.trim() && matched.notes) {
      setNote(matched.notes)
    }
  }

  function handleAssigneeMultiSelect(event) {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value)
    setSelectedAssigneeIds(values)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!currentUser || !toId(currentUser.id)) {
      setError('Missing current user. Reload and try again.')
      return
    }

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Please enter a task title.')
      return
    }

    if (useTimer && (!durationMinutes || Number(durationMinutes) <= 0)) {
      setError('Please choose a valid timer duration.')
      return
    }

    if (isParentMode && selectedAssigneeIds.length === 0) {
      setError('Please select at least one person to assign this to.')
      return
    }

    const checklist = useChecklist ? cleanChecklistRows(checklistRows) : []
    const createdByName = getDisplayName(currentUser)
    const createdByRole =
      mode === 'parent'
        ? 'parent'
        : (currentUser.role || currentUser.type || 'user')

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
    }

    try {
      setSaving(true)

      if (isParentMode) {
        const selectedAssignees = normalizedAssignees.filter((person) =>
          selectedAssigneeIds.includes(person.id)
        )

        const response = await taskCreateMany(basePayload, selectedAssignees)

        if (!response || response.status_code >= 400) {
          throw new Error(response?.error || 'Unable to create tasks.')
        }

        const createdTasks = response?.data?.tasks || []
        resetForm()
        setSuccess(createdTasks.length === 1 ? 'Task sent.' : `${createdTasks.length} tasks sent.`)

        if (typeof onCreated === 'function') {
          onCreated(createdTasks)
        }
      } else {
        const response = await taskCreate({
          ...basePayload,
          assigneeId: toId(currentUser.id),
          assigneeName: createdByName,
        })

        if (!response || response.status_code >= 400) {
          throw new Error(response?.error || 'Unable to create task.')
        }

        const createdTask = response?.data?.task || null
        resetForm()
        setSuccess('Task created.')

        if (typeof onCreated === 'function') {
          onCreated(createdTask)
        }
      }
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  const finalPanelTitle = panelTitle || (isParentMode ? 'Assign a task' : 'Create a task')
  const finalSubmitLabel = submitLabel || (isParentMode ? 'Send task' : 'Create task')

  return (
    <section className={`ns-task-composer ${className}`.trim()}>
      <div className="ns-task-composer__header">
        <div>
          <h3 className="ns-task-composer__title">{finalPanelTitle}</h3>
          <p className="ns-task-composer__subtitle">
            {isParentMode ? 'Assign one task to one or more people.' : 'Create a task for yourself.'}
          </p>
        </div>
      </div>

      <form className="ns-task-composer__form" onSubmit={handleSubmit}>
        <div className="ns-task-composer__grid">
          <label className="ns-task-composer__field">
            <span className="ns-task-composer__label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Finish math worksheet"
              disabled={saving}
            />
          </label>

          <label className="ns-task-composer__field">
            <span className="ns-task-composer__label">Link to action plan</span>
            <select
              value={linkedActionPlanId}
              onChange={handleLinkedActionPlanChange}
              disabled={saving}
            >
              <option value="">None</option>
              {normalizedActionPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </label>

          {isParentMode ? (
            <label className="ns-task-composer__field ns-task-composer__field--full">
              <span className="ns-task-composer__label">Assign to</span>
              <select
                multiple
                value={selectedAssigneeIds}
                onChange={handleAssigneeMultiSelect}
                disabled={saving}
                className="ns-task-composer__multi"
              >
                {normalizedAssignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
              <span className="ns-task-composer__hint">
                Hold command or control to select multiple people.
              </span>
            </label>
          ) : null}

          <label className="ns-task-composer__field ns-task-composer__field--full">
            <span className="ns-task-composer__label">Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note or instructions"
              disabled={saving}
            />
          </label>
        </div>

        <div className="ns-task-composer__inline-options">
          <div className="ns-task-composer__inline-option">
            <label className="ns-task-composer__checkbox">
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
                className="ns-task-composer__mini-select"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                disabled={saving}
              >
                {DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="ns-task-composer__inline-option">
            <label className="ns-task-composer__checkbox">
              <input
                type="checkbox"
                checked={useChecklist}
                onChange={(event) => handleChecklistToggle(event.target.checked)}
                disabled={saving}
              />
              <span>Checklist</span>
            </label>
          </div>
        </div>

        {useChecklist ? (
          <div className="ns-task-composer__checklist-box">
            <div className="ns-task-composer__checklist-list">
              {checklistRows.map((row, index) => (
                <div key={`checklist-row-${index}`} className="ns-task-composer__checklist-row">
                  <input
                    type="text"
                    value={row}
                    onChange={(event) => handleChecklistChange(index, event.target.value)}
                    placeholder={`Step ${index + 1}`}
                    disabled={saving}
                  />

                  <button
                    type="button"
                    className="ns-task-composer__icon-btn"
                    onClick={() => handleRemoveChecklistRow(index)}
                    disabled={saving}
                    aria-label={`Remove step ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="ns-task-composer__text-btn"
              onClick={handleAddChecklistRow}
              disabled={saving}
            >
              + Add step
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="ns-task-composer__message ns-task-composer__message--error">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="ns-task-composer__message ns-task-composer__message--success">
            {success}
          </div>
        ) : null}

        <div className="ns-task-composer__actions">
          <button type="submit" className="ns-task-composer__submit" disabled={saving}>
            {saving ? 'Saving...' : finalSubmitLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
