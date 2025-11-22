'use client'

import { useState, useRef } from 'react'
import styles from './CommentSection.module.css'

export default function CommentSection({ postId }) {
    const [comments, setComments] = useState([])
    const [content, setContent] = useState('')
    const fileInputRef = useRef(null)

    const fetchComments = async () => {
        try {
            const res = await fetch(`http://localhost:8080/api/comments/post?id=${postId}`, {
                credentials: 'include',
            })
            if (res.ok) {
                const data = await res.json()
                setComments(data)
            }
        } catch (err) {
            console.error('Erreur chargement commentaires', err)
        }
    }


    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!content.trim() && !fileInputRef.current.files[0]) {
            alert("Vous devez écrire un message ou ajouter une image.");
            return;
        }

        const formData = new FormData()
        formData.append('post_id', postId)
        formData.append('content', content)
        if (fileInputRef.current.files[0]) {
            formData.append('image', fileInputRef.current.files[0])
        }

        try {
            const res = await fetch(`http://localhost:8080/api/comments`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })


            if (res.ok) {
                setContent('')
                if (fileInputRef.current) fileInputRef.current.value = ''
                fetchComments()
            }
        } catch (err) {
            console.error('Erreur ajout commentaire', err)
        }
    }

    // Auto-fetch des commentaires au chargement
    useState(() => {
        fetchComments()
    }, [])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.form}>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Écrire un commentaire..."
                    className={styles.textarea}
                />
                <input type="file" accept="image/jpeg,image/png,image/gif" ref={fileInputRef} />
                <button
                    type="submit"
                    className={styles.button}
                >
                    Publier
                </button>
            </form>

            {/* Liste des commentaires */}
            <div className={styles.commentsContainer}>
                {comments && comments.length > 0 ? (
                    comments.map((comment) => (
                        <div key={comment.id} className={styles.comment}>
                            <div className={styles.commentHeader}>
                                <img
                                    src={
                                        comment.author.avatar
                                            ? comment.author.avatar.startsWith('http')
                                                ? comment.author.avatar
                                                : `http://localhost:8080/${comment.author.avatar}`
                                            : '/avatar.png'
                                    }
                                    alt="Avatar"
                                    className={styles.avatar}
                                />
                                <div>
                                    <div className={styles.authorName}>
                                        {comment.author.first_name} {comment.author.last_name}
                                    </div>
                                    <div className={styles.commentDate}>
                                        Publié le {new Date(comment.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <p className={styles.commentContent}>{comment.content}</p>
                            {comment.image_url && (
                                <img
                                    src={`http://localhost:8080${comment.image_url}`}
                                    alt="Image commentaire"
                                    className={styles.commentImage}
                                />
                            )}
                        </div>
                    ))
                ) : (
                    <p className={styles.noComments}>Aucun commentaire pour l’instant. Soyez le premier à en écrire un !</p>
                )}


            </div>
        </div>
    )
}