'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await authApi.getProfile()
        router.push('/home')
      } catch (err) {
        // Utilisateur non connecté, on reste sur la page login
      }
    }

    checkAuth()
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await authApi.login(email, password)
      toast.success('Login successful!')
      window.location.href = '/home'
    } catch (err) {
      toast.error(err.message || 'Login failed')
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
      </div>
    </main>
  )
}