export const BADGE_DEFINITIONS = [
  {
    id: 'first_completion',
    label: 'First Step',
    icon: '⭐',
    description: 'Complete your first habit plan.',
    coins: 0,
  },
  {
    id: 'completions_5',
    label: 'Getting Started',
    icon: '🔥',
    description: 'Complete 5 habit-plan checkoffs.',
    coins: 0,
  },
  {
    id: 'streak_3',
    label: '3-Day Streak',
    icon: '✨',
    description: 'Keep a 3-day streak.',
    coins: 0,
  },
  {
    id: 'streak_7',
    label: 'Week Warrior',
    icon: '🌟',
    description: 'Keep a 7-day streak.',
    coins: 50,
  },
  {
    id: 'longest_streak_30',
    label: 'Month Master',
    icon: '🏆',
    description: 'Reach a longest streak of 30 days.',
    coins: 150,
  },

  // milestone-only examples
  {
    id: 'streak_14',
    label: 'Two-Week Hero',
    icon: '💫',
    description: 'Reach a 14-day milestone.',
    coins: 75,
  },
  {
    id: 'streak_21',
    label: 'Three-Week Legend',
    icon: '🚀',
    description: 'Reach a 21-day milestone.',
    coins: 100,
  },
  {
    id: 'streak_30_milestone',
    label: 'Thirty-Day Champion',
    icon: '👑',
    description: 'Hit a 30-day milestone reward.',
    coins: 150,
  },
]

export function getBadgeDefinition(badgeId) {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId) || null
}

export default {
  BADGE_DEFINITIONS,
  getBadgeDefinition,
}
