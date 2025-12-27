'use client'

import { useEffect, useState } from 'react'
import { redirect, useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  if (!user) {
    redirect("/login")
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await authApi.getProfile()
        setProfile(data)
      } catch (err) {
        toast.error('Please login to view your profile')
        setTimeout(() => router.push('/login'), 2000)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  const handleLogout = async () => {
    try {
      await authApi.logout()
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (err) {
      toast.error('Logout failed')
    }
  }

  if (loading) {
    return <p className={styles.loading}>Loading...</p>
  }

  if (!profile) {
    return null
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
        onClick={handleLogout}
      >
        Logout
      </button>
    </main>
  )
}