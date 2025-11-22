import { useState, useEffect } from 'react'
import PostForm from '../../../home/components/PostForm'
import styles from './PostsTab.module.css'

export default function PostsTab({ group, showPostForm, setShowPostForm }) {
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [loadingComments, setLoadingComments] = useState({})
  const [postingComment, setPostingComment] = useState({})

  useEffect(() => {
    const fetchPosts = async () => {
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
        {posts.length > 0 ? (
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
          <p className={styles.noPostsText}>No posts yet. Be the first to post!</p>
        )}
      </div>
    </>
  )
}

function PostItem({ post, comments, loadingComments, commentInputs, postingComment, onCommentChange, onCommentSubmit }) {
  return (
    <div className={styles.postItem}>
      <p className={styles.postContent}>{post.content}</p>
      {post.image && (
        <img
          src={`${post.image}`}
          alt="Post"
          className={styles.postImage}
        />
      )}

      <div className={styles.commentsSection}>
        {loadingComments[post.id] ? (
          <div className={styles.loadingComments}>Loading comments...</div>
        ) : (
          <div className={styles.commentsList}>
            {comments[post.id]?.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}

        <CommentInput 
          value={commentInputs[post.id] || ''}
          onChange={(e) => onCommentChange(e.target.value)}
          onSubmit={onCommentSubmit}
          disabled={postingComment[post.id]}
          posting={postingComment[post.id]}
        />
      </div>
    </div>
  )
}

function CommentItem({ comment }) {
  return (
    <div className={styles.commentItem}>
      <p className={styles.commentContent}>{comment.content}</p>
      <p className={styles.commentInfo}>
        {comment.creator_name} • {new Date(comment.created_at).toLocaleString()}
      </p>
    </div>
  )
}

function CommentInput({ value, onChange, onSubmit, disabled, posting }) {
  return (
    <div className={styles.commentInputContainer}>
      <input
        type="text"
        placeholder="Add a comment..."
        value={value}
        onChange={onChange}
        className={styles.commentInput}
      />
      <button
        onClick={onSubmit}
        disabled={disabled}
        className={styles.commentButton}
      >
        {posting ? 'Posting...' : 'Post'}
      </button>
    </div>
  )
}