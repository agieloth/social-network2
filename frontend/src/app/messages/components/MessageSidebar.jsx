'use client'

import { useEffect, useState, useRef } from 'react'
import styles from './MessageSidebar.module.css'

export default function MessageSidebar({
  chatUsers = [],
  showMessages,
  setShowMessages,
  openChat,
  currentUserId,
  fetchChatUsers
}) {
  const pollingInterval = useRef(null);

  const chatableUsers = chatUsers?.filter(u => 
    u?.id !== currentUserId && u?.can_chat
  ) || []
  
  const nonChatableUsers = chatUsers?.filter(u => 
    u?.id !== currentUserId && !u?.can_chat
  ) || []

  useEffect(() => {
    if (showMessages && fetchChatUsers) {
      fetchChatUsers();
    }
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [showMessages, fetchChatUsers]);

  const handleNonChatableUserClick = (user) => {
    alert(`Vous ne pouvez pas discuter avec ${user?.full_name || 'cet utilisateur'}. Vous devez vous suivre mutuellement pour pouvoir discuter.`);
  }

  const handleManualRefresh = () => {
    if (fetchChatUsers) {
      fetchChatUsers();
    }
  };

  return (
    <div
      className={`${styles.sidebar} ${showMessages ? styles.sidebarOpen : styles.sidebarClosed}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Messages</h2>
        <button
          onClick={() => setShowMessages(false)}
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
                onClick={() => openChat(u)}
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
