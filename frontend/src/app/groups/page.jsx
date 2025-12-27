'use client'
import { useState, useEffect } from 'react'
import GroupList from './components/GroupList'
import CreateGroupModal from './components/CreateGroupModal'
import { useAuth } from '../../contexts/AuthContext'
import { redirect } from 'next/navigation'
import styles from './GroupsPage.module.css'

function LoadingState() {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingContainer}>
        <div className={`${styles.pulse} ${styles.loadingContent}`}>
          <div className={styles.loadingHeader}></div>
          <div className={styles.loadingSubHeader}></div>
          <div className={styles.loadingBox}></div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className={styles.errorScreen}>
      <div className={`${styles.errorContainer} ${styles.errorText}`}>
        {error}
      </div>
    </div>
  )
}

export default function GroupsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!user && !loading) {
      redirect("/login")
    }
  }, [user, loading])

  const handleGroupCreated = () => {
    setShowCreateModal(false)
    setRefreshKey(prev => prev + 1) // Force refresh GroupList
  }

  if (loading || !user) return <LoadingState />
  if (error) return <ErrorState error={error} />

  return (
    <div className={styles.groupsPage}>
      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Header with animated gradient */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            Your Communities
          </h1>
          <p className={styles.subtitle}>
            Connect, share, and grow with like-minded people
          </p>
        </div>
        
        {/* Action Bar */}
        <div className={styles.actionBar}>
          <button
            onClick={() => setShowCreateModal(true)}
            className={styles.createGroupButton}
          >
            <svg
              className={styles.createGroupIcon}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Create New Group
          </button>
        </div>
        
        {/* Group List */}
        <div className={styles.groupListContainer}>
          <GroupList key={refreshKey} />
        </div>
      </div>
      
      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  )
}