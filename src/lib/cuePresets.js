export const CUE_PRESETS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afterschool', label: 'After school' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'afterdinner', label: 'After dinner' },
  { key: 'evening', label: 'Evening' },
  { key: 'bedtime', label: 'Bedtime' },
]

export function getCueLabel(key) {
  const match = CUE_PRESETS.find((item) => item.key === key)
  return match?.label || ''
}
