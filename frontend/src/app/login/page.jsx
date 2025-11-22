'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/profile', {
          credentials: 'include',
        })

        if (res.ok) {
          router.push('/') // Use router.push instead of redirect
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      }
    }

    checkAuth()
  }, [router]) // Add router to dependencies

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsLoading(true)

    try {
      const res = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage('✅ Login successful!')
        // Remove localStorage.setItem unless you specifically need it
        // The session cookie should be enough
        window.location.reload() // Navigate after successful login
      } else {
        setMessage(data.message || `❌ Login failed (${res.status})`)
      }
    } catch (err) {
      console.error('Login error:', err)
      setMessage('❌ Connection error - please try again')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.h1}>Login</h1>
        <form onSubmit={handleLogin} className={styles.form}>
          <input
            type="email"
            placeholder="Email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className={styles.button}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>

          <p className={styles.p}>
            Don't have an account?{' '}
            <Link href="/register" className={styles.link}>
              Register here
            </Link>
          </p>
        </form>
        {message && (
          <p className={`${styles.message} ${message.startsWith('✅') ? styles.success : styles.error}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
