'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const { groupId } = use(params)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('posts')
  const [showGroupChat, setShowGroupChat] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const handleJoin = async (e) => {
    e.stopPropagation()
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/membership/join`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to join group')

      const refreshRes = await fetch(`http://localhost:8080/api/groups/${groupId}`, {
        credentials: 'include'
      })
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
        const res = await fetch(`http://localhost:8080/api/groups/${groupId}`, {
          credentials: 'include'
        })
        if (!res.ok) throw new Error('Failed to fetch group')
        const data = await res.json()
        console.log("🔍 Group loaded:", data)
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
    console.log("🔍 activeTab changed:", activeTab)
    console.log("🔍 Checking members load condition:", {
      activeTab,
      isMembersTab: activeTab === 'members',
      is_member: group?.is_member,
      is_creator: group?.is_creator,
      shouldLoad: activeTab === 'members' && (group?.is_member || group?.is_creator)
    })

    if (activeTab === 'members' && (group?.is_member || group?.is_creator)) {
      console.log("✅ Loading members...")
      const loadMembers = async () => {
        setLoadingMembers(true)
        try {
          const url = `http://localhost:8080/api/groups/${group.id}/members`
          console.log("🔍 Fetching members from:", url)
          
          const res = await fetch(url, {
            credentials: 'include'
          })

          console.log("🔍 Response status:", res.status)
          
          if (res.ok) {
            const data = await res.json()
            console.log("✅ Members loaded:", data)
            setMembers(data)
          } else {
            console.error("❌ Failed to load members:", res.status, res.statusText)
          }
        } catch (err) {
          console.error('❌ Error loading members:', err)
        } finally {
          setLoadingMembers(false)
        }
      }

      loadMembers()
    }
  }, [activeTab, group?.id, group?.is_member, group?.is_creator])

  const refreshMembers = async () => {
    if (!group?.id) return

    console.log("🔄 Refreshing members...")
    setLoadingMembers(true)
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${group.id}/members`, {
        credentials: 'include'
      })

      if (res.ok) {
        const data = await res.json()
        console.log("✅ Members refreshed:", data)
        setMembers(data)
      }
    } catch (err) {
      console.error('Error refreshing members:', err)
    } finally {
      setLoadingMembers(false)
    }
  }

  if (authLoading || loading || !user) return <LoadingState />
  if (error) return <ErrorState error={error} />

  console.log("🔍 Rendering with:", {
    activeTab,
    group_is_member: group.is_member,
    group_is_creator: group.is_creator,
    showMembersTab: activeTab === 'members' && (group.is_member || group.is_creator),
    membersCount: members.length,
    loadingMembers
  })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <GroupHeader group={group} />

        <JoinStatus group={group} handleJoin={handleJoin} />

        <GroupTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCreator={group.is_creator}
          isMember={group.is_member}
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

          {/* 🔍 DEBUG : Afficher toujours pour tester */}
          {activeTab === 'members' && (
            <div>
              <h3 style={{ color: 'yellow' }}>🔍 DEBUG INFO:</h3>
              <pre style={{ color: 'white', background: 'black', padding: '10px' }}>
                {JSON.stringify({
                  is_member: group.is_member,
                  is_creator: group.is_creator,
                  condition: group.is_member || group.is_creator,
                  membersCount: members.length,
                  loadingMembers
                }, null, 2)}
              </pre>

              {(group.is_member || group.is_creator) ? (
                <>
                  <p style={{ color: 'green' }}>✅ Condition OK - MembersTab should render</p>
                  <MembersTab
                    group={group}
                    members={members}
                    loading={loadingMembers}
                    showInviteForm={showInviteForm}
                    setShowInviteForm={setShowInviteForm}
                    onRefreshMembers={refreshMembers}
                    isCreator={group.is_creator}
                  />
                </>
              ) : (
                <p style={{ color: 'red' }}>❌ Condition FAILED - MembersTab will not render</p>
              )}
            </div>
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