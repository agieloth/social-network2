// src/app/groups/components/PendingRequests.jsx
'use client'
import { useEffect, useState } from 'react'
import styles from './PendingRequests.module.css'

export default function PendingRequests({ groupId }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/groups/${groupId}/membership/pending_requests`, {
          credentials: 'include'
        })
        
        if (!res.ok) {
          throw new Error(res.status === 403 
            ? 'Only group admin can view pending requests' 
            : 'Failed to fetch requests')
        }

        const data = await res.json()
        setRequests(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [groupId])

  const handleApprove = async (requestId, userId) => {
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/membership/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include'
      })
      
      if (res.ok) {
        setRequests(prev => prev.filter(req => req.request_id !== requestId))
      }
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }

  const handleDecline = async (requestId, userId) => {
    try {
      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/membership/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include'
      })
      
      if (res.ok) {
        setRequests(prev => prev.filter(req => req.request_id !== requestId))
      }
    } catch (err) {
      console.error('Error declining request:', err)
    }
  }

  if (loading) return <div className={styles.loading}>Loading requests...</div>
  if (error) return <div className={styles.error}>{error}</div>

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Pending Join Requests ({requests && requests.length})</h3>
      
      {requests === null ? (
        <p className={styles.noRequests}>No pending requests</p>
      ) : (
        <ul className={styles.list}>
          {requests.map(request => {
            // Construct proper avatar URL
            let avatarUrl = '/avatar.png'
            if (request.avatar) {
              avatarUrl = request.avatar.startsWith('http') 
                ? request.avatar 
                : `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/${request.avatar.replace(/^\/+/, '')}`
            }

            return (
              <li key={request.request_id} className={styles.listItem}>
                <div className={styles.flexBetween}>
                  <div className={styles.flexCenter}>
                    <img
                      src={request.avatar ? `http://localhost:8080/${request.avatar}` : '/avatar.png'}
                      alt={request.username}
                      width={40}
                      height={40}
                      className={styles.avatar}
                      onError={(e) => {
                        e.target.src = '/avatar.png'
                      }}
                    />
                    <div>
                      <p className={styles.username}>{request.username}</p>
                      <p className={styles.requestDate}>
                        Requested {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className={styles.buttonGroup}>
                    <button
                      onClick={() => handleApprove(request.request_id, request.user_id)}
                      className={styles.approveBtn}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecline(request.request_id, request.user_id)}
                      className={styles.declineBtn}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
