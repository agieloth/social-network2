import { useState, useEffect } from 'react'
import PostForm from '../../../home/components/PostForm'
import styles from './PostsTab.module.css'
import Image from 'next/image'

export default function PostsTab({ group, showPostForm, setShowPostForm }) {
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [loadingComments, setLoadingComments] = useState({})
  const [postingComment, setPostingComment] = useState({})
  const [loadingPosts, setLoadingPosts] = useState(true) // NEW: Loading state for posts

  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true) // NEW: Start loading
      try {
        const res = await fetch(`/api/groups/${group.id}/posts`)
        if (!res.ok) throw new Error('Failed to fetch posts')
        const data = await res.json()
        setPosts(data || [])
        
        if (data?.length) {
          data.forEach(post => fetchComments(post.id))
        }
      } catch (err) {
        console.error('Failed to fetch posts', err)
      } finally {
        setLoadingPosts(false) // NEW: Stop loading
      }
    }

    fetchPosts()
  }, [group.id])

  const fetchComments = async (postId) => {
    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }))
      const res = await fetch(`/api/groups/${group.id}/posts/${postId}/comments`, {
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to fetch comments')

      const data = await res.json()
      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }))
    } catch (err) {
      console.error('Failed to fetch comments', err)
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  const handleCommentSubmit = async (postId) => {
    const content = commentInputs[postId]?.trim()
    if (!content) return

    try {
      setPostingComment(prev => ({ ...prev, [postId]: true }))

      const res = await fetch(`/api/groups/${group.id}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to post comment')

      const newComment = await res.json()
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }))
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }))
    } catch (err) {
      console.error('Error posting comment:', err)
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
              src={`${post.image}`}
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
          <span className={styles.statCount}>{comments[post.id]?.length || 0}</span>
        </span>
      </div>

      <div className={styles.commentsSection}>
        {loadingComments[post.id] ? (
          <div className={styles.loadingComments}>
            <div className={styles.commentSpinner}></div>
            Loading comments...
          </div>
        ) : (
          <div className={styles.commentsList}>
            {comments[post.id]?.slice(0, 3).map(comment => (
              <CommentItem key={comment.id} comment={comment} formatDate={formatDate} />
            ))}
            
            {comments[post.id]?.length > 3 && (
              <button className={styles.viewMoreComments}>
                View {comments[post.id].length - 3} more comments
              </button>
            )}
          </div>
        )}

        <CommentInput 
          value={commentInputs[post.id] || ''}
          onChange={(e) => onCommentChange(e.target.value)}
          onSubmit={onCommentSubmit}
          disabled={postingComment[post.id]}
          posting={postingComment[post.id]}
          placeholder={`Comment as ${getDisplayName()}...`}
        />
      </div>
    </div>
  )
}

function CommentItem({ comment, formatDate }) {
  const getCommentAuthorName = () => {
    if (comment.author_name) return comment.author_name
    if (comment.author_username) return comment.author_username
    if (comment.author_full_name) return comment.author_full_name
    return 'Commenter'
  }

  return (
    <div className={styles.commentItem}>
      <div className={styles.commentHeader}>
        {comment.author_avatar ? (
          <img 
            src={comment.author_avatar} 
            alt={getCommentAuthorName()} 
            className={styles.commentAvatar}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = '/default-avatar.png'
            }}
          />
        ) : (
          <div className={styles.commentAvatarPlaceholder}>
            {getCommentAuthorName().charAt(0).toUpperCase()}
          </div>
        )}
        <div className={styles.commentAuthorInfo}>
          <p className={styles.commentAuthorName}>
            {getCommentAuthorName()}
            {comment.is_group_admin && (
              <span className={styles.commentAdminBadge} title="Group Admin">👑</span>
            )}
          </p>
          <p className={styles.commentDate}>{formatDate(comment.created_at)}</p>
        </div>
      </div>
      <p className={styles.commentContent}>{comment.content}</p>
    </div>
  )
}

function CommentInput({ value, onChange, onSubmit, disabled, posting, placeholder }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className={styles.commentInputContainer}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyPress={handleKeyPress}
        className={styles.commentInput}
        disabled={disabled}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className={styles.commentButton}
      >
        {posting ? (
          <>
            <span className={styles.postingSpinner}></span>
            Posting...
          </>
        ) : 'Post'}
      </button>
    </div>
  )
}