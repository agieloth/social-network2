// src/app/groups/components/GroupList.jsx
'use client'
import { useEffect, useState } from 'react'
import GroupCard from './GroupCard'
import styles from './GroupList.module.css'

export default function GroupList() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/groups', {
          credentials: 'include'
        })
        const data = await res.json()
        setGroups(data)
      } catch (err) {
        console.error('Error fetching groups:', err)
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

  return (
    <div className={styles.grid}>
      {groups !== null && groups.map(group => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  )
}
