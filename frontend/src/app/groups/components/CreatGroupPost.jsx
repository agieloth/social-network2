// src/app/home/components/PostForm.js
'use client'

import { useEffect, useState, forwardRef } from 'react'
import styles from './PostForm.module.css'

const PostForm = forwardRef(function PostForm(
  { content, setContent, image, setImage, privacy, setPrivacy, handleSubmit, creating },
  fileInputRef
) {
  const [recipients, setRecipients] = useState([])
  const [recipientIds, setRecipientIds] = useState([])

  const handleCheckboxChange = (id) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    )
  }

  const onSubmit = (e) => {
    handleSubmit(e, recipientIds)
    setRecipientIds([])
  }

  return (
    <form onSubmit={onSubmit} className={`${styles.form} dark:${styles.darkForm}`}>
      <textarea
        placeholder="Exprimez-vous..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={`${styles.textarea} dark:${styles.darkTextarea} ${styles.placeholder} dark:${styles.darkPlaceholder}`}
        rows={4}
        required
      />
      
      <div className={styles.flexContainer}>
        <div className="flex-1">
          <label className={`${styles.label} dark:${styles.darkLabel}`}>
            Image
          </label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className={styles.fileInput}
            onChange={(e) => setImage(e.target.files[0])}
          />
        </div>
        
        <div className="flex-1">
          <label className={`${styles.label} dark:${styles.darkLabel}`}>
            Confidentialité
          </label>

        </div>
      </div>

      {privacy === 'custom' && (
        <div className={`${styles.recipientsContainer} dark:${styles.darkRecipientsContainer}`}>
          <h3 className={`${styles.label} dark:${styles.darkLabel}`}>Choisissez les destinataires :</h3>
          {Array.isArray(recipients) && recipients.length === 0 ? (
            <p className={`${styles.placeholder} dark:${styles.darkPlaceholder}`}>Aucun abonné disponible.</p>
          ) : (
            <div className={styles.recipientsGrid}>
              {(recipients || []).map((user) => (
                <label key={user.id} className={`${styles.recipientLabel} dark:${styles.darkRecipientLabel}`}>
                  <input
                    type="checkbox"
                    checked={recipientIds.includes(user.id)}
                    onChange={() => handleCheckboxChange(user.id)}
                    className={styles.checkbox}
                  />
                  <span>{user.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={creating}
        className={`${styles.button} dark:${styles.darkButton}`}
      >
        {creating ? 'Publication...' : 'Publier'}
      </button>
    </form>
  )
})

export default PostForm