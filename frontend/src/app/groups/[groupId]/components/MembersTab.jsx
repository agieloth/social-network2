// MembersTab.jsx - Version corrigée avec support isCreator
import styles from './MembersTab.module.css'

export default function MembersTab({ 
  group, 
  members, 
  loading, 
  showInviteForm, 
  setShowInviteForm,
  onRefreshMembers,
  isCreator  // ⬅️ NOUVEAU : pour futures fonctionnalités admin
}) {
  // Pas de useEffect ici pour éviter les boucles
  // La rafraîchissement se fera manuellement ou via le parent

  const handleRefreshClick = () => {
    if (onRefreshMembers) {
      onRefreshMembers();
    }
  };

  return (
    <>
      <div className={styles.headerRow}>
        {/* ⬇️ Bouton Invite visible pour TOUS les membres */}
        <button
          onClick={() => setShowInviteForm(true)}
          className={styles.inviteButton}
          disabled={loading}
        >
          Invite Members
        </button>
        <button
          onClick={handleRefreshClick}
          className={styles.refreshButton}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <div className={styles.membersContainer}>
        <h3 className={styles.title}>
          Group Members ({Array.isArray(members) ? members.length : 0})
        </h3>
        
        {loading ? (
          <div className={styles.loading}>Loading members...</div>
        ) : members && members.length > 0 ? (
          <div className={styles.membersList}>
            {members.map(member => (
              <MemberItem 
                key={`${member.id}-${member.role}`} 
                member={member}
                isCreator={isCreator}  // ⬅️ Passer pour futures actions admin
              />
            ))}
          </div>
        ) : (
          <p className={styles.noMembersText}>
            {members === null || members === undefined 
              ? 'Error loading members' 
              : 'No members in this group yet'}
          </p>
        )}
      </div>
    </>
  )
}

function MemberItem({ member, isCreator }) {
  // Afficher correctement les informations
  const avatarUrl = member.avatar 
    ? (member.avatar.startsWith('http') 
        ? member.avatar 
        : `http://localhost:8080/${member.avatar.replace(/^\/+/, '')}`)
    : null;

  return (
    <div className={styles.memberItem}>
      <div className={styles.avatar}>
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={member.username} 
            className={styles.avatarImage}
            onError={(e) => {
              e.target.src = '/avatar.png';
              e.target.className = styles.avatarFallback;
            }}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {member.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
      <div className={styles.memberInfo}>
        <p className={styles.memberName}>
          {member.username || 'Unknown User'}
          {member.role === 'creator' && (
            <span className={styles.adminBadge}>
              Admin
            </span>
          )}
        </p>
        <p className={styles.memberDetails}>
          Joined {member.joined_at 
            ? new Date(member.joined_at).toLocaleDateString() 
            : 'Unknown date'}
        </p>
      </div>
    </div>
  )
}