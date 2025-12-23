'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useWorker } from '../contexts/WorkerContext'
import { useNavbar } from '../contexts/NavBarContext'

// Ce composant initialise le Worker global une seule fois
export function WorkerInitializer() {
  const { user } = useAuth()
  const { worker, setWorker } = useWorker()
  const { setNotifications, setUnreadCount } = useNavbar()
  const handlerRef = useRef(null)

  useEffect(() => {
    // Only create worker once and keep it alive
    if (!worker && user?.ID) {
      console.log('🔧 WorkerInitializer: Creating persistent Worker for user:', user.ID)
      
      const newWorker = new Worker('/worker.js')
      
      // Initialize worker with userId
      newWorker.postMessage({ type: 'INIT', userId: user.ID })
      console.log('📨 WorkerInitializer: INIT message sent to Worker')
      
      setWorker(newWorker)

      // attach a centralized message handler to update global notifications
      const handler = async (event) => {
        const { type, data, message } = event.data || {}
        // handle notification-related messages
        if (type === 'notification' || type === 'follow_request' || type === 'group_join_request' || type === 'group_invitation' || type === 'group_event_created') {
          try {
            // fetch latest notifications from server to keep accurate state
            const res = await fetch('http://localhost:8080/api/notifications', { credentials: 'include' })
            if (!res.ok) {
              console.warn('WorkerInitializer: failed to fetch notifications', res.status)
              return
            }
            const data = await res.json()
            // dedupe
            const uniqueNotifs = []
            const seenKeys = new Set()
            for (const notif of data) {
              const key = `${notif.sender_id}-${notif.message}-${notif.type}`
              if (!seenKeys.has(key)) {
                seenKeys.add(key)
                uniqueNotifs.push(notif)
              }
            }
            setNotifications(uniqueNotifs)
            setUnreadCount(uniqueNotifs.filter(n => !n.seen).length)
          } catch (e) {
            console.warn('WorkerInitializer: failed to update navbar notifications', e)
          }
        }
      }
      handlerRef.current = handler
      newWorker.addEventListener('message', handler)

      // Cleanup on unmount - but keep worker alive by NOT closing it
      return () => {
        console.log('⚠️ WorkerInitializer: Component unmounting, but keeping Worker alive')
        if (handlerRef.current) {
          newWorker.removeEventListener('message', handlerRef.current)
        }
        // Don't close the worker - it should persist across page navigations
      }
    }
  }, [user?.ID, worker, setWorker])

  return null
}
