import { useState, useRef } from 'react'
import PostForm from '../../../home/components/PostForm'
import styles from './PostFormModal.module.css'

export default function PostFormModal({ showPostForm, setShowPostForm, groupId }) {
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCreating(true)

    const formData = new FormData()
    formData.append('content', content)
    formData.append('group_id', groupId)
    if (image) formData.append('image', image)

    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/posts`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to create post')

      setContent('')
      setImage(null)
      setShowPostForm(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Error creating post:', err)
    } finally {
      setCreating(false)
    }
  }

  if (!showPostForm) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <PostForm
          content={content}
          setContent={setContent}
          image={image}
          setImage={setImage}
          handleSubmit={handleSubmit}
          creating={creating}
          fileInputRef={fileInputRef}
          onClose={() => setShowPostForm(false)}
          isGroupPost={true}
        />
      </div>
    </div>
  )
}