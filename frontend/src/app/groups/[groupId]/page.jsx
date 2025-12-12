'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, redirect } from 'next/navigation'
import { use } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import GroupHeader from './components/GroupHeader'
import GroupTabs from './components/GroupTabs'
import PostsTab from './components/PostsTab'
import EventsTab from './components/EventsTab'
import MembersTab from './components/MembersTab'
import GroupChat from './components/GroupChat'
import PostFormModal from './components/PostFormModal'
import EventFormModal from './components/EventFormModal'
import InviteModal from './components/InviteModal'
import PendingRequests from '../components/PendingRequests'
import JoinStatus from './components/JoinStatus'
import styles from './GroupDetailPage.module.css'

export default function GroupDetailPage({ params }) {
  // All hooks at the top (no conditional returns above this)
  const { groupId } = use(params)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('posts')
  const [showGroupChat, setShowGroupChat] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [members, setMembers] = useState([]) // Ajoutez cet état
  const [loadingMembers, setLoadingMembers] = useState(false) // Ajoutez cet état

  const { user } = useAuth()
  const router = useRouter()

  // Handle redirect in useEffect
  useEffect(() => {
    if (!user && !loading) {
      redirect("/login")
    }
  }, [user, loading])

  const handleJoin = async (e) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/groups/${groupId}/membership/join`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to join group')

      const refreshRes = await fetch(`/api/groups/${groupId}`)
      if (refreshRes.ok) {
        setGroup(await refreshRes.json())
      }
    } catch (err) {
      console.error('Error joining group:', err)
    }
  }

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}`)
        if (!res.ok) throw new Error('Failed to fetch group')
        const data = await res.json()
        setGroup(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [groupId])

  useEffect(() => {
    // Ne charger les membres que quand on clique sur le tab "members"
    if (activeTab === 'members' && group?.is_creator) {
      const loadMembers = async () => {
        setLoadingMembers(true);
        try {
          const res = await fetch(`/api/groups/${group.id}/members`, {
            credentials: 'include'
          });

          if (res.ok) {
            const data = await res.json();
            setMembers(data);
          }
        } catch (err) {
          console.error('Error loading members:', err);
        } finally {
          setLoadingMembers(false);
        }
      };

      loadMembers();
    }
  }, [activeTab, group?.id, group?.is_creator]); // Seulement ces dépendances

  // Fonction séparée pour rafraîchir (appelée manuellement)
  const refreshMembers = async () => {
    if (!group?.id) return;

    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Error refreshing members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };


  // Only show loading/error states after auth check
  if (loading || !user) return <LoadingState />
  if (error) return <ErrorState error={error} />

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <GroupHeader group={group} />

        <JoinStatus group={group} handleJoin={handleJoin} />

        <GroupTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCreator={group.is_creator}
        />

        <div className={styles.contentSpace}>
          {activeTab === 'posts' && (
            <PostsTab
              group={group}
              showPostForm={showPostForm}
              setShowPostForm={setShowPostForm}
            />
          )}

          {activeTab === 'events' && (
            <EventsTab
              group={group}
              showEventForm={showEventForm}
              setShowEventForm={setShowEventForm}
            />
          )}

          {activeTab === 'requests' && group.is_creator && (
            <div className={styles.requestsContainer}>
              <PendingRequests groupId={group.id} />
            </div>
          )}

          {activeTab === 'members' && group.is_creator && (
            <MembersTab
              group={group}
              members={members} // Passez les membres récupérés
              loading={loadingMembers} // Passez l'état de chargement
              showInviteForm={showInviteForm}
              setShowInviteForm={setShowInviteForm}
              onRefreshMembers={refreshMembers} // Pour rafraîchir après une invitation
            />
          )}
        </div>
      </div>

      {(group.is_member || group.is_creator) && (
        <button
          onClick={() => setShowGroupChat(true)}
          className={styles.fab}
          title="Open Group Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={styles.fabIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      <GroupChat
        showGroupChat={showGroupChat}
        setShowGroupChat={setShowGroupChat}
        group={group}
      />

      <PostFormModal
        showPostForm={showPostForm}
        setShowPostForm={setShowPostForm}
        groupId={groupId}
      />

      <EventFormModal
        showEventForm={showEventForm}
        setShowEventForm={setShowEventForm}
        groupId={groupId}
      />

      <InviteModal
        showInviteForm={showInviteForm}
        setShowInviteForm={setShowInviteForm}
        groupId={groupId}
      />
    </div>
  )
}

function LoadingState() {
  return (
    <div className={styles.loadingPage}>
      <div className={styles.loadingContainer}>
        <div className={styles.pulseWrapper}>
          <div className={styles.loadingBarShort}></div>
          <div className={styles.loadingBarMedium}></div>
          <div className={styles.loadingBox}></div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className={styles.errorPage}>
      <div className={styles.errorContainer}>
        {error}
      </div>
    </div>
  )
}
