import styles from './MembersTab.module.css'

export default function MembersTab({ group, showInviteForm, setShowInviteForm }) {
  return (
    <>
      <button
        onClick={() => setShowInviteForm(true)}
        className={styles.inviteButton}
      >
        Invite Members
      </button>

      <div className={styles.membersContainer}>
        <h3 className={styles.title}>Group Members</h3>
        {group.members && group.members.length > 0 ? (
          <div className={styles.membersList}>
            {group.members.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        ) : (
          <p className={styles.noMembersText}>No members in this group yet</p>
        )}
      </div>
    </>
  )
}

function MemberItem({ member }) {
  return (
    <div className={styles.memberItem}>
      <div className={styles.avatar}>
        {member.name.charAt(0)}
      </div>
      <div className={styles.memberInfo}>
        <p className={styles.memberName}>{member.name}</p>
        <p className={styles.memberDetails}>
          Joined {new Date(member.joined_at).toLocaleDateString()}
          {member.is_admin && (
            <span className={styles.adminBadge}>
              Admin
            </span>
          )}
        </p>
      </div>
    </div>
  )
}