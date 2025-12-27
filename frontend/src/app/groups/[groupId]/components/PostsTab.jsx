import { useState, useEffect } from 'react'
import { groupsApi } from '../../../../lib/api'
import toast from 'react-hot-toast'
import PostForm from '../../../home/components/PostForm'
import styles from './PostsTab.module.css'
import Image from 'next/image'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function PostsTab({ group, showPostForm, setShowPostForm }) {
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [loadingComments, setLoadingComments] = useState({})
  const [postingComment, setPostingComment] = useState({})
  const [loadingPosts, setLoadingPosts] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true)
      try {
        const data = await groupsApi.getPosts(group.id)
        setPosts(data || [])

        if (data?.length) {
          data.forEach(post => fetchComments(post.id))
        }
      } catch (err) {
        console.error('Failed to fetch posts', err)
        toast.error('Failed to load posts')
      } finally {
        setLoadingPosts(false)
      }
    }

    fetchPosts()
  }, [group.id])

  const fetchComments = async (postId) => {
    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }))
      const data = await groupsApi.getComments(group.id, postId)
      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }))
    } catch (err) {
      console.error('Failed to fetch comments', err)
      // Silencieux si pas de commentaires
      setComments(prev => ({
        ...prev,
        [postId]: []
      }))
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  const handleCommentSubmit = async (postId) => {
    const content = commentInputs[postId]?.trim()
    if (!content) return

    try {
      setPostingComment(prev => ({ ...prev, [postId]: true }))

      const formData = new FormData()
      formData.append('content', content)
      formData.append('post_id', postId)

      await groupsApi.createComment(group.id, postId, formData)

      // ✅ Re-fetch les commentaires au lieu de les ajouter manuellement
      // Cela garantit qu'on a les données du serveur
      await fetchComments(postId)

      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }))
      toast.success('Comment posted!')
    } catch (err) {
      console.error('Error posting comment:', err)
      toast.error('Failed to post comment')
    } finally {
      setPostingComment(prev => ({ ...prev, [postId]: false }))
    }
  }

  return (
    <>
      <button
        onClick={() => setShowPostForm(true)}
        className={styles.createPostButton}
      >
        Create Post
      </button>

      <div className={styles.postsContainer}>
        {loadingPosts ? (
          <div className={styles.loadingPosts}>
            <div className={styles.spinner}></div>
            <p>Loading posts...</p>
          </div>
        ) : posts.length > 0 ? (
          posts.map(post => (
            <PostItem
              key={post.id}
              post={post}
              comments={comments}
              loadingComments={loadingComments}
              commentInputs={commentInputs}
              postingComment={postingComment}
              onCommentChange={(value) => setCommentInputs(prev => ({ ...prev, [post.id]: value }))}
              onCommentSubmit={() => handleCommentSubmit(post.id)}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <p className={styles.noPostsText}>No posts yet</p>
            <p className={styles.emptySubtitle}>Be the first to share something with the group!</p>
          </div>
        )}
      </div>
    </>
  )
}

function PostItem({ post, comments, loadingComments, commentInputs, postingComment, onCommentChange, onCommentSubmit }) {
  const [showFullContent, setShowFullContent] = useState(false)
  const maxContentLength = 300

  // Format the date nicely
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Get display name - with fallbacks
  const getDisplayName = () => {
    if (post.author_name) return post.author_name
    if (post.author_username) return post.author_username
    if (post.author_full_name) return post.author_full_name
    return 'Group Member'
  }

  // Check if content needs truncation
  const needsTruncation = post.content?.length > maxContentLength
  const displayContent = showFullContent
    ? post.content
    : (needsTruncation ? `${post.content.substring(0, maxContentLength)}...` : post.content)

  return (
    <div className={styles.postItem}>
      <div className={styles.postHeader}>
        <div className={styles.authorInfo}>
          {post.author_avatar ? (
            <div className={styles.avatarContainer}>
              <img
                src={post.author_avatar}
                alt={getDisplayName()}
                className={styles.postAuthorAvatar}
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = '/default-avatar.png'
                }}
              />
              {post.is_online && <span className={styles.onlineIndicator}></span>}
            </div>
          ) : (
            <div className={styles.avatarPlaceholder}>
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.authorDetails}>
            <div className={styles.authorNameRow}>
              <p className={styles.postAuthorName}>
                {getDisplayName()}
                {post.is_group_admin && (
                  <span className={styles.adminBadge} title="Group Admin">👑</span>
                )}
              </p>
              {post.author_title && (
                <span className={styles.authorTitle}>{post.author_title}</span>
              )}
            </div>
            <p className={styles.postMeta}>
              <span className={styles.postDate}>{formatDate(post.created_at)}</span>
              {post.updated_at !== post.created_at && (
                <span className={styles.editedBadge} title="Edited">✏️</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.postBody}>
        <p className={styles.postContent}>
          {displayContent}
          {needsTruncation && !showFullContent && (
            <button
              onClick={() => setShowFullContent(true)}
              className={styles.readMoreButton}
            >
              Read more
            </button>
          )}
          {needsTruncation && showFullContent && (
            <button
              onClick={() => setShowFullContent(false)}
              className={styles.readMoreButton}
            >
              Show less
            </button>
          )}
        </p>

        {post.image && (
          <div className={styles.imageContainer}>
            <img
              src={post.image.startsWith('http') ? post.image : `${API_BASE_URL}${post.image}`}
              alt="Post"
              className={styles.postImage}
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null
                e.target.style.display = 'none'
              }}
            />
          </div>
        )}
      </div>

      <div className={styles.postStats}>
        <span className={styles.statItem}>
          <span className={styles.statIcon}>💬</span>
          <span className={styles.statText}>
            {comments[post.id]?.length || 0} {comments[post.id]?.length === 1 ? 'comment' : 'comments'}
          </span>
        </span>
      </div>

      <div className={styles.commentsSection}>
        {loadingComments[post.id] ? (
          <div className={styles.loadingComments}>
            <span className={styles.miniSpinner}></span>
            Loading comments...
          </div>
        ) : (
          <>
            {comments[post.id]?.map(comment => (
              <div key={comment.id} className={styles.commentItem}>
                <div className={styles.commentHeader}>
                  {comment.author_avatar ? (
                    <img
                      src={comment.author_avatar}
                      alt={comment.author_name || 'User'}
                      className={styles.commentAvatar}
                      onError={(e) => {
                        e.target.onerror = null
                        e.target.src = '/default-avatar.png'
                      }}
                    />
                  ) : (
                    <div className={styles.commentAvatarPlaceholder}>
                      {(comment.author_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.commentContent}>
                    <div className={styles.commentAuthorRow}>
                      <p className={styles.commentAuthor}>
                        {comment.author_name || comment.author_username || 'Group Member'}
                      </p>
                      <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
                    </div>
                    <p className={styles.commentText}>{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        <div className={styles.commentInputContainer}>
          <input
            type="text"
            placeholder="Write a comment..."
            value={commentInputs[post.id] || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !postingComment[post.id]) {
                onCommentSubmit()
              }
            }}
            disabled={postingComment[post.id]}
            className={styles.commentInput}
          />
          <button
            onClick={onCommentSubmit}
            disabled={!commentInputs[post.id]?.trim() || postingComment[post.id]}
            className={styles.commentButton}
          >
            {postingComment[post.id] ? (
              <>
                <span className={styles.miniSpinner}></span>
                Posting...
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}