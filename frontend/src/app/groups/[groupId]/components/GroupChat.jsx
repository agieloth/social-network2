import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useSharedWorker } from '../../../../contexts/SharedWorkerContext'
import EmojiPicker from '../../../home/components/Emoji'
import styles from './GroupChat.module.css'

export default function GroupChat({ showGroupChat, setShowGroupChat, group }) {
  const [groupChatInput, setGroupChatInput] = useState('')
  const [groupChatMessages, setGroupChatMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const { user } = useAuth()
  const { worker, sendWorkerMessage } = useSharedWorker()
  const inputRef = useRef()

  useEffect(() => {
    if (showGroupChat && group?.id) {
      fetchMessages()
    }
  }, [showGroupChat, group?.id])

  useEffect(() => {
    if (worker) {
      worker.port.onmessage = (event) => {
        console.log("rah dkhel");

        const message = event.data.data;
        if (event.type === 'user_online' && message.groupId === parseInt(group?.id)) {
          setOnlineUsers(prev => [...prev, message.from])
        } else if (message.type === 'group' && message.groupId === parseInt(group?.id)) {
          console.log("dkhel tra hna ");

          setGroupChatMessages(prev => [...prev, message])
        }
      }
    }
  }, [worker, group?.id])

  const fetchMessages = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/groups/${group.id}/chat`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setGroupChatMessages(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendGroupChatMessage = () => {
    if (!groupChatInput.trim() || !user?.ID) return

    const message = {
      type: "group",
      groupId: parseInt(group.id),
      from: user.ID,
      content: groupChatInput.trim(),
      timestamp: new Date().toISOString()
    }

    // Optimistically update UI
    setGroupChatMessages(prev => [...prev, {
      ...message,
      sender_name: 'You',
      isCurrentUser: true
    }])
    setGroupChatInput('')
    setShowEmojiPicker(false)

    sendWorkerMessage(message)
  }

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendGroupChatMessage()
    }
  }

  const handleEmojiSelect = (emoji) => {
    if (!inputRef.current) return
    
    const cursorPos = inputRef.current.selectionStart || groupChatInput.length
    const newText = groupChatInput.substring(0, cursorPos) + emoji + groupChatInput.substring(cursorPos)
    
    setGroupChatInput(newText)
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(
          cursorPos + emoji.length, 
          cursorPos + emoji.length
        )
      }
    }, 0)
  }

  if (!showGroupChat) return null

  return (
    <div className={styles.chatOverlay}>
      <div className={styles.chatContainer}>
        <div className={styles.chatHeader}>
          <div className={styles.headerTitleContainer}>
            <h3 className={styles.headerTitle}>Group Chat: {group?.title}</h3>
            <span className={`${styles.statusIndicator} ${user ? styles.statusOnline : styles.statusOffline}`}></span>
          </div>
          <button
            onClick={() => setShowGroupChat(false)}
            className={styles.closeButton}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={styles.closeIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ChatMessages messages={groupChatMessages} user={user} loading={loading} error={error} onlineUsers={onlineUsers} />
        <ChatInput
          ref={inputRef}
          value={groupChatInput}
          onChange={setGroupChatInput}
          onKeyPress={handleChatKeyPress}
          onSend={sendGroupChatMessage}
          disabled={!user}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
        />
      </div>
    </div>
  )
}

function ChatMessages({ messages, user, loading, error, onlineUsers }) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  if (loading) return <div className={styles.centered}><p>Loading messages...</p></div>
  if (error) return <div className={styles.centered}><p className={styles.errorText}>{error}</p></div>

  return (
    <div className={styles.messagesContainer}>
      {messages.length === 0 ? (
        <p className={styles.emptyMessages}>
          {user ? "No messages yet. Start the conversation!" : "Connecting to chat..."}
        </p>
      ) : (
        messages.map((msg, index) => (
          <ChatMessage key={index} message={{ ...msg, isCurrentUser: msg.from === user?.ID, isOnline: onlineUsers.includes(msg.from) }} />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

function ChatMessage({ message }) {
  const messageRowClasses = [
    styles.messageRow,
    message.isCurrentUser ? styles.currentUser : styles.otherUser
  ].join(' ')

  const messageBubbleClasses = [
    styles.messageBubble,
    message.isCurrentUser ? styles.currentUser : styles.otherUser
  ].join(' ')

  // Function to render message content with clickable links (same as ChatBox)
  const renderMessageContent = (content) => {
    if (!content) return null
    
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return content.split(urlRegex).map((part, i) => 
      part.match(urlRegex) 
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>{part}</a>
        : part
    )
  }

  return (
    <div className={messageRowClasses}>
      <div className={messageBubbleClasses}>
        <p className={styles.messageContent}>{renderMessageContent(message.content)}</p>
        <p className={styles.messageInfo}>
          {message.isCurrentUser ? 'You' : message.sender_name || 'User'}
          {message.isOnline && <span className={styles.onlineIndicator}></span>}
          • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

const ChatInput = React.forwardRef(({ 
  value, 
  onChange, 
  onKeyPress, 
  onSend, 
  disabled, 
  showEmojiPicker, 
  setShowEmojiPicker, 
  onEmojiSelect 
}, ref) => {
  return (
    <div className={styles.chatInputContainer}>
      <div className={styles.inputWrapper}>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={disabled ? "Connecting..." : "Type a message..."}
          disabled={disabled}
          className={styles.chatInput}
          aria-label="Message input"
        />
        
        {!disabled && (
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={styles.emojiBtn}
            aria-label="Toggle emoji picker"
          >
            😊
          </button>
        )}

        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className={styles.sendButton}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      {/* Emoji Picker */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmojiSelect={onEmojiSelect}
      />
    </div>
  )
})