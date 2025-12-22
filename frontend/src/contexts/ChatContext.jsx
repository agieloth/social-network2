'use client'

import { createContext, useContext } from 'react'
import { useGlobalChat } from '../hooks/useGlobalChat'

const ChatContext = createContext()

export function ChatProvider({ children }) {
  const chatState = useGlobalChat()

  return (
    <ChatContext.Provider value={chatState}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
