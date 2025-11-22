'use client'

import { useEffect, useState } from 'react'
import { redirect, useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import styles from './ProfilePage.module.css' // import CSS module

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const router = useRouter();
  const { user } = useAuth();

  if (!user) {
    redirect("/login");
  }

  useEffect(() => {
    fetch('http://localhost:8080/api/profile', {
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(data => setProfile(data))
      .catch(() => {
        setError('Please login to view your profile')
        setTimeout(() => router.push('/login'), 2000)
      })
  }, [])

  if (error) {
    return <p className={styles.error}>{error}</p>
  }

  if (!profile) {
    return <p className={styles.loading}>Loading...</p>
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Your Profile</h1>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
      <p><strong>Date of Birth:</strong> {profile.date_of_birth}</p>
      <p><strong>Nickname:</strong> {profile.nickname || 'N/A'}</p>
      <p><strong>About Me:</strong> {profile.about || 'N/A'}</p>
      <p><strong>Avatar:</strong> {profile.avatar || 'N/A'}</p>

      <button
        className={styles.logoutBtn}
        onClick={async () => {
          try {
            const res = await fetch('http://localhost:8080/api/logout', {
              method: 'POST',
              credentials: 'include',
            });
            if (res.ok) {
              router.push('/login');
            } else {
              alert('Logout failed');
            }
          } catch (error) {
            console.error('Logout error:', error);
          }
        }}
      >
        Logout
      </button>
    </main>
  )
}
