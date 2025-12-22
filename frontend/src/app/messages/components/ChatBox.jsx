'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import EmojiPicker from '../../home/components/Emoji'
import styles from './ChatBox.module.css'

export default function ChatBox({ currentUser, recipient, onSendMessage, messages = [], input, setInput, onClose }) {
  const scrollRef = useRef()
  const inputRef = useRef()
  const [chatHistory, setChatHistory] = useState([])
  const [allMessages, setAllMessages] = useState([])
  const [chatError, setChatError] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const recipientId = recipient?.id || recipient?.ID
  const userId = currentUser?.ID

  const isValidMessage = useCallback((msg) => {
    return msg && 
           typeof msg === 'object' && 
           'from' in msg && 
           'to' in msg &&
           'content' in msg &&
           'timestamp' in msg
  }, [])

  // Generate unique key for messages
  const generateMessageKey = useCallback((message, index) => {
    const baseKey = `${message.from}-${message.to}-${message.timestamp}`;
    const contentSnippet = message.content ? message.content.substring(0, 20) : '';
    return `${baseKey}-${contentSnippet}-${index}`;
  }, [])

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!recipientId || !userId) return
      
      setChatError('')
      setIsLoading(true)
      
      try {
        const res = await fetch(`http://localhost:8080/api/chat/history?with=${recipientId}`, {
          credentials: 'include'
        })

        if (!res.ok) {
          if (res.status === 403) {
            setChatError('You cannot chat with this user. You need to follow each other.')
            setChatHistory([])
            setAllMessages([])
            return
          }
          throw new Error(await res.text() || 'Failed to load chat history')
        }

        const history = await res.json()
        const validHistory = Array.isArray(history) 
          ? history.filter(msg => isValidMessage(msg)) 
          : []
        
        setChatHistory(validHistory)
        setAllMessages(validHistory)
      } catch (err) {
        console.error('Error loading chat history:', err)
        setChatError('Error loading chat history')
        setChatHistory([])
        setAllMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    loadChatHistory()
  }, [recipientId, userId, isValidMessage])

  useEffect(() => {
    if (!Array.isArray(messages)) return
    
    const relevantMessages = messages
      .filter(msg => isValidMessage(msg))
      .filter(msg => 
        (msg.from === userId && msg.to === recipientId) ||
        (msg.to === userId && msg.from === recipientId)
      )

    if (relevantMessages.length === 0) return

    setAllMessages(prev => {
      // Create a set of existing message IDs for deduplication
      // Use a combination that's more robust: from, to, content, and timestamp rounded to seconds
      const existingIds = new Set(
        prev.map(m => {
          const secondsTimestamp = Math.floor(new Date(m.timestamp).getTime() / 1000);
          return `${m.from}:${m.to}:${m.content}:${secondsTimestamp}`;
        })
      )

      // Filter out duplicates
      const newMessages = relevantMessages.filter(msg => {
        const secondsTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);
        const msgId = `${msg.from}:${msg.to}:${msg.content}:${secondsTimestamp}`;
        return !existingIds.has(msgId);
      })

      if (newMessages.length === 0) return prev

      // Merge and sort
      const merged = [...prev, ...newMessages].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )

      return merged
    })
  }, [messages, userId, recipientId, isValidMessage])

  const handleSend = useCallback(() => {
    if (!input.trim() || !userId || !recipientId || chatError) return

    const msg = {
      from: userId,
      to: recipientId,
      content: input.trim(),
      type: 'private',
      timestamp: new Date().toISOString()
    }

    onSendMessage(msg)
    setInput('')
    setShowEmojiPicker(false)
  }, [input, userId, recipientId, chatError, onSendMessage, setInput])

  const handleEmojiSelect = useCallback((emoji) => {
    if (!inputRef.current) return
    
    const cursorPos = inputRef.current.selectionStart || input.length
    const newText = input.substring(0, cursorPos) + emoji + input.substring(cursorPos)
    
    setInput(newText)
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(
          cursorPos + emoji.length, 
          cursorPos + emoji.length
        )
      }
    }, 0)
  }, [input, setInput])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!chatError) handleSend()
    }
  }, [handleSend, chatError])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [allMessages])

  const renderMessageContent = useCallback((content) => {
    if (!content) return null
    
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return content.split(urlRegex).map((part, i) => 
      part.match(urlRegex) 
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>{part}</a>
        : part
    )
  }, [])

  if (!recipient) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>Recipient information missing</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.recipientName}>
          {recipient.full_name || 'Unknown User'}
        </span>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close chat"
        >
          ✖
        </button>
      </div>

      {/* Messages area */}
      <div className={styles.messagesArea}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <p className={styles.loadingText}>Loading messages...</p>
          </div>
        ) : chatError ? (
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>🚫</div>
            <p className={styles.errorText}>{chatError}</p>
            <p className={styles.infoText}>
              To chat, you need to follow each other.
            </p>
          </div>
        ) : allMessages.length === 0 ? (
          <p className={styles.noMessages}>No messages yet</p>
        ) : (
          allMessages.map((message, index) => (
            <div
              key={generateMessageKey(message, index)}
              className={`${styles.messageWrapper} ${message.from === userId ? styles.messageRight : styles.messageLeft}`}
            >
              <div className={`${styles.messageBubble} ${message.from === userId ? styles.messageSent : styles.messageReceived}`}>
                <div className={styles.messageSender}>
                  {message.from === userId ? 'You' : recipient.full_name}
                </div>
                <div>{renderMessageContent(message.content)}</div>
                <div className={styles.messageTime}>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={`${styles.input} ${chatError ? styles.inputDisabled : styles.inputEnabled}`}
            value={input}
            onChange={(e) => !chatError && setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatError ? "Chat disabled" : "Type a message..."}
            disabled={!!chatError}
            aria-label="Message input"
          />

          {!chatError && (
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={styles.emojiBtn}
              aria-label="Toggle emoji picker"
            >
              😊
            </button>
          )}
        </div>

        <button
          className={`${styles.sendBtn} ${(chatError || !input.trim()) ? styles.sendBtnDisabled : styles.sendBtnEnabled}`}
          onClick={handleSend}
          disabled={!!chatError || !input.trim()}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      {/* Emoji Picker */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={handleEmojiSelect}
      />
    </div>
  )
}