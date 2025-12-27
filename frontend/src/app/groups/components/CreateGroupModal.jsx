'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { groupsApi } from '../../../lib/api'
import toast from 'react-hot-toast'
import styles from './CreateGroupModal.module.css'

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const newGroup = await groupsApi.create(title, description)
      toast.success('Group created successfully!')
      
      if (onGroupCreated) {
        onGroupCreated()
      }
      
      router.push(`/groups/${newGroup.id}`)
    } catch (err) {
      toast.error(err.message || 'Failed to create group')
      console.error('Group creation error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create New Group</h2>
          <button 
            onClick={onClose}
            className={styles.closeBtn}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="title" className={styles.label}>
              Group Name *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              required
              maxLength={50}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description" className={styles.label}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              rows={3}
              maxLength={200}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}