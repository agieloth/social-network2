// components/Post.js

'use client'

import { useState } from 'react'
import CommentSection from './CommentSection'
import styles from './Post.module.css'

export default function Post({ post, fetchUserById }) {
  const [showComments, setShowComments] = useState(false)

  const toggleComments = () => {
    setShowComments(!showComments)
  }

  return (
    <div className={styles.post}>
      {/* Auteur */}
      <div
        onClick={() => fetchUserById(post.author_id)}
        className={styles.authorContainer}
      >
        <img
          src={
            post.author_avatar
              ? post.author_avatar.startsWith('http')
                ? post.author_avatar
                : `http://localhost:8080/${post?.author_avatar}`
              : '/avatar.png'
          }
          alt="Avatar"
          className={styles.avatar}
        />
        <div>
          <div className={styles.authorName}>
            {post.author_name}
          </div>
          <div className={styles.postDate}>
            Publié le {new Date(post.created_at).toLocaleString()}
          </div>
        </div>

      </div>

      {/* Contenu du post */}
      <p className={styles.postContent}>{post.content}</p>

      {/* Image */}
      {post.image_url && (
        <img
          src={`http://localhost:8080${post.image_url}`}
          alt="Post"
          className={styles.postImage}
        />
      )}

      {/* Icône/commentaire toggle */}
      <div className={styles.actionsContainer}>
        <button
          onClick={toggleComments}
          className={styles.toggleCommentsButton}
        >
          <img src="/comment-icon.png" alt="Commenter" className={styles.commentIcon} />
          {showComments ? 'Masquer les commentaires' : 'Voir les commentaires'}
        </button>
      </div>

      {showComments && (
        <div className={styles.commentsSection}>
          <CommentSection postId={post.id} />
        </div>
      )}
    </div>
  )
}