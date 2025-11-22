import { useState, useEffect } from 'react'
import styles from './InviteModal.module.css'

export default function InviteModal({ showInviteForm, setShowInviteForm, groupId }) {
  const [invitableMembers, setInvitableMembers] = useState([])
  const [invitingMemberId, setInvitingMemberId] = useState(null)

  useEffect(() => {
    if (showInviteForm) {
      fetchInvitableMembers()
    }
  }, [showInviteForm])

  const fetchInvitableMembers = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/invitable_members`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch invitable members')
      const data = await res.json()
      setInvitableMembers(data)
    } catch (err) {
      console.error('Error fetching invitable members:', err)
    }
  }

  const handleInviteMember = async (memberId) => {
    setInvitingMemberId(memberId)
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: memberId }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to send invitation')
      
      setInvitableMembers(prev => prev.filter(member => member.id !== memberId))
    } catch (err) {
      console.error('Error inviting member:', err)
    } finally {
      setInvitingMemberId(null)
    }
  }

  if (!showInviteForm) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.title}>Invite Members</h2>
        
        {invitableMembers && invitableMembers.length > 0 ? (
          <div className={styles.membersListContainer}>
            <div className={styles.membersList}>
              {invitableMembers.map(member => (
                <div key={member.id} className={styles.memberItem}>
                  <div className={styles.memberInfo}>
                    <div className={styles.avatar}>
                      {member.username.charAt(0)}
                    </div>
                    <span className={styles.memberName}>{member.name}</span>
                  </div>
                  <button
                    onClick={() => handleInviteMember(member.id)}
                    disabled={invitingMemberId === member.id}
                    className={styles.inviteButton}
                  >
                    {invitingMemberId === member.id ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.closeButtonContainer}>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className={styles.closeButton}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>No members available to invite</p>
            <button
              onClick={() => setShowInviteForm(false)}
              className={`${styles.closeButton} ${styles.emptyStateCloseButton}`}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}