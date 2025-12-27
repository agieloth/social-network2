'use client';

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const router = useRouter()

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await authApi.getProfile()
        router.push('/home')
      } catch (err) {
        // Utilisateur non connecté, on reste sur register
      }
    }
    checkAuth()
  }, [router])

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    nickname: '',
    about: '',
    avatar: '',
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })

    try {
      await authApi.register(formData)
      toast.success('Registration successful! Redirecting to login...')
      
      // Reset form
      setForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        date_of_birth: '',
        nickname: '',
        about: '',
        avatar: '',
      })
      
      setTimeout(() => router.push('/login'), 1500)
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.h1}>Create your account</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input 
          name="email" 
          type="email" 
          placeholder="Email" 
          value={form.email} 
          onChange={handleChange} 
          required 
        />
        <Input 
          name="password" 
          type="password" 
          placeholder="Password" 
          value={form.password} 
          onChange={handleChange} 
          required 
        />
        <Input 
          name="first_name" 
          placeholder="First Name" 
          value={form.first_name} 
          onChange={handleChange} 
          required 
        />
        <Input 
          name="last_name" 
          placeholder="Last Name" 
          value={form.last_name} 
          onChange={handleChange} 
          required 
        />
        <Input 
          name="date_of_birth" 
          type="date" 
          value={form.date_of_birth} 
          onChange={handleChange} 
          required 
        />
        <Input 
          name="nickname" 
          placeholder="Nickname (optional)" 
          value={form.nickname} 
          onChange={handleChange} 
        />
        <Textarea 
          name="about" 
          placeholder="About Me (optional)" 
          value={form.about} 
          onChange={handleChange} 
        />
        <input
          type="file"
          name="avatar"
          accept="image/*"
          onChange={(e) => setForm((prev) => ({ ...prev, avatar: e.target.files[0] }))}
          className={styles.fileInput}
        />

        <button
          type="submit"
          disabled={isLoading}
          className={styles.button}
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>

        <p className={styles.p}>
          Already have an account?{' '}
          <Link href="/login" className={styles.link}>
            Login here
          </Link>
        </p>
      </form>
    </main>
  )
}

function Input({ name, type = 'text', ...props }) {
  return (
    <input
      name={name}
      type={type}
      className={styles.input}
      {...props}
    />
  )
}

function Textarea({ name, ...props }) {
  return (
    <textarea
      name={name}
      rows="4"
      className={styles.textarea}
      {...props}
    />
  )
}