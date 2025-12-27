'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { authApi, usersApi, postsApi, followApi } from '../../../lib/api'
import toast from 'react-hot-toast'
import styles from './PublicProfilePage.module.css'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function PublicProfilePage() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [posts, setPosts] = useState([])
  const [tab, setTab] = useState('posts')
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const data = await authApi.getProfile()
      setCurrentUser(data)
    } catch {
      router.push('/login')
    }
  }

  useEffect(() => {
    if (!id) return

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const data = await usersApi.getById(id)
        setProfile(data)

        if (!data.is_private || data.is_followed || data.is_owner) {
          await Promise.all([
            loadPosts(),
            loadFollowers(),
            loadFollowing()
          ])
        }
      } catch (err) {
        toast.error("This profile doesn't exist")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [id])

  const loadPosts = async () => {
    try {
      const data = await postsApi.getUserPosts(id)
      setPosts(data || [])
    } catch (err) {
      console.error('Failed to load posts:', err)
    }
  }

  const loadFollowers = async () => {
    try {
      const data = await followApi.getFollowers(id)
      setFollowers(data || [])
    } catch (err) {
      console.error('Failed to load followers:', err)
    }
  }

  const loadFollowing = async () => {
    try {
      const data = await followApi.getFollowing(id)
      setFollowing(data || [])
    } catch (err) {
      console.error('Failed to load following:', err)
    }
  }

  const handleTabClick = (newTab) => setTab(newTab)

  if (loading) {
    return <p className={styles.loading}>Loading profile...</p>
  }

  if (!profile) {
    return null
  }

  return (
    <main className={styles.main}>
      <button onClick={() => router.push('/home')} className={styles.backButton}>
        ← Back to home
      </button>

      <div className={styles.profileContainer}>
        <h1 className={styles.profileTitle}>
          {profile.first_name} {profile.last_name}'s Profile
        </h1>

        <div className={styles.profileCard}>
          <img
            src={
              profile.avatar
                ? profile.avatar.startsWith('http')
                  ? profile.avatar
                  : `${API_BASE_URL}/${profile.avatar}`
                : '/avatar.png'
            }
            alt="Avatar"
            className={styles.avatar}
          />
          <p><strong className={styles.label}>Username:</strong> {profile.first_name} {profile.last_name}</p>
          <p><strong className={styles.label}>Email:</strong> {profile.email}</p>
          <p><strong className={styles.label}>About:</strong> {profile.about || 'N/A'}</p>
          <p><strong className={styles.label}>Date of Birth:</strong> {profile.date_of_birth}</p>

          {!profile.is_owner && (
            <div className={styles.followSection}>
              <FollowButton
                profile={profile}
                currentUser={currentUser}
                onFollowChange={(newStatus) => {
                  setProfile(prev => ({
                    ...prev,
                    is_followed: newStatus.is_followed,
                    is_pending: newStatus.is_pending
                  }))
                }}
              />
            </div>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            onClick={() => handleTabClick('posts')}
            className={`${styles.tab} ${tab === 'posts' ? styles.activeTab : ''}`}
          >
            Posts
          </button>
          <button
            onClick={() => handleTabClick('followers')}
            className={`${styles.tab} ${tab === 'followers' ? styles.activeTab : ''}`}
          >
            Followers
          </button>
          <button
            onClick={() => handleTabClick('following')}
            className={`${styles.tab} ${tab === 'following' ? styles.activeTab : ''}`}
          >
            Following
          </button>
        </div>

        {tab === 'posts' && (
          posts.length === 0 ? (
            <p className={styles.subText}>No posts yet.</p>
          ) : (
            <div className={styles.postList}>
              {posts.map(post => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.postDate}>
                    🕒 {new Date(post.created_at).toLocaleString()}
                  </div>
                  <p className={styles.postContent}>{post.content}</p>
                  {post.image_url && (
                    <img
                      src={post.image_url.startsWith('http') ? post.image_url : `${API_BASE_URL}${post.image_url}`}
                      alt="Post"
                      className={styles.postImage}
                    />
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'followers' && (
          <div className={styles.userList}>
            {followers.length === 0 ? (
              <p className={styles.subText}>No followers yet.</p>
            ) : (
              followers.map(user => (
                <div
                  key={user.ID}
                  className={styles.userCard}
                  onClick={() => router.push(`/profile/${user.ID}`)}
                >
                  <img
                    src={user.Avatar ? `${API_BASE_URL}/${user.Avatar}` : '/avatar.png'}
                    className={styles.userAvatar}
                    alt="avatar"
                  />
                  <div>
                    <p className={styles.userName}>{user.FirstName} {user.LastName}</p>
                    <p className={styles.userNickname}>@{user.Nickname}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'following' && (
          <div className={styles.userList}>
            {following.length === 0 ? (
              <p className={styles.subText}>Not following anyone yet.</p>
            ) : (
              following.map(user => (
                <div
                  key={user.ID}
                  className={styles.userCard}
                  onClick={() => router.push(`/profile/${user.ID}`)}
                >
                  <img
                    src={user.Avatar ? `${API_BASE_URL}/${user.Avatar}` : '/avatar.png'}
                    className={styles.userAvatar}
                    alt="avatar"
                  />
                  <div>
                    <p className={styles.userName}>{user.FirstName} {user.LastName}</p>
                    <p className={styles.userNickname}>@{user.Nickname}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function FollowButton({ profile, currentUser, onFollowChange }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleFollow = async () => {
    if (!currentUser?.ID || isLoading) return
    setIsLoading(true)

    try {
      await followApi.send(profile.id)
      onFollowChange({
        is_followed: !profile.is_private,
        is_pending: profile.is_private
      })
      toast.success(profile.is_private ? 'Follow request sent' : 'Now following')
    } catch (err) {
      toast.error('Failed to follow')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnfollow = async () => {
    if (!currentUser?.ID || isLoading) return
    setIsLoading(true)

    try {
      await followApi.unfollow(profile.id)
      onFollowChange({ is_followed: false, is_pending: false })
      toast.success('Unfollowed successfully')
    } catch (err) {
      toast.error('Failed to unfollow')
    } finally {
      setIsLoading(false)
    }
  }

  if (profile.is_followed) {
    return (
      <button onClick={handleUnfollow} disabled={isLoading} className={styles.unfollowBtn}>
        {isLoading ? 'Loading...' : 'Unfollow'}
      </button>
    )
  }

  if (profile.is_pending) {
    return (
      <button disabled className={styles.pendingBtn}>
        Pending approval
      </button>
    )
  }

  return (
    <button onClick={handleFollow} disabled={isLoading} className={styles.followBtn}>
      {isLoading ? 'Loading...' : profile.is_private ? 'Request to follow' : 'Follow'}
    </button>
  )
}