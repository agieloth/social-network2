import { useState, useEffect } from 'react'
import styles from './EventsTab.module.css'

export default function EventsTab({ group, showEventForm, setShowEventForm }) {
  const [events, setEvents] = useState([])

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/groups/${group.id}/events`)
        if (!res.ok) throw new Error('Failed to fetch events')
        const data = await res.json()
        setEvents(data || [])
      } catch (err) {
        console.error('Failed to fetch events', err)
      }
    }

    fetchEvents()
  }, [group.id])

  const handleVote = async (eventId, response) => {
    try {
      const res = await fetch(`/api/groups/${group.id}/events/${eventId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response }),
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to submit response')
      fetchEvents()
    } catch (err) {
      console.error('Error submitting response:', err)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowEventForm(true)}
        className={styles.createEventButton}
      >
        Create Event
      </button>

      <div className={styles.eventsList}>
        {events.length > 0 ? (
          events.map(event => (
            <EventItem 
              key={event.id}
              event={event}
              isCreator={group.is_creator}
              onVote={handleVote}
            />
          ))
        ) : (
          <EmptyEvents setShowEventForm={setShowEventForm} />
        )}
      </div>
    </>
  )
}

function EventItem({ event, isCreator, onVote }) {
  return (
    <div className={styles.eventItem}>
      <div className={styles.eventContent}>
        <div className={styles.eventHeader}>
          <h3 className={styles.eventTitle}>{event.title}</h3>
          {isCreator && (
            <span className={styles.organizerBadge}>
              Organizer
            </span>
          )}
        </div>

        <p className={styles.eventDescription}>{event.description}</p>

        <EventDetails event={event} />
        <VotingSection event={event} onVote={onVote} />
      </div>
    </div>
  )
}

function EventDetails({ event }) {
  return (
    <div className={styles.eventDetails}>
      <div className={`${styles.detailItem} ${styles.date}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className={styles.detailIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {new Date(event.event_date).toLocaleString([], {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      <div className={`${styles.detailItem} ${styles.creator}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className={styles.detailIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {event.creator_name}
      </div>
    </div>
  )
}

function VotingSection({ event, onVote }) {
  return (
    <div className={styles.votingSection}>
      <div className={styles.voteButtons}>
        <VoteButton 
          type="going"
          event={event}
          onVote={onVote}
        />
        <VoteButton 
          type="not_going"
          event={event}
          onVote={onVote}
        />
      </div>
    </div>
  )
}

function VoteButton({ type, event, onVote }) {
  const isActive = event.user_response === type
  const count = type === 'going' ? event.going_count : event.not_going_count
  
  const buttonClasses = [
    styles.voteButton,
    isActive && (type === 'going' ? styles.activeGoing : styles.activeNotGoing)
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.voteButtonContainer}>
      <button
        onClick={() => onVote(event.id, type)}
        className={buttonClasses}
      >
        {type === 'going' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className={styles.voteIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Going
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className={styles.voteIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Not Going
          </>
        )}
      </button>
      <span className={styles.voteCount}>
        {count || 0}
      </span>
    </div>
  )
}

function EmptyEvents({ setShowEventForm }) {
  return (
    <div className={styles.emptyStateContainer}>
      <div className={styles.emptyStateContent}>
        <svg xmlns="http://www.w3.org/2000/svg" className={styles.emptyStateIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className={styles.emptyStateTitle}>No events yet</h3>
        <p className={styles.emptyStateText}>Be the first to create an event!</p>
        <button
          onClick={() => setShowEventForm(true)}
          className={styles.emptyStateButton}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={styles.emptyStateButtonIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Event
        </button>
      </div>
    </div>
  )
}