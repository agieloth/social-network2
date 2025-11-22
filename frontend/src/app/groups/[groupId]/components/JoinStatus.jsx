import styles from './JoinStatus.module.css'

export default function JoinStatus({ group, handleJoin }) {
  if (!group.is_member && !group.is_pending && !group.is_creator) {
    return (
      <div className={`${styles.statusContainer} ${styles.joinContainer}`}>
        <p className={styles.joinText}>You're not a member of this group</p>
        <button
          onClick={handleJoin}
          className={styles.joinButton}
        >
          Join Group
        </button>
      </div>
    )
  }

  if (group.is_pending) {
    return (
      <div className={`${styles.statusContainer} ${styles.pendingContainer}`}>
        <p className={styles.pendingText}>Your join request is pending approval</p>
      </div>
    )
  }

  return null
}