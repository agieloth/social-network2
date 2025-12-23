import { useState, useEffect } from 'react'
import styles from './EventFormModal.module.css'

export default function EventFormModal({ showEventForm, setShowEventForm, groupId, onEventCreated }) {
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventDate: ''
  })
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [errors, setErrors] = useState({})
  const [minDateTime, setMinDateTime] = useState('')

  // Set minimum date/time to current date/time
  useEffect(() => {
    const now = new Date()
    // Format to YYYY-MM-DDTHH:mm (local time)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    setMinDateTime(`${year}-${month}-${day}T${hours}:${minutes}`)
  }, [])

  const validateForm = () => {
    const newErrors = {}
    
    if (!eventForm.title.trim()) {
      newErrors.title = 'Event title is required'
    } else if (eventForm.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters'
    }
    
    if (!eventForm.description.trim()) {
      newErrors.description = 'Event description is required'
    } else if (eventForm.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }
    
    if (!eventForm.eventDate) {
      newErrors.eventDate = 'Event date and time is required'
    } else {
      const selectedDate = new Date(eventForm.eventDate)
      const now = new Date()
      if (selectedDate < now) {
        newErrors.eventDate = 'Event date cannot be in the past'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEventSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setCreatingEvent(true)

    try {
      const requestBody = {
        group_id: parseInt(groupId),
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        event_date: new Date(eventForm.eventDate).toISOString()
      }

      const res = await fetch(`http://localhost:8080/api/groups/${groupId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to create event: ${res.status}`)
      }

      const newEvent = await res.json()
      
      // Reset form
      setEventForm({
        title: '',
        description: '',
        eventDate: ''
      })
      setErrors({})
      
      // Close modal
      setShowEventForm(false)
      
      // Callback to refresh events list
      if (onEventCreated) {
        onEventCreated(newEvent)
      }
      
    } catch (err) {
      console.error('Error creating event:', err)
      setErrors({ submit: err.message || 'Failed to create event. Please try again.' })
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
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    if (errors.submit) {
      setErrors(prev => ({ ...prev, submit: '' }))
    }
  }

  if (!showEventForm) return null

  return (
    <div className={styles.modalOverlay} onClick={() => setShowEventForm(false)}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>
              <svg className={styles.titleIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Create New Event
            </h2>
            <p className={styles.subtitle}>Organize an event for your group members</p>
          </div>
          <button 
            className={styles.closeButton}
            onClick={() => setShowEventForm(false)}
            aria-label="Close"
          >
            <svg className={styles.closeIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleEventSubmit} className={styles.form}>
          {errors.submit && (
            <div className={styles.errorBanner}>
              <svg className={styles.errorIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors.submit}
            </div>
          )}

          <FormField
            label="Event Title"
            id="title"
            name="title"
            value={eventForm.title}
            onChange={handleEventChange}
            error={errors.title}
            icon={
              <svg className={styles.fieldIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            }
            required
          />

          <FormField
            label="Description"
            id="description"
            name="description"
            value={eventForm.description}
            onChange={handleEventChange}
            error={errors.description}
            textarea
            rows={4}
            icon={
              <svg className={styles.fieldIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            }
            required
          />

          <FormField
            label="Date & Time"
            id="eventDate"
            name="eventDate"
            type="datetime-local"
            value={eventForm.eventDate}
            onChange={handleEventChange}
            error={errors.eventDate}
            icon={
              <svg className={styles.fieldIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            required
            min={minDateTime}
          />

          <div className={styles.formFooter}>
            <div className={styles.helpText}>
              <svg className={styles.helpIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Members will be able to RSVP once the event is created</span>
            </div>

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
                {creatingEvent ? (
                  <>
                    <svg className={styles.spinner} fill="none" viewBox="0 0 24 24">
                      <circle className={styles.spinnerCircle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className={styles.spinnerPath} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className={styles.submitIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Event
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormField({ label, id, name, value, onChange, type = 'text', textarea = false, error, icon, required = false, rows = 3, min, maxLength }) {
  const charCount = value.length
  const maxChars = maxLength || (textarea ? 500 : 100)
  
  return (
    <div className={styles.formField}>
      <div className={styles.fieldHeader}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}> *</span>}
        </label>
        {maxLength && (
          <span className={`${styles.charCount} ${charCount > maxChars * 0.9 ? styles.charCountWarning : ''}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      
      <div className={`${styles.inputContainer} ${error ? styles.inputError : ''}`}>
        {icon && <div className={styles.iconContainer}>{icon}</div>}
        {textarea ? (
          <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            rows={rows}
            className={styles.textarea}
            required={required}
            maxLength={maxLength}
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
            min={min}
            maxLength={maxLength}
          />
        )}
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          <svg className={styles.errorMessageIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}