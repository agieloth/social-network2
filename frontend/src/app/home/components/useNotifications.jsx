// src/hooks/useNotifications.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavbar } from '../../../contexts/NavBarContext'

export function useNotifications(user, sendMessage) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  // try to get global unread setter from NavBarContext (may throw if provider missing)
  let setGlobalUnread = null
  try {
    const navbar = useNavbar()
    setGlobalUnread = navbar.setUnreadCount
  } catch (e) {
    setGlobalUnread = null
  }
  const notificationsRef = useRef(null)
  const notificationButtonRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8080/api/notifications", { credentials: 'include' })
      const data = await res.json()

      const uniqueNotifs = []
      const seenKeys = new Set()

      for (const notif of data) {
        const key = `${notif.sender_id}-${notif.message}-${notif.type}`
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          uniqueNotifs.push(notif)
        }
      }

      setNotifications(uniqueNotifs)
      const count = uniqueNotifs.filter(n => !n.seen).length
      setUnreadCount(count)
      if (setGlobalUnread) setGlobalUnread(count)
    } catch (err) {
      console.error("Erreur récupération notifications", err)
    }
  }, [])

  const toggleNotifications = useCallback(async (e) => {
    e?.stopPropagation()
    const newState = !showNotifications
    setShowNotifications(newState)

    if (newState) {
      await fetchNotifications()
      await fetch('http://localhost:8080/api/notifications/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
        credentials: 'include',
      })
      await fetchNotifications()
      setUnreadCount(0)
      if (setGlobalUnread) setGlobalUnread(0)
    }
  }, [showNotifications, fetchNotifications])

  const handleAccept = useCallback(async (notifId, senderId) => {
    try {
      await fetch('/api/follow/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: senderId }),
        credentials: 'include',
      })

      sendMessage({ type: 'FETCH_CHAT_USERS' })

      await fetch('/api/notifications/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      })

      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      })
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    } catch (err) {
      console.error('Erreur acceptation:', err)
    }
  }, [sendMessage])

  const handleReject = useCallback(async (notifId, senderId) => {
    try {
      const [rejectRes, seenRes, deleteRes] = await Promise.all([
        fetch('/api/follow/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_id: senderId }),
          credentials: 'include',
        }),
        fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        }),
        fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        })
      ])

      if (rejectRes.ok && seenRes.ok && deleteRes.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notifId))
      } else {
        console.error('One or more requests failed', rejectRes.status, seenRes.status)
      }
    } catch (err) {
      console.error('Erreur rejet:', err)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current &&
        !notificationsRef.current.contains(event.target) &&
        !notificationButtonRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (sendMessage) {
      const handleMessage = (event) => {
        const { type, message } = event.data
        if (type === 'notification' || type === 'follow_request' ||
          type === 'follow_request_response' || type === 'follow_request_cancelled') {
          setNotifications(prev => [message, ...prev])
          setUnreadCount(prev => {
            const next = prev + 1
            if (setGlobalUnread) setGlobalUnread(next)
            return next
          })
        }
      }

      sendMessage({ type: 'ADD_LISTENER', listener: handleMessage })
      return () => sendMessage({ type: 'REMOVE_LISTENER', listener: handleMessage })
    }
  }, [sendMessage])

  return {
    showNotifications,
    notifications,
    unreadCount,
    toggleNotifications,
    handleAccept,
    handleReject,
    notificationsRef,
    notificationButtonRef
  }
}