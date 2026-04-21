import { useCallback, useEffect, useState } from 'react'
import { friendsList } from '../api/friends.js'

const FRIEND_REQUESTS_EVENT = 'friends:requests-refresh'

export function emitFriendRequestsRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FRIEND_REQUESTS_EVENT))
}

export function useFriendRequests(pollInterval = 30000, enabled = true) {
  const [pendingCount, setPendingCount] = useState(0)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!enabled) {
      setRequests([])
      setPendingCount(0)
      setLoading(false)
      return { status: 200, data: { requests: [] } }
    }

    try {
      const res = await friendsList()
      if (res.status === 200) {
        const pending = Array.isArray(res.data?.requests) ? res.data.requests : []
        setRequests(pending)
        setPendingCount(pending.length)
      }
      return res
    } catch (error) {
      console.error('Failed to fetch friend requests', error)
      return { status: 500, data: { requests: [] } }
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchRequests()

    function handleRefreshEvent() {
      fetchRequests()
    }

    const interval = window.setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchRequests()
      }
    }, pollInterval)

    window.addEventListener(FRIEND_REQUESTS_EVENT, handleRefreshEvent)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener(FRIEND_REQUESTS_EVENT, handleRefreshEvent)
    }
  }, [pollInterval, fetchRequests])

  return { pendingCount, requests, loading, refetch: fetchRequests }
}
