// src/app/home/components/PostForm.js
'use client'

import { useEffect, useState, forwardRef } from 'react'
import styles from './PostForm.module.css'

const PostForm = forwardRef(function PostForm(props, fileInputRef) {
  const { content, setContent, image, setImage, privacy, setPrivacy, handleSubmit, creating, onClose } = props;

  const [recipients, setRecipients] = useState([])
  const [recipientIds, setRecipientIds] = useState([])

  // Fonction de fermeture par défaut si onClose n'est pas fourni
  const handleClose = () => {
    console.log('Close button clicked, onClose:', typeof onClose);
    if (onClose && typeof onClose === 'function') {
      console.log('Calling onClose...');
      onClose();
    } else {
      console.warn('onClose prop not provided or not a function');
    }
  };

  // Charger les abonnés quand privacy devient "custom"
  useEffect(() => {
    if (privacy === 'custom') {
      fetch('http://localhost:8080/api/recipients', {
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text(); // lecture en texte brut si erreur
            throw new Error(`Erreur serveur: ${text}`);
          }
          return res.json(); // uniquement si res.ok
        })
        .then((data) => {
          console.log("RÉCIPIENTS :", data);
          setRecipients(data);
        })
        .catch((err) => {
          console.error('Erreur chargement des abonnés :', err.message);
        });
    }
  }, [privacy]);


  const handleCheckboxChange = (id) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    )
  }

  const onSubmit = (e) => {
    handleSubmit(e, recipientIds)
    setRecipientIds([]) // reset après publication
  }


  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.formHeader}>
        <h3 className={styles.formTitle}>Créer un post</h3>
        <button
          type="button"
          onClick={handleClose}
          className={styles.closeButton}
          aria-label="Close post form"
        >
          ✕
        </button>
      </div>
      <textarea
        placeholder="Exprimez-vous..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={styles.textarea}
        rows={3}
        required
      />
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className={styles.fileInput}
        onChange={(e) => setImage(e.target.files[0])}
      />
      <select
        value={privacy}
        onChange={(e) => setPrivacy(e.target.value)}
        className={styles.select}
      >
        <option value="public">Public</option>
        <option value="followers">Abonnés</option>
        <option value="custom">Privé</option>
      </select>

      {/* Checkbox si custom */}
      {privacy === 'custom' && (
        <div className={styles.recipientsContainer}>
          <div className={styles.recipientsTitle}>Choisissez les destinataires :</div>
          {Array.isArray(recipients) && recipients.length === 0 ? (
            <div className={styles.noRecipients}>Aucun abonné disponible.</div>
          ) : (
            (recipients || []).map((user) => (
              <label key={user.ID} className={styles.recipientLabel}>
                <input
                  type="checkbox"
                  checked={recipientIds.includes(user.ID)}
                  onChange={() => handleCheckboxChange(user.ID)}
                  className={styles.checkbox}
                />
                <span>{user.Nickname}</span>
              </label>
            ))
          )}
        </div>
      )}

      <button
        type="submit"
        className={styles.button}
        disabled={creating}
      >
        {creating ? 'Publication...' : 'Publier'}
      </button>
    </form>
  )
})

export default PostForm