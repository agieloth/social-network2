// contexts/MessageSidebarContext.jsx
'use client'

import { createContext, useContext, useState } from 'react'

const MessageSidebarContext = createContext()

export function MessageSidebarProvider({ children }) {
  const [showMessages, setShowMessages] = useState(false)
  const [chatUsers, setChatUsers] = useState([])

  return (
    <MessageSidebarContext.Provider value={{
      showMessages,
      setShowMessages,
      chatUsers,
      setChatUsers
    }}>
      {children}
    </MessageSidebarContext.Provider>
  )
}

export function useMessageSidebar() {
  return useContext(MessageSidebarContext)
}