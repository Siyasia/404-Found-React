export function getFriendIdentifier(userLike) {
  if (!userLike) return ''

  if (typeof userLike === 'string') {
    return userLike.trim()
  }

  const username = String(userLike.username || userLike.name || '').trim()
  const code = String(userLike.code || '').trim()

  if (!username) return ''
  return code ? `${username}#${code}` : username
}

export function getFriendDisplayName(identifier) {
  const value = getFriendIdentifier(identifier)
  if (!value) return ''
  return value.split('#')[0] || value
}
