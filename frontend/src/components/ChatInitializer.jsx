'use client'

import { useEffect } from 'react'
import { useChat } from '../contexts/ChatContext'
import { useAuth } from '../contexts/AuthContext'

export function ChatInitializer() {
  const { user } = useAuth()
  const { fetchChatUsers } = useChat()

  useEffect(() => {
    if (user?.ID) {
      fetchChatUsers()
    }
  }, [user?.ID, fetchChatUsers])

  return null
}
