'use client'

import { useEffect, useState, useRef } from 'react'
import { useChat } from '../../../contexts/ChatContext'
import { useMessageSidebar } from '../../../contexts/MessageSideBarContext'
import { useAuth } from '../../../contexts/AuthContext'
import styles from './MessageSidebar.module.css'

export default function MessageSidebar({
  chatUsers = [],
  showMessages,
  setShowMessages,
  openChat,
  currentUserId,
  fetchChatUsers,
  ...props
}) {
  // Use global chat context as primary, fallback to props for backward compatibility
  const globalChat = useChat()
  const { showMessages: globalShowMessages, setShowMessages: globalSetShowMessages } = useMessageSidebar()
  const { user } = useAuth()

  const finalShowMessages = showMessages ?? globalShowMessages
  const finalSetShowMessages = setShowMessages ?? globalSetShowMessages
  const finalChatUsers = chatUsers?.length > 0 ? chatUsers : globalChat.chatUsers
  const finalCurrentUserId = currentUserId ?? user?.ID
  const finalFetchChatUsers = fetchChatUsers ?? globalChat.fetchChatUsers
  const finalOpenChat = openChat ?? globalChat.openChat

  const pollingInterval = useRef(null)

  const chatableUsers = finalChatUsers?.filter(u =>
    u?.id !== finalCurrentUserId && u?.can_chat
  ) || []

  const nonChatableUsers = finalChatUsers?.filter(u =>
    u?.id !== finalCurrentUserId && !u?.can_chat
  ) || []

  useEffect(() => {
    if (finalShowMessages && finalFetchChatUsers) {
      finalFetchChatUsers()
    }
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
        pollingInterval.current = null
      }
    }
  }, [finalShowMessages, finalFetchChatUsers])

  const handleNonChatableUserClick = (user) => {
    alert(`Vous ne pouvez pas discuter avec ${user?.full_name || 'cet utilisateur'}. Vous devez vous suivre mutuellement pour pouvoir discuter.`)
  }

  const handleManualRefresh = () => {
    if (finalFetchChatUsers) {
      finalFetchChatUsers()
    }
  }

  return (
    <div
      className={`${styles.sidebar} ${finalShowMessages ? styles.sidebarOpen : styles.sidebarClosed}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Messages</h2>
        <button
          onClick={() => finalSetShowMessages(false)}
          className={styles.closeBtn}
        >
          ✖
        </button>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {chatableUsers.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              💬 Discussions disponibles ({chatableUsers.length})
            </h3>
            {chatableUsers.map(u => (
              <div
                key={u.id}
                className={styles.userItem}
                onClick={() => finalOpenChat(u)}
              >
                <img
                  src={
                    u.avatar
                      ? u.avatar.startsWith('http')
                        ? u.avatar
                        : `http://localhost:8080/${u.avatar}`
                      : '/avatar.png'
                  }
                  className={styles.avatar}
                  alt="avatar"
                />
                <span className={styles.userName}>{u.full_name}</span>
                <span className={styles.userStatus}>✓ Suivi mutuel</span>
              </div>
            ))}
          </div>
        )}

        {chatableUsers.length === 0 && nonChatableUsers.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Aucun autre utilisateur</p>
            <button
              onClick={handleManualRefresh}
              className={styles.refreshBtn}
            >
              Rafraîchir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
