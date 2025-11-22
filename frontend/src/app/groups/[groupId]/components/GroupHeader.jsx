import styles from './GroupHeader.module.css'

export default function GroupHeader({ group }) {
  return (
    <div className={styles.headerContainer}>
      <h1 className={styles.title}>{group.title}</h1>
      <p className={styles.description}>{group.description}</p>

      <div className={styles.meta}>
        <span>👥 {group.member_count} members</span>
        <span>🕒 Created {new Date(group.created_at).toLocaleDateString()}</span>
        {group.is_creator && (
          <span className={styles.adminBadge}>
            Admin
          </span>
        )}
      </div>
    </div>
  )
}