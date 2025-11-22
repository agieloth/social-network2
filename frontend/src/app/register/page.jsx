'use client';

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './RegisterPage.module.css'

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/profile', {
          credentials: 'include',
        })
        if (res.ok) {
          router.push('/home')
        }
      } catch (err) {
        console.error('Auth check failed:', err)
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

  const [message, setMessage] = useState({ type: '', text: '' })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })

    try {
      const res = await fetch('http://localhost:8080/api/register', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setMessage({ type: 'success', text: '✅ Registered successfully!' })
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
        setTimeout(() => router.push('/login'), 1000)
      } else {
        const errText = await res.text()
        setMessage({ type: 'error', text: `❌ ${errText}` })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: '❌ Network error' })
    }
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.h1}>Create your account</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <Input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
        <Input name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange} required />
        <Input name="last_name" placeholder="Last Name" value={form.last_name} onChange={handleChange} required />
        <Input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} required />
        <Input name="nickname" placeholder="Nickname (optional)" value={form.nickname} onChange={handleChange} />
        <Textarea name="about" placeholder="About Me (optional)" value={form.about} onChange={handleChange} />
        <input
          type="file"
          name="avatar"
          accept="image/*"
          onChange={(e) => setForm((prev) => ({ ...prev, avatar: e.target.files[0] }))}
          className={styles.fileInput}
        />

        <button
          type="submit"
          className={styles.button}
        >
          Register
        </button>

        <p className={styles.p}>
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className={styles.link}>
            Connectez-vous ici
          </Link>
        </p>
      </form>

      {message.text && (
        <p
          className={`${styles.message} ${
            message.type === 'success' ? styles.success : styles.error
          }`}
        >
          {message.text}
        </p>
      )}
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