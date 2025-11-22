// src/app/home/hooks/useUser.js
import { useState, useEffect } from 'react'

export function useUser() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch('http://localhost:8080/api/profile', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
    }
    fetchUser()
  }, [])

  return [user, setUser]
}
