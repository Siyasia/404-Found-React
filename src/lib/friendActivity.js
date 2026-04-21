const ACTIVITY_KEY = 'friend_activity'

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readActivities() {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to read friend activity', error)
    return []
  }
}

function writeActivities(activities) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities))
  } catch (error) {
    console.error('Failed to save friend activity', error)
  }
}

export function logFriendActivity(friendUsername, action, planTitle) {
  if (!friendUsername || !action || !planTitle) return

  const activities = readActivities()
  activities.unshift({
    id: Date.now(),
    friend: friendUsername,
    action,
    planTitle,
    timestamp: new Date().toISOString(),
  })

  writeActivities(activities.slice(0, 50))
}

export function getFriendActivity(friendUsername) {
  return readActivities().filter((activity) => activity.friend === friendUsername)
}

export function getAllRecentActivity(limit = 20) {
  return readActivities().slice(0, limit)
}
