import { useState } from 'react'
import styles from './EventFormModal.module.css'

export default function EventFormModal({ showEventForm, setShowEventForm, groupId }) {
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventDate: ''
  })
  const [creatingEvent, setCreatingEvent] = useState(false)

  const handleEventSubmit = async (e) => {
    e.preventDefault()
    setCreatingEvent(true)

    try {
      const requestBody = {
        group_id: parseInt(groupId),
        title: eventForm.title,
        description: eventForm.description,
        event_date: new Date(eventForm.eventDate).toISOString()
      }

      const res = await fetch(`/api/groups/${groupId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error('Failed to create event: ' + errorText)
      }

      setEventForm({
        title: '',
        description: '',
        eventDate: ''
      })
      setShowEventForm(false)
    } catch (err) {
      console.error('Error creating event:', err)
    } finally {
      setCreatingEvent(false)
    }
  }

  const handleEventChange = (e) => {
    const { name, value } = e.target
    setEventForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  if (!showEventForm) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <form onSubmit={handleEventSubmit} className={styles.form}>
          <h2 className={styles.title}>Create New Event</h2>

          <FormField
            label="Event Title"
            id="title"
            name="title"
            value={eventForm.title}
            onChange={handleEventChange}
            required
          />

          <FormField
            label="Description"
            id="description"
            name="description"
            value={eventForm.description}
            onChange={handleEventChange}
            textarea
            required
          />

          <FormField
            label="Event Date & Time"
            id="eventDate"
            name="eventDate"
            type="datetime-local"
            value={eventForm.eventDate}
            onChange={handleEventChange}
            required
          />

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => setShowEventForm(false)}
              className={`${styles.button} ${styles.buttonCancel}`}
              disabled={creatingEvent}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonSubmit}`}
              disabled={creatingEvent}
            >
              {creatingEvent ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormField({ label, id, name, value, onChange, type = 'text', textarea = false, required = false }) {
  return (
    <div className={styles.formField}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          rows={3}
          className={styles.textarea}
          required={required}
        />
      ) : (
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          className={styles.input}
          required={required}
        />
      )}
    </div>
  )
}