import { getGameProfile, getItem, updateGameProfile } from './game.js'
import { goalList } from './goals.js'

function readProfile(resp) {
  return resp?.game_profile ?? resp?.profile ?? resp?.data?.profile ?? null
}

function readItem(resp) {
  return resp?.item ?? resp?.data?.item ?? null
}

function extractGoals(response) {
  if (Array.isArray(response?.goals)) return response.goals
  if (Array.isArray(response?.data?.goals)) return response.data.goals
  if (Array.isArray(response?.data)) return response.data
  return []
}

function normalizeInventory(value) {
  if (Array.isArray(value)) return value.slice()

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function hasInventoryItem(inventory, itemId) {
  return inventory.some((entry) =>
    String(entry?.id ?? entry?.itemId ?? '') === String(itemId)
  )
}

function normalizeRewardWithSource(raw) {
  const normalized = normalizeActiveReward(raw)
  if (!normalized) return null

  return {
    ...normalized,
    sourceType: raw?.sourceType === 'goal' ? 'goal' : (raw?.sourceType || 'profile'),
    sourceGoalId: raw?.sourceGoalId != null ? String(raw.sourceGoalId) : (raw?.goalId != null ? String(raw.goalId) : ''),
    sourceGoalTitle: raw?.sourceGoalTitle ? String(raw.sourceGoalTitle) : '',
    status: raw?.status || 'active',
  }
}

function getProfileStoredReward(profile) {
  const profileReward = normalizeRewardWithSource(profile?.meta?.activeReward)

  if (!profileReward || profileReward.status !== 'active') return null

  return {
    ...profileReward,
    sourceType: profileReward.sourceType || 'profile',
  }
}

async function getAssignedGoalReward({ userId = null, goals = null, profile = null, rewardHistory = {} } = {}) {
  const effectiveUserId =
    userId ??
    profile?.userId ??
    profile?.ownerUserId ??
    profile?.id ??
    null

  if (effectiveUserId == null) return null

  const availableGoals = Array.isArray(goals)
    ? goals
    : extractGoals(await goalList())

  return pickAssignedGoalReward(availableGoals, effectiveUserId, rewardHistory)
}

export function normalizeActiveReward(raw) {
  if (!raw || typeof raw !== 'object') return null

  const type = raw.type === 'shop' ? 'shop' : 'custom'
  const title = String(raw.title ?? '').trim()
  const costCoins = Number(raw.costCoins ?? 0) || 0
  const shopItemId =
    type === 'shop' && raw.shopItemId != null ? String(raw.shopItemId) : ''

  if (!title || costCoins <= 0) return null

  const goalId = raw.goalId ?? raw.sourceGoalId ?? null
  const fallbackId = goalId != null
    ? `goal:${goalId}:reward`
    : `custom:${title.toLowerCase().replace(/\s+/g, '-')}:${costCoins}`

  return {
    id: raw.id ? String(raw.id) : fallbackId,
    goalId,
    type,
    title,
    costCoins,
    shopItemId,
    sourceType: raw.sourceType || (goalId != null ? 'goal' : 'profile'),
    status: raw.status || 'active',
  }
}

export function buildActiveRewardFromPayload(payload) {
  const type =
    payload?.rewardType === 'shop' && payload?.rewardShopItemId
      ? 'shop'
      : 'custom'

  const title = String(
    payload?.rewardGoalTitle || payload?.savingFor || ''
  ).trim()

  const costCoins = Number(payload?.rewardGoalCostCoins || 0) || 0

  const shopItemId =
    type === 'shop' ? String(payload?.rewardShopItemId || '') : ''

  return normalizeActiveReward({
    id: payload?.id || payload?.goalId ? `goal:${payload.id || payload.goalId}:reward` : undefined,
    goalId: payload?.id || payload?.goalId || null,
    sourceType: payload?.id || payload?.goalId ? 'goal' : 'profile',
    type,
    title,
    costCoins,
    shopItemId,
  })
}

function getGoalReward(goal) {
  if (!goal || typeof goal !== 'object') return null

  const rewardType =
    goal?.rewardType ||
    goal?.meta?.rewardType ||
    (goal?.rewardShopItemId || goal?.meta?.rewardShopItemId ? 'shop' : 'custom')

  const rewardShopItemId =
    goal?.rewardShopItemId ||
    goal?.meta?.rewardShopItemId ||
    ''

  const reward = normalizeActiveReward({
    goalId: goal?.id ?? null,
    sourceType: 'goal',
    type: rewardType,
    title: goal?.rewardGoalTitle || goal?.savingFor || '',
    costCoins: Number(goal?.rewardGoalCostCoins || 0) || 0,
    shopItemId: rewardShopItemId,
  })

  if (!reward) return null

  return {
    ...reward,
    id: goal?.id != null ? `goal:${goal.id}:reward` : reward.id,
    goalId: goal?.id ?? null,
    sourceType: 'goal',
    sourceGoalId: goal?.id != null ? String(goal.id) : '',
    sourceGoalTitle: goal?.title || goal?.goal || '',
  }
}

function pickAssignedGoalReward(goals, userId, rewardHistory = {}) {
  const rewards = listAssignedGoalRewards(goals, userId, rewardHistory)
  return rewards.length ? rewards[rewards.length - 1] : null
}

export function listAssignedGoalRewards(goals, userId, rewardHistory = {}) {
  if (!Array.isArray(goals) || userId == null) return []

  return goals
    .filter((goal) => String(goal?.assigneeId) === String(userId))
    .map((goal) => getGoalReward(goal))
    .filter(Boolean)
    .filter((reward) => {
      const historyEntry = reward?.id ? rewardHistory[reward.id] : null
      return !(
        historyEntry?.status === 'redeemed' ||
        historyEntry?.status === 'dismissed'
      )
    })
}

async function resolveRewardInput({ reward = null, userId = null, goals = null } = {}) {
  const rewardFromArg = normalizeRewardWithSource(reward)
  if (rewardFromArg) return rewardFromArg

  return getActiveReward({ userId, goals })
}

export async function getActiveReward({ userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)
  const meta = profile?.meta && typeof profile.meta === 'object' ? profile.meta : {}

  const profileReward = getProfileStoredReward(profile)
  if (profileReward) {
    return profileReward
  }

  const rewardHistory =
    meta.rewardHistory && typeof meta.rewardHistory === 'object'
      ? meta.rewardHistory
      : {}

  return getAssignedGoalReward({
    userId,
    goals,
    profile,
    rewardHistory,
  })
}

export async function getAvailableRewards({ userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)
  const meta = profile?.meta && typeof profile.meta === 'object' ? profile.meta : {}
  const rewardHistory =
    meta.rewardHistory && typeof meta.rewardHistory === 'object'
      ? meta.rewardHistory
      : {}

  const availableGoals = Array.isArray(goals)
    ? goals
    : extractGoals(await goalList())

  return listAssignedGoalRewards(availableGoals, userId, rewardHistory)
}

export async function setActiveReward(reward, { userId = null } = {}) {
  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)
  const nextReward = normalizeRewardWithSource(reward)

  const nextMeta = {
    ...(profile?.meta || {}),
    activeReward: nextReward ? { ...nextReward, status: 'active' } : null,
  }

  await updateGameProfile({ meta: nextMeta }, userId)

  return nextMeta.activeReward
}

export async function reactivateReward(reward, { userId = null } = {}) {
  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)
  const nextReward = normalizeRewardWithSource(reward)

  const meta = profile?.meta && typeof profile.meta === 'object' ? { ...profile.meta } : {}
  const rewardHistory =
    meta.rewardHistory && typeof meta.rewardHistory === 'object'
      ? { ...meta.rewardHistory }
      : {}

  if (nextReward?.id && rewardHistory[nextReward.id]) {
    delete rewardHistory[nextReward.id]
  }

  const nextMeta = {
    ...meta,
    activeReward: nextReward ? { ...nextReward, status: 'active' } : null,
    rewardHistory,
  }

  await updateGameProfile({ meta: nextMeta }, userId)
  return nextMeta.activeReward
}

export async function clearActiveReward({ reward = null, userId = null, goals = null } = {}) {
  const resolvedReward = await resolveRewardInput({ reward, userId, goals })
  if (!resolvedReward) return null

  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)
  const meta = profile?.meta && typeof profile.meta === 'object' ? { ...profile.meta } : {}
  const rewardHistory =
    meta.rewardHistory && typeof meta.rewardHistory === 'object'
      ? { ...meta.rewardHistory }
      : {}

  if (resolvedReward.id) {
    rewardHistory[resolvedReward.id] = {
      ...(rewardHistory[resolvedReward.id] || {}),
      status: 'dismissed',
      dismissedAt: new Date().toISOString(),
      goalId: resolvedReward.goalId ?? resolvedReward.sourceGoalId ?? null,
      title: resolvedReward.title || '',
      costCoins: Number(resolvedReward.costCoins || 0),
    }
  }

  const nextMeta = {
    ...meta,
    activeReward: null,
    rewardHistory,
  }

  await updateGameProfile({ meta: nextMeta }, userId)
  return null
}

export async function redeemActiveReward({ reward = null, userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile(userId)
  const profile = readProfile(profileResp)

  if (!profile) {
    throw new Error('Could not load your profile.')
  }

  const activeReward = await resolveRewardInput({ reward, userId, goals })

  if (!activeReward) {
    throw new Error('No active reward to redeem yet.')
  }

  const currentCoins = Number(profile?.coins || 0) || 0
  if (currentCoins < activeReward.costCoins) {
    throw new Error('You do not have enough coins to redeem this reward yet.')
  }

  const nextCoins = currentCoins - activeReward.costCoins
  const meta = profile?.meta && typeof profile.meta === 'object' ? { ...profile.meta } : {}
  const rewardHistory =
    meta.rewardHistory && typeof meta.rewardHistory === 'object'
      ? { ...meta.rewardHistory }
      : {}

  rewardHistory[activeReward.id] = {
    status: 'redeemed',
    redeemedAt: new Date().toISOString(),
    goalId: activeReward.goalId ?? activeReward.sourceGoalId ?? null,
    title: activeReward.title || '',
    costCoins: activeReward.costCoins,
  }

  const nextMeta = {
    ...meta,
    activeReward: null,
    rewardHistory,
  }

  const currentInventory = normalizeInventory(profile?.inventory)

  if (activeReward.type === 'shop') {
    if (!activeReward.shopItemId) {
      throw new Error('This shop reward is missing an item.')
    }

    const itemResp = await getItem(activeReward.shopItemId)
    const item = readItem(itemResp)

    if (!item?.id) {
      throw new Error('Could not find that shop item.')
    }

    if (hasInventoryItem(currentInventory, item.id)) {
      throw new Error(`You already own ${item.name || 'this item'}.`)
    }

    const nextInventory = [
      ...currentInventory,
      {
        id: item.id,
        equipped: false,
        color: 1,
      },
    ]

    await updateGameProfile({
      coins: nextCoins,
      inventory: nextInventory,
      meta: nextMeta,
    }, userId)

    return {
      reward: activeReward,
      spentCoins: activeReward.costCoins,
      remainingCoins: nextCoins,
      purchasedItem: item,
      activeReward: null,
      updatedProfile: {
        ...profile,
        coins: nextCoins,
        inventory: nextInventory,
        meta: nextMeta,
      },
    }
  }

  await updateGameProfile({
    coins: nextCoins,
    meta: nextMeta,
  }, userId)

  return {
    reward: activeReward,
    spentCoins: activeReward.costCoins,
    remainingCoins: nextCoins,
    purchasedItem: null,
    activeReward: null,
    updatedProfile: {
      ...profile,
      coins: nextCoins,
      inventory: currentInventory,
      meta: nextMeta,
    },
  }
}
