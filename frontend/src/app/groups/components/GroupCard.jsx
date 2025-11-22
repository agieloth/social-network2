'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './GroupCard.module.css'

export default function GroupCard({ group }) {
  const router = useRouter()
  const [localStatus, setLocalStatus] = useState({
    isPending: group.is_pending,
    isMember: group.is_member
  })

  const handleJoin = async (e) => {
    e.stopPropagation()
    setLocalStatus(prev => ({ ...prev, isPending: true }))
    
    try {
      const res = await fetch(`/api/groups/${group.id}/membership/join`, {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        router.refresh()
      } else {
        setLocalStatus(prev => ({ ...prev, isPending: false }))
      }
    } catch (err) {
      console.error('Error joining group:', err)
      setLocalStatus(prev => ({ ...prev, isPending: false }))
    }
  }

  const handleVisit = (e) => {
    e.stopPropagation()
    router.push(`/groups/${group.id}`)
  }

  const displayStatus = {
    isPending: localStatus.isPending || group.is_pending,
    isMember: localStatus.isMember || group.is_member,
    isCreator: group.is_creator
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{group.title}</h3>
        {displayStatus.isCreator && (
          <span className={styles.adminBadge}>
            Admin
          </span>
        )}
      </div>
      
      <p className={styles.description}>{group.description}</p>
      
      <div className={styles.footer}>
        <div className={styles.meta}>
          <span>👥 {group.member_count} members</span>
          <span className={styles.separator}>•</span>
          <span>🕒 {new Date(group.created_at).toLocaleDateString()}</span>
        </div>

        {!displayStatus.isMember && !displayStatus.isPending && !displayStatus.isCreator && (
          <button 
            onClick={handleJoin}
            className={styles.joinBtn}
          >
            Join Group
          </button>
        )}

        {displayStatus.isPending && (
          <span className={styles.pendingBadge}>
            Pending
          </span>
        )}

        {(displayStatus.isMember || displayStatus.isCreator) && (
          <button 
            onClick={handleVisit}
            className={styles.visitBtn}
          >
            Visit Group
          </button>
        )}
      </div>
    </div>
  )
}
