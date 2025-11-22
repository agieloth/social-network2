'use client'

import { useState } from 'react'
import styles from './CreatePostForm.module.css'

export default function CreatePostForm({ onPostCreated }) {
  const [content, setContent] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    const res = await fetch('http://localhost:8080/api/posts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, privacy })
    })

    if (res.ok) {
      const newPost = await res.json()
      onPostCreated && onPostCreated(newPost)
      setContent('')
      setMessage('✅ Post created')
    } else {
      const err = await res.text()
      setMessage(`❌ ${err}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <textarea
        className={styles.textarea}
        placeholder="What's on your mind?"
        value={content}
        onChange={e => setContent(e.target.value)}
        required
      />
      <select value={privacy} onChange={e => setPrivacy(e.target.value)} className={styles.select}>
        <option value="public">Public</option>
        <option value="followers">Followers</option>
        <option value="custom">Custom</option>
      </select>
      <button className={styles.button}>Post</button>
      {message && <p className={styles.message}>{message}</p>}
    </form>
  )
}
