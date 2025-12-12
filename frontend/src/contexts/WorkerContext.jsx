'use client'

import React, { createContext, useContext, useState } from 'react'

const WorkerContext = createContext(null)

export function WorkerProvider({ children }) {
  const [worker, setWorker] = useState(null)

  return (
    <WorkerContext.Provider value={{ worker, setWorker }}>
      {children}
    </WorkerContext.Provider>
  )
}

export function useWorker() {
  const context = useContext(WorkerContext)
  if (!context) {
    throw new Error('useWorker must be used within WorkerProvider')
  }
  return context
}
