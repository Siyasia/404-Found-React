function cleanSpeechText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

export function supportsSpeechSynthesis() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

export function speakText(text) {
  if (!supportsSpeechSynthesis()) return

  const message = cleanSpeechText(text)
  if (!message) return

  window.speechSynthesis.cancel()

  const utterance = new window.SpeechSynthesisUtterance(message)
  utterance.rate = 1
  utterance.pitch = 1
  window.speechSynthesis.speak(utterance)
}

export function buildActionPlanSpeech({ name = 'there', sections = [], ownerLabel = 'You' }) {
  const items = sections.flatMap((section) => {
    const cueLabel = cleanSpeechText(section?.label)

    return (section?.items || []).map((item) => ({
      title: cleanSpeechText(item?.title || 'Untitled action plan'),
      subLabel: cleanSpeechText(item?.subLabel),
      detail: cleanSpeechText(item?.detail),
      cueLabel,
      isComplete: !!item?.isComplete,
    }))
  })

  const firstName = cleanSpeechText(name) || 'there'
  const owner = cleanSpeechText(ownerLabel) || 'You'
  const ownerIsYou = owner.toLowerCase() === 'you'
  const total = items.length

  if (!total) {
    return `Hey ${firstName}. ${owner} ${ownerIsYou ? 'do' : 'does'} not have any action plans due today.`
  }

  const done = items.filter((item) => item.isComplete).length
  const remaining = total - done
  const summary = [
    `Hey ${firstName}.`,
    `${owner} ${ownerIsYou ? 'have' : 'has'} ${total} ${pluralize(total, 'action plan')} due today.`,
    `${done} ${done === 1 ? 'is' : 'are'} complete and ${remaining} ${remaining === 1 ? 'is' : 'are'} left.`,
  ]

  const details = items.map((item, index) => {
    const parts = [
      `${index + 1}. ${item.title}.`,
      item.isComplete ? 'Already done.' : 'Still open.',
    ]

    if (item.subLabel) parts.push(item.subLabel)
    if (item.cueLabel && item.cueLabel !== 'No cue') parts.push(`Cue: ${item.cueLabel}.`)
    if (item.detail && item.detail !== 'No extra cue detail') parts.push(item.detail)

    return parts.join(' ')
  })

  return [...summary, ...details].join(' ')
}
