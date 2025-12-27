// src/app/groups/components/GroupList.jsx
'use client'
import { useEffect, useState } from 'react'
import { groupsApi } from '../../../lib/api'
import toast from 'react-hot-toast'
import GroupCard from './GroupCard'
import styles from './GroupList.module.css'

export default function GroupList() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await groupsApi.getAll()
        setGroups(data || [])
      } catch (err) {
        console.error('Error fetching groups:', err)
        toast.error('Failed to load groups')
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [])

  if (loading) return (
    <div className={styles.loadingGrid}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className={styles.loadingCard}></div>
      ))}
    </div>
  )

  if (groups.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No groups yet. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {groups.map(group => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  )
}