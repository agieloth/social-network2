'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useChat } from '../../../contexts/ChatContext'
import { useWorker } from '../../../contexts/WorkerContext'
import { useAuth } from '../../../contexts/AuthContext'
import ChatBox from './ChatBox'

export default function ChatBoxContainer() {
  const { 
    openChats, 
    closeChat, 
    input, 
    setInput, 
    addMessageForRecipient,
    messages: globalMessages
  } = useChat()
  const { user } = useAuth()
  const { worker } = useWorker()
  const workerRef = useRef(worker)

  useEffect(() => {
    workerRef.current = worker
  }, [worker])

  // Handle Worker messages for private chats
  const handleWorkerMessage = useCallback((event) => {
    const { type, data } = event.data

    // Only process private messages here
    if (data && (type === 'private' || data.type === 'private')) {
      addMessageForRecipient(data)
    }
  }, [addMessageForRecipient])

  useEffect(() => {
    if (!worker) return

    worker.addEventListener('message', handleWorkerMessage)

    return () => {
      worker.removeEventListener('message', handleWorkerMessage)
    }
  }, [worker, handleWorkerMessage])

  const sendMessage = useCallback((chatMsg) => {
    if (!workerRef.current) {
      console.error("Worker not initialized.")
      return
    }

    if (!chatMsg || typeof chatMsg !== 'object') {
      console.error("Invalid chat message:", chatMsg)
      return
    }

    const messageToSend = {
      ...chatMsg,
      timestamp: chatMsg.timestamp || new Date().toISOString()
    }

    console.log("Sending message via Worker:", messageToSend)
    workerRef.current.postMessage({ type: 'SEND', message: messageToSend })
  }, [])

  if (openChats.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      display: 'flex',
      gap: '10px',
      zIndex: 999,
      padding: '10px'
    }}>
      {openChats.map(chatUser => {
        const recipientId = chatUser.id || chatUser.ID
        const chatKey = `${Math.min(user?.ID, recipientId)}-${Math.max(user?.ID, recipientId)}`
        const chatMessages = globalMessages[chatKey] || []

        return (
          <ChatBox
            key={recipientId}
            currentUser={user}
            recipient={chatUser}
            messages={chatMessages}
            input={input[recipientId] || ''}
            setInput={(value) => setInput(prev => ({
              ...prev,
              [recipientId]: value
            }))}
            onSendMessage={(content) => {
              // ChatBox sends a message object, not a string
              if (typeof content === 'object' && content.content) {
                sendMessage({
                  type: 'private',
                  to: recipientId,
                  content: content.content,
                  timestamp: content.timestamp || new Date().toISOString(),
                  from: user?.ID,
                })
              } else if (typeof content === 'string' && content.trim()) {
                // Fallback for string input
                sendMessage({
                  type: 'private',
                  to: recipientId,
                  content: content.trim(),
                  timestamp: new Date().toISOString(),
                  from: user?.ID,
                })
              }
            }}
            onClose={() => closeChat(recipientId)}
          />
        )
      })}
    </div>
  )
}

