// src/contexts/NavbarContext.jsx
'use client'

import { createContext, useContext, useState } from 'react';

const NavbarContext = createContext();

export function NavbarProvider({ children }) {
  const [searchResults, setSearchResults] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <NavbarContext.Provider value={{
      searchResults,
      setSearchResults,
      showPostForm,
      setShowPostForm,
      showMessages,
      setShowMessages,
      notifications,
      setNotifications,
      unreadCount,
      setUnreadCount
    }}>
      {children}
    </NavbarContext.Provider>
  );
}

export function useNavbar() {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error('useNavbar must be used within a NavbarProvider');
  }
  return context;
}