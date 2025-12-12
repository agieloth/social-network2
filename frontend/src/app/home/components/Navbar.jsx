// src/components/Navbar.jsx
'use client'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import PostForm from '../../../app/home/components/PostForm';
import { useMessageSidebar } from '../../../contexts/MessageSideBarContext';
import { useWorker } from '../../../contexts/WorkerContext';
import { useNavbar } from '../../../contexts/NavBarContext';
import Image from 'next/image';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user } = useAuth();
  const router = useRouter();


  // Post Form State
  const [showPostForm, setShowPostForm] = useState(false);
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [search, setSearch] = useState(''); // Changed from searchResults to search
  const [results, setResults] = useState([]); // New state for search results
  const [privacy, setPrivacy] = useState('public');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef();

  // Existing Navbar State
  const [showProfile, setShowProfile] = useState(false);
  const [isPrivate, setIsPrivate] = useState(user?.IsPrivate || false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const { worker } = useWorker();
  const { setShowMessages } = useMessageSidebar()
  const { notifications, unreadCount, setNotifications, setUnreadCount } = useNavbar()
  const openMessages = () => setShowMessages(true);

  // Sync isPrivate state with user data
  useEffect(() => {
    if (user?.IsPrivate !== undefined) {
      setIsPrivate(user.IsPrivate);
    }
  }, [user]);

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearch(value);

    // Clear results if search is empty
    if (value.trim().length === 0) {
      setResults([]);
      return;
    }

    // Only search if query is at least 1 character
    if (value.trim().length < 1) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8080/api/search?query=${encodeURIComponent(value)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.warn("Search failed:", res.status);
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error searching users:", err);
      setResults([]);
    }
  };

  const handleSelectUser = (userId) => {
    router.push(`/profile/${userId}`);
    setSearch('');
    setResults([]);
  };

  const handleSubmit = async (e, selectedRecipientIds = []) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);

    const formData = new FormData();
    formData.append("content", content);
    formData.append("privacy", privacy);
    if (image) {
      formData.append("image", image);
    }

    try {
      let finalRecipientIds = [];

      if (privacy === "custom") {
        finalRecipientIds = selectedRecipientIds;
      }

      finalRecipientIds.forEach(id => {
        formData.append("recipient_ids", id);
      });

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erreur lors de la publication");

      setSuccess("✅ Post publié !");
      setContent("");
      setImage(null);
      setPrivacy("public");
      setShowPostForm(false); // FERMER LE FORMULAIRE DE POST APRÈS SUCCÈS

      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }

      // Rafraîchir les posts en appelant l'API pour récupérer le nouveau post
      await fetch("/api/posts", {
        credentials: "include"
      })
        .then(res => res.json())
        .then(data => {
          console.log("Posts mis à jour:", data);
          window.location.reload();
        });

    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePostForm = () => {
    setShowPostForm(prev => !prev);
    // Reset form state when opening
    if (!showPostForm) {
      setError("");
      setSuccess("");
    }
  };

  // NOTE: Notifications are handled by home/page.jsx and passed down as props
  // No need to listen to Worker here - avoids duplication

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        credentials: 'include',
        method: 'POST'
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // 🔥 IMPORTANT: Redirection immédiate
      window.location.href = '/login'
    }
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/notifications", { credentials: 'include' });
      const data = await res.json();

      const uniqueNotifs = [];
      const seenKeys = new Set();

      for (const notif of data) {
        const key = `${notif.sender_id}-${notif.message}-${notif.type}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueNotifs.push(notif);
        }
      }

      setNotifications(uniqueNotifs);
      setUnreadCount(uniqueNotifs.filter(n => !n.seen).length);
    } catch (err) {
      if (!err.message.includes('UNAUTHORIZED') &&
        !err.message.includes('JSON') &&
        !err.message.includes('Unauthorized')) {
        console.error("Error fetching notifications", err);
      }
    }
  };

  const toggleNotifications = async (e) => {
    e.stopPropagation();
    const newState = !showNotifications;
    setShowNotifications(newState);

    if (newState) {
      await fetchNotifications();
      await fetch('http://localhost:8080/api/notifications/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
        credentials: 'include',
      });
      await fetchNotifications();
      setUnreadCount(0);
    }
  };

  const handleAccept = async (notifId, senderId) => {
    try {
      await fetch('/api/follow/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: senderId }),
        credentials: 'include',
      });

      await fetch('/api/notifications/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      });

      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error accepting follow:', err);
    }
  };

  const handleReject = async (notifId, senderId) => {
    try {
      const [rejectRes, seenRes, deleteRes] = await Promise.all([
        fetch('/api/follow/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_id: senderId }),
          credentials: 'include',
        }),
        fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        }),
        fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        })
      ]);

      if (rejectRes.ok && seenRes.ok && deleteRes.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('One or more requests failed');
      }
    } catch (err) {
      console.error('Error rejecting follow:', err);
    }
  };

  const handleApprove = async (notifId, userId, groupId) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/membership/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include'
      })

      if (res.ok) {
        await fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error approving request:', err)
    }
  }

  const handleDecline = async (notifId, userId, groupId) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/membership/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include'
      })
      if (res.ok) {
        await fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error declining request:', err)
    }
  }

  const handleVote = async (eventId, groupId, response, notifId) => {

    try {
      const res = await fetch(`/api/groups/${groupId}/events/${eventId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response }),
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to submit response');
      await fetch('/api/notifications/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      });

      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId }),
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error submitting response:', err);
    }
  };

  const handleInviteAccept = async (groupId, notifId) => {
    try {
      // First accept the invitation (this will update the membership status to 'accepted')
      const res = await fetch(`/api/groups/${groupId}/membership/accept`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        // Mark notification as seen and delete it
        await fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        // Remove the notification from state
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Failed to accept invitation');
      }
    } catch (err) {
      console.error('Error accepting group invitation:', err);
    }
  };

  const handleInviteDecline = async (groupId, notifId) => {
    try {
      // First decline the invitation (this will remove the membership record)
      const res = await fetch(`/api/groups/${groupId}/membership/refuse`, {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        // Mark notification as seen and delete it
        await fetch('/api/notifications/seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        await fetch('/api/notifications/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notifId }),
          credentials: 'include',
        });

        // Remove the notification from state
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        alert(res.status)
        console.error('Failed to decline invitation');
      }
    } catch (err) {
      console.error('Error declining group invitation:', err);
    }
  };

  const togglePrivacy = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/user/toggle-privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_private: !isPrivate }),
        credentials: 'include'
      });
      if (res.ok) {
        setIsPrivate(!isPrivate);
      }
    } catch (err) {
      console.error('Error changing privacy:', err);
    }
  };

  // Handle click outside notifications dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current &&
        !notificationsRef.current.contains(event.target) &&
        !notificationButtonRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial notifications fetch
  useEffect(() => {
    fetchNotifications();
  }, []);
  if (!user) {
    return
  }

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.container}>
          {/* Search bar */}
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Search users..."
              onChange={handleSearch}
              value={search}
              className={styles.searchInput}
            />
            {results && results.length > 0 && (
              <div className={styles.searchResults}>
                {results.map((user) => (
                  <div
                    key={user.id || user.ID}
                    className={styles.searchResultItem}
                    onClick={() => handleSelectUser(user.id || user.ID)}
                  >
                    <p className={styles.searchResultName}>
                      {user.first_name} {user.last_name}
                    </p>
                    <p className={styles.searchResultNickname}>@{user.nickname}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className={styles.actionsContainer}>
            <button onClick={togglePostForm} className={styles.actionButton}>
              <img src="/plus-icon.png" alt="Create post" className={styles.actionIcon} />
            </button>

            <button onClick={openMessages} className={styles.actionButton}>
              <img src="/message-icon.png" alt="Messages" className={styles.actionIcon} />
            </button>

            {/* Notifications dropdown */}
            <div className={styles.notificationsContainer}>
              <button
                ref={notificationButtonRef}
                onClick={toggleNotifications}
                className={styles.notificationButton}
              >
                <img src="/notif-icon.png" className={styles.actionIcon} alt="Notifications" />
                {unreadCount > 0 && (
                  <span className={styles.notificationCount}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  ref={notificationsRef}
                  className={styles.notificationsDropdown}
                >
                  <div className={styles.notificationsHeader}>
                    <h3 className={styles.notificationsTitle}>Notifications</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className={styles.notificationsCloseButton}
                    >
                      ×
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <p className={styles.noNotifications}>No notifications</p>
                  ) : (
                    <div className={styles.notificationsList}>
                      {notifications.map((notif, idx) => (
                        <div
                          key={notif.id ? notif.id : `${notif.sender_id}-${notif.type}-${notif.message}-${idx}`}
                          className={`${styles.notificationItem} ${notif.seen ? styles.notificationSeen : styles.notificationUnseen}`}
                        >
                          <p className={styles.notificationText}>
                            {notif.message}
                          </p>
                          <p className={styles.notificationDate}>
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                          {notif.type === 'follow_request' && (
                            <div className={styles.notificationActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAccept(notif.id, notif.sender_id);
                                }}
                                className={`${styles.notificationActionButton} ${styles.acceptButton}`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(notif.id, notif.sender_id);
                                }}
                                className={`${styles.notificationActionButton} ${styles.rejectButton}`}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {notif.type === 'group_join_request' && (
                            <div className={styles.notificationActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(notif.id, notif.sender_id, notif.group_id);
                                }}
                                className={`${styles.notificationActionButton} ${styles.acceptButton}`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecline(notif.id, notif.sender_id, notif.group_id);
                                }}
                                className={`${styles.notificationActionButton} ${styles.rejectButton}`}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {notif.type === 'group_event_created' && (
                            <div className={styles.notificationActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(notif.event_id, notif.group_id, 'going', notif.id)
                                }}
                                className={`${styles.notificationActionButton} ${styles.acceptButton}`}
                              >
                                Going
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(notif.event_id, notif.group_id, 'not_going', notif.id)
                                }}
                                className={`${styles.notificationActionButton} ${styles.rejectButton}`}
                              >
                                Not Going
                              </button>
                            </div>
                          )}
                          {notif.type === 'group_invitation' && (
                            <div className={styles.notificationActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteAccept(notif.group_id, notif.id)
                                }}
                                className={`${styles.notificationActionButton} ${styles.acceptButton}`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteDecline(notif.group_id, notif.id)
                                }}
                                className={`${styles.notificationActionButton} ${styles.rejectButton}`}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/" className={styles.homeLink}>
              🏠 Home
            </Link>

            <Link href="/groups" className={styles.groupsLink}>👥 Groups</Link>

            {/* User profile dropdown */}
            {user && (
              <div className={styles.profileContainer}>
                <img
                  src={
                    user.Avatar
                      ? user.Avatar.startsWith('http')
                        ? user.Avatar
                        : `http://localhost:8080/${user?.Avatar}`
                      : '/avatar.png'
                  }
                  alt="Avatar"
                  onClick={() => setShowProfile(prev => !prev)}
                  className={styles.profileAvatar}
                />

                {showProfile && (
                  <div className={styles.profileDropdown}>
                    <h2 className={styles.profileName}>
                      {user.FirstName} {user.LastName}
                    </h2>
                    <p className={styles.profileEmail}>{user.Email}</p>
                    <div className={styles.privacyContainer}>
                      <span className={styles.privacyText}>
                        {isPrivate ? '🔒 Private profile' : '🌍 Public profile'}
                      </span>
                      <button
                        onClick={togglePrivacy}
                        className={`${styles.privacyToggle} ${isPrivate ? styles.privacyTogglePrivate : styles.privacyTogglePublic}`}
                      >
                        <div
                          className={`${styles.privacyToggleIndicator} ${isPrivate ? styles.privacyToggleIndicatorPrivate : ''}`}
                        ></div>
                      </button>
                    </div>
                    <button
                      onClick={() => router.push(`/profile/${user.ID}`)}
                      className={`${styles.profileButton} ${styles.viewProfileButton}`}
                    >
                      View profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className={`${styles.profileButton} ${styles.logoutButton}`}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Post Form Modal */}
      {showPostForm && (
        <div className={styles.postFormModalOverlay}>
          <PostForm
            content={content}
            setContent={setContent}
            image={image}
            setImage={setImage}
            privacy={privacy}
            setPrivacy={setPrivacy}
            handleSubmit={handleSubmit}
            creating={creating}
            onClose={() => setShowPostForm(false)}
            ref={fileInputRef}
          />
        </div>
      )}
    </>
  );
}
