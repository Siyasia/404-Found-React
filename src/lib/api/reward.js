import { getGameProfile, getItem, updateGameProfile } from './game.js'
import { goalList, goalUpdate } from './goals.js'

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
    sourceType: raw?.sourceType === 'goal' ? 'goal' : 'profile',
    sourceGoalId: raw?.sourceGoalId != null ? String(raw.sourceGoalId) : '',
    sourceGoalTitle: raw?.sourceGoalTitle ? String(raw.sourceGoalTitle) : '',
  }
}

function getProfileStoredReward(profile) {
  const profileReward = normalizeActiveReward(profile?.meta?.activeReward)

  if (!profileReward) return null

  return {
    ...profileReward,
    sourceType: 'profile',
    sourceGoalId: '',
    sourceGoalTitle: '',
  }
}

async function clearStoredProfileReward(profile) {
  const nextMeta = {
    ...(profile?.meta || {}),
    activeReward: null,
  }

  await updateGameProfile({ meta: nextMeta })
}

async function getAssignedGoalReward({ userId = null, goals = null, profile = null } = {}) {
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

  return pickAssignedGoalReward(availableGoals, effectiveUserId)
}

export function normalizeActiveReward(raw) {
  if (!raw || typeof raw !== 'object') return null

  const type = raw.type === 'shop' ? 'shop' : 'custom'
  const title = String(raw.title ?? '').trim()
  const costCoins = Number(raw.costCoins ?? 0) || 0
  const shopItemId =
    type === 'shop' && raw.shopItemId != null ? String(raw.shopItemId) : ''

  if (!title || costCoins <= 0) return null

  return {
    type,
    title,
    costCoins,
    shopItemId,
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
    type: rewardType,
    title: goal?.rewardGoalTitle || goal?.savingFor || '',
    costCoins: Number(goal?.rewardGoalCostCoins || 0) || 0,
    shopItemId: rewardShopItemId,
  })

  if (!reward) return null

  return {
    ...reward,
    sourceType: 'goal',
    sourceGoalId: goal?.id != null ? String(goal.id) : '',
    sourceGoalTitle: goal?.title || goal?.goal || '',
  }
}

function pickAssignedGoalReward(goals, userId) {
  if (!Array.isArray(goals) || userId == null) return null

  const matchingGoals = goals.filter(
    (goal) => String(goal?.assigneeId) === String(userId)
  )

  for (let i = matchingGoals.length - 1; i >= 0; i -= 1) {
    const reward = getGoalReward(matchingGoals[i])
    if (reward) return reward
  }

  return null
}

async function resolveRewardInput({ reward = null, userId = null, goals = null } = {}) {
  const rewardFromArg = normalizeRewardWithSource(reward)
  if (rewardFromArg) return rewardFromArg

  return getActiveReward({ userId, goals })
}

async function clearGoalReward(goal) {
  if (!goal?.id) {
    throw new Error('Could not find the reward goal to clear.')
  }

  const nextMeta = {
    ...(goal?.meta || {}),
    rewardType: 'custom',
    rewardShopItemId: '',
  }

  const resp = await goalUpdate(goal.id, {
    ...goal,
    rewardGoalTitle: '',
    rewardGoalCostCoins: 0,
    savingFor: '',
    rewardType: 'custom',
    rewardShopItemId: '',
    meta: nextMeta,
  })

  const ok =
    resp &&
    (resp.status_code === 200 ||
      resp.status === 200 ||
      resp.status_code === '200' ||
      resp.status === '200')

  if (!ok) {
    throw new Error(resp?.error || 'Failed to clear the redeemed goal reward.')
  }
}

export async function getActiveReward({ userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile()
  const profile = readProfile(profileResp)

  const assignedGoalReward = await getAssignedGoalReward({
    userId,
    goals,
    profile,
  })

  const profileReward = getProfileStoredReward(profile)

  // Assigned reward always wins.
  // If an old self/profile reward still exists, clear it so there is truly only one active reward.
  if (assignedGoalReward) {
    if (profileReward) {
      await clearStoredProfileReward(profile)
    }
    return assignedGoalReward
  }

  return profileReward
}

export async function setActiveReward(reward, { userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile()
  const profile = readProfile(profileResp)
  const nextReward = normalizeActiveReward(reward)

  const assignedGoalReward = await getAssignedGoalReward({
    userId,
    goals,
    profile,
  })

  if (assignedGoalReward) {
    throw new Error(
      `You already have an assigned reward: ${assignedGoalReward.title}. Redeem that one first.`
    )
  }

  const nextMeta = {
    ...(profile?.meta || {}),
    activeReward: nextReward,
  }

  await updateGameProfile({ meta: nextMeta })

  return nextReward
}

export async function clearActiveReward({ reward = null, userId = null, goals = null } = {}) {
  const resolvedReward = await resolveRewardInput({ reward, userId, goals })
  if (!resolvedReward) return null

  if (resolvedReward.sourceType === 'goal' && resolvedReward.sourceGoalId) {
    const availableGoals = Array.isArray(goals)
      ? goals
      : extractGoals(await goalList())

    const sourceGoal = availableGoals.find(
      (goal) => String(goal?.id) === String(resolvedReward.sourceGoalId)
    )

    await clearGoalReward(sourceGoal)
    return null
  }

  const profileResp = await getGameProfile()
  const profile = readProfile(profileResp)

  const nextMeta = {
    ...(profile?.meta || {}),
    activeReward: null,
  }

  await updateGameProfile({ meta: nextMeta })
  return null
}

export async function redeemActiveReward({ reward = null, userId = null, goals = null } = {}) {
  const profileResp = await getGameProfile()
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
  const nextMeta = {
    ...(profile?.meta || {}),
    activeReward: activeReward.sourceType === 'profile' ? null : (profile?.meta?.activeReward ?? null),
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
    })

    await clearActiveReward({ reward: activeReward, userId, goals })

    return {
      reward: activeReward,
      spentCoins: activeReward.costCoins,
      remainingCoins: nextCoins,
      purchasedItem: item,
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
  })

  await clearActiveReward({ reward: activeReward, userId, goals })

  return {
    reward: activeReward,
    spentCoins: activeReward.costCoins,
    remainingCoins: nextCoins,
    purchasedItem: null,
    updatedProfile: {
      ...profile,
      coins: nextCoins,
      inventory: currentInventory,
      meta: nextMeta,
    },
  }
}
