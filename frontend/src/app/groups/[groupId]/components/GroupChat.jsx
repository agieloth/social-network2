import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useWorker } from '../../../../contexts/WorkerContext'
import EmojiPicker from '../../../home/components/Emoji'
import styles from './GroupChat.module.css'

export default function GroupChat({ showGroupChat, setShowGroupChat, group }) {
  const [groupChatInput, setGroupChatInput] = useState('')
  const [groupChatMessages, setGroupChatMessages] = useState([])
  const [onlineUsers, setOnlineUsers] = useState([])
  const [groupMembers, setGroupMembers] = useState({}) // Map of userID -> member info
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const { user } = useAuth()
  const { worker } = useWorker()
  const inputRef = useRef()

  // Normaliser le group ID
  const groupId = group?.id ? parseInt(group.id) : null;

  useEffect(() => {
    if (showGroupChat && groupId) {
      fetchMessages()
      fetchGroupMembers()
    }
  }, [showGroupChat, groupId])

  const fetchGroupMembers = async () => {
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/members`, {
        credentials: 'include'
      })
      if (res.ok) {
        const members = await res.json()
        // Créer un map pour un accès rapide par ID
        const membersMap = {}
        if (Array.isArray(members)) {
          members.forEach(member => {
            membersMap[member.id] = member
          })
        }
        console.log("👥 Loaded group members:", membersMap);
        setGroupMembers(membersMap)
      }
    } catch (err) {
      console.error("Error loading group members:", err)
    }
  }

  // Stable callback for handling Worker messages - CRITICAL: Avoid re-registration
  const handleMessage = useCallback((event) => {
    const { type, data, message } = event.data;
    const messageData = data || message;
    
    if (type === 'group_message') {
      // Le backend envoie groupId (camelCase) via le WebSocket
      const messageGroupID = messageData?.groupId || messageData?.groupID;
      
      console.log("🔔 Worker received group_message:", { 
        messageGroupID, 
        expectedGroupID: groupId,
        match: messageGroupID === groupId,
        messageData 
      });
      
      // Vérifier que le message est pour ce groupe
      if (messageGroupID !== groupId) {
        console.log("⏭️ Message ignored - wrong group ID");
        return;
      }
      
      // Normaliser les noms de champs (WebSocket vs API REST peuvent avoir des noms différents)
      const normalizedMessage = {
        from: messageData.from,
        groupId: messageGroupID,
        content: messageData.content,
        timestamp: messageData.timestamp,
        type: messageData.type,
        sender_nickname: messageData.sender_nickname || messageData.senderNickname
      };
      
      // Ajouter TOUS les messages du groupe, même ceux du sender
      // (le sender reçoit une confirmation de livraison du serveur)
      const isCurrentUser = normalizedMessage.from === user?.ID;
      
      // Obtenir le nom du sender depuis les membres du groupe
      const senderInfo = groupMembers[normalizedMessage.from];
      const senderDisplayName = isCurrentUser 
        ? 'You' 
        : (senderInfo?.username || normalizedMessage.sender_nickname || 'User');
      
      console.log("📨 Adding group message:", { 
        from: normalizedMessage.from, 
        currentUserID: user?.ID,
        isCurrentUser,
        senderDisplayName,
        content: normalizedMessage.content.substring(0, 50) 
      });
      
      setGroupChatMessages(prev => {
        // Vérifier si le message existe déjà (pour éviter les doublons)
        const messageExists = prev.some(msg => 
          msg.from === normalizedMessage.from && 
          msg.timestamp === normalizedMessage.timestamp &&
          msg.content === normalizedMessage.content
        );
        
        if (messageExists) {
          console.log("⚠️ Duplicate message detected, skipping");
          return prev; // Ne pas ajouter de doublon
        }
        
        return [...prev, {
          ...normalizedMessage,
          sender_name: senderDisplayName,
          isCurrentUser: isCurrentUser,
          isOnline: onlineUsers.includes(normalizedMessage.from)
        }];
      });
    } else if (type === 'user_online' && messageData?.groupID === groupId) {
      setOnlineUsers(prev => [...prev, messageData.from])
    }
  }, [groupId, user?.ID, groupMembers, onlineUsers]);

  useEffect(() => {
    if (!worker) return;

    // Use addEventListener with stable callback
    worker.addEventListener('message', handleMessage);

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, [worker, handleMessage])

  const fetchMessages = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/chat`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      
      // Formater les messages avec les noms d'expéditeur
      // Assurer que data est un array, sinon utiliser un array vide
      const messages = Array.isArray(data) ? data : [];
      const formattedMessages = messages.map(msg => {
        const isCurrentUser = msg.sender_id === user?.ID;
        const displayName = isCurrentUser 
          ? 'You' 
          : (msg.sender_nickname || 'User');
        
        return {
          from: msg.sender_id,
          groupId: msg.group_id,
          content: msg.content,
          timestamp: msg.timestamp,
          type: 'group_message',
          sender_nickname: msg.sender_nickname,
          sender_name: displayName,
          isCurrentUser: isCurrentUser,
          isOnline: onlineUsers.includes(msg.sender_id)
        }
      })
      
      console.log("📥 Fetched messages:", formattedMessages.length);
      setGroupChatMessages(formattedMessages)
    } catch (err) {
      setError(err.message)
      setGroupChatMessages([])
    } finally {
      setLoading(false)
    }
  }

  const sendGroupChatMessage = () => {
    if (!groupChatInput.trim() || !user?.ID) return

    const message = {
      type: "group_message",
      groupID: groupId,
      from: user.ID,
      content: groupChatInput.trim(),
      timestamp: new Date().toISOString()
    }

    console.log("🚀 Sending message:", message);

    // Clear input immediately for better UX
    setGroupChatInput('')
    setShowEmojiPicker(false)

    // Send group message via Worker
    // The server will broadcast it back to all members including the sender
    if (worker) {
      worker.postMessage({ type: 'SEND', message })
    }
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

        <ChatMessages 
          messages={groupChatMessages} 
          user={user} 
          loading={loading} 
          error={error} 
        />
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

function ChatMessages({ messages, user, loading, error }) {
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
          <ChatMessage key={index} message={msg} />
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

  // Function to render message content with clickable links
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
          {/* Afficher le nom du sender depuis sender_name (qui contient le username du groupe) */}
          {message.sender_name || (message.isCurrentUser ? 'You' : (message.sender_nickname || 'User'))} 
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