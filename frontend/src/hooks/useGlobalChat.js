'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useWorker } from '../contexts/WorkerContext'

export function useGlobalChat() {
  const [chatUsers, setChatUsers] = useState([])
  const [openChats, setOpenChats] = useState([])
  const [unreadMessages, setUnreadMessages] = useState({})
  const [messages, setMessages] = useState({})
  const [input, setInput] = useState({})
  const [messageNotifications, setMessageNotifications] = useState([])
  const { worker: contextWorker } = useWorker()
  const workerRef = useRef(contextWorker)
  const lastMessageTime = useRef(null)
  const messageQueueRef = useRef([])

  // Update worker ref when context worker changes
  useEffect(() => {
    workerRef.current = contextWorker
  }, [contextWorker])

  const fetchChatUsers = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8080/api/chat-users', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setChatUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }, [])

  const openChat = useCallback((user) => {
    setOpenChats(prev => {
      const exists = prev.find(c => (c.id || c.ID) === (user.id || user.ID))
      if (!exists) {
        return [...prev, user]
      }
      return prev
    })
    // Mark as read when opening chat
    setUnreadMessages(prev => ({
      ...prev,
      [user.id || user.ID]: 0
    }))
    // Mark messages as read inline to avoid dependency issues
    setMessageNotifications(prev =>
      prev.map(notif =>
        (notif.sender.id || notif.sender.ID) === (user.id || user.ID)
          ? { ...notif, read: true }
          : notif
      )
    )
  }, [])

  const closeChat = useCallback((userId) => {
    setOpenChats(prev => prev.filter(c => (c.id || c.ID) !== userId))
  }, [])

  const sendMessage = useCallback((recipientId, content, currentUserId) => {
    if (!content.trim() || !workerRef.current) return

    const message = {
      type: 'message',
      to: recipientId,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      from: currentUserId,
    }

    // Clear input
    setInput(prev => ({
      ...prev,
      [recipientId]: ''
    }))

    // Throttle messages
    const now = Date.now()
    if (lastMessageTime.current && now - lastMessageTime.current < 100) {
      messageQueueRef.current.push(message)
      return
    }

    lastMessageTime.current = now
    workerRef.current.postMessage({ type: 'SEND', message })
  }, [])

  const addMessage = useCallback((from, to, content, timestamp) => {
    // Store in keyed format (private messages)
    const key = `${Math.min(from, to)}-${Math.max(from, to)}`
    setMessages(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), { from, to, content, timestamp }]
    }))
  }, [])

  const addMessageForRecipient = useCallback((data) => {
    // Add message to both sender and recipient conversation
    const userId = Math.min(data.from, data.to)
    const otherId = Math.max(data.from, data.to)
    const key = `${userId}-${otherId}`

    setMessages(prev => {
      const existing = prev[key] || []
      // Check for duplicates
      const isDuplicate = existing.some(m =>
        m.from === data.from &&
        m.to === data.to &&
        m.content === data.content &&
        Math.abs(new Date(m.timestamp) - new Date(data.timestamp)) < 1000
      )
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate message detected')
        return prev
      }

      return {
        ...prev,
        [key]: [...existing, data]
      }
    })
  }, [])

  const markMessagesAsRead = useCallback((userId) => {
    setUnreadMessages(prev => ({
      ...prev,
      [userId]: 0
    }))

    setMessageNotifications(prev =>
      prev.map(notif =>
        (notif.sender.id || notif.sender.ID) === userId
          ? { ...notif, read: true }
          : notif
      )
    )
  }, [])

  const addMessageNotification = useCallback((sender, message) => {
    setMessageNotifications(prev => [{
      id: Date.now(),
      sender,
      message,
      timestamp: new Date(),
      read: false
    }, ...prev.slice(0, 9)])
  }, [])

  const incrementUnreadFor = useCallback((userId) => {
    setUnreadMessages(prev => ({
      ...prev,
      [userId]: (prev[userId] || 0) + 1
    }))
  }, [])

  return {
    chatUsers,
    openChats,
    unreadMessages,
    messages,
    messageNotifications,
    input,
    setInput,
    fetchChatUsers,
    openChat,
    closeChat,
    sendMessage,
    addMessage,
    addMessageForRecipient,
    markMessagesAsRead,
    addMessageNotification,
    incrementUnreadFor,
    setChatUsers,
  }
}

