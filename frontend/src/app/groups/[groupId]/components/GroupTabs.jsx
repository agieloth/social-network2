import styles from './GroupTabs.module.css'

export default function GroupTabs({ activeTab, setActiveTab, isCreator, isMember }) {
  return (
    <div className={styles.tabsContainer}>
      {/* ⬇️ Posts - Visible pour tous */}
      <button
        onClick={() => setActiveTab('posts')}
        className={`${styles.tabButton} ${activeTab === 'posts' ? styles.active : ''}`}
      >
        Posts
      </button>

      {/* ⬇️ Events - Visible pour tous */}
      <button
        onClick={() => setActiveTab('events')}
        className={`${styles.tabButton} ${activeTab === 'events' ? styles.active : ''}`}
      >
        Events
      </button>

      {/* ⬇️ Members - Visible pour les membres ET le créateur */}
      {(isMember || isCreator) && (
        <button
          onClick={() => setActiveTab('members')}
          className={`${styles.tabButton} ${activeTab === 'members' ? styles.active : ''}`}
        >
          Members
        </button>
      )}

      {/* ⬇️ Requests - Visible SEULEMENT pour le créateur */}
      {isCreator && (
        <button
          onClick={() => setActiveTab('requests')}
          className={`${styles.tabButton} ${activeTab === 'requests' ? styles.active : ''}`}
        >
          Requests
        </button>
      )}
    </div>
  )
}