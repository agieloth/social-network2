'use client'

import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useWorker } from '../contexts/WorkerContext'

// Ce composant initialise le Worker global une seule fois
export function WorkerInitializer() {
  const { user } = useAuth()
  const { worker, setWorker } = useWorker()

  useEffect(() => {
    // Only create worker once and keep it alive
    if (!worker && user?.ID) {
      console.log('🔧 WorkerInitializer: Creating persistent Worker for user:', user.ID)
      
      const newWorker = new Worker('/worker.js')
      
      // Initialize worker with userId
      newWorker.postMessage({ type: 'INIT', userId: user.ID })
      console.log('📨 WorkerInitializer: INIT message sent to Worker')
      
      setWorker(newWorker)

      // Cleanup on unmount - but keep worker alive by NOT closing it
      return () => {
        console.log('⚠️ WorkerInitializer: Component unmounting, but keeping Worker alive')
        // Don't close the worker - it should persist across page navigations
      }
    }
  }, [user?.ID, worker, setWorker])

  return null
}
