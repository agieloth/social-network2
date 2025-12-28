// GroupTabs.jsx - Exemple de version corrigée
// Ce fichier montre comment GroupTabs devrait gérer la visibilité des tabs

import styles from './GroupTabs.module.css'

export default function GroupTabs({ activeTab, setActiveTab, isCreator, isMember }) {
  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabs}>
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
    </div>
  )
}

/*
NOTES IMPORTANTES :

1. Le composant reçoit maintenant 2 props :
   - isCreator (boolean) : Est-ce que l'user est le créateur ?
   - isMember (boolean) : Est-ce que l'user est un membre ?

2. Visibilité des tabs :
   - Posts : Tout le monde (pas de condition)
   - Events : Tout le monde (pas de condition)
   - Members : isMember || isCreator
   - Requests : SEULEMENT isCreator

3. Si ton GroupTabs actuel n'a pas exactement cette structure,
   adapte-le en gardant la logique de visibilité :
   
   Members : {(isMember || isCreator) && <button>...</button>}
   Requests : {isCreator && <button>...</button>}
*/