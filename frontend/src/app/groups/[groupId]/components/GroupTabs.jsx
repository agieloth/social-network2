import styles from './GroupTabs.module.css'

export default function GroupTabs({ activeTab, setActiveTab, isCreator }) {
  return (
    <div className={styles.tabsContainer}>
      <TabButton 
        name="posts"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        label="Posts"
      />
      <TabButton 
        name="events"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        label="Events"
      />
      {isCreator && (
        <>
          <TabButton 
            name="requests"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            label="Pending Requests"
          />
          <TabButton 
            name="members"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            label="Members"
          />
        </>
      )}
    </div>
  )
}

function TabButton({ name, activeTab, setActiveTab, label }) {
  const isActive = activeTab === name
  const buttonClasses = [
    styles.tabButton,
    isActive && styles.active
  ].filter(Boolean).join(' ')

  return (
    <button
      onClick={() => setActiveTab(name)}
      className={buttonClasses}
    >
      {label}
    </button>
  )
}