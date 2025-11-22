"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PostForm from "./components/PostForm";
import MessageSidebar from "../messages/components/MessageSidebar";
import ChatBox from "../messages/components/ChatBox";
import Post from './components/Post'
import styles from './HomePage.module.css'
import { useMessageSidebar } from "../../contexts/MessageSideBarContext";

export default function HomePage() {
  // States for posts, user, UI, etc.
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [privacy, setPrivacy] = useState("public");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [showPostForm, setShowPostForm] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [realtimeNotification, setRealtimeNotification] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUsers, setChatUsers] = useState([])

  // NEW: Message notification states
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const { showMessages, setShowMessages } = useMessageSidebar()

  const removeNotificationCallback = useRef(null);

  // --- SharedWorker related ---
  const workerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState({});

  // NEW: Throttling ref
  const lastMessageTime = useRef(null);

  const router = useRouter();

  // NEW: Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Track window focus for notification logic
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // NEW: Function to show browser notification
  const showBrowserNotification = useCallback((sender, message) => {

    if ('Notification' in window && Notification.permission === 'granted' && !isWindowFocused) {
      const notification = new Notification(`New message from ${sender.username || sender.name}`, {
        body: message.content,
        icon: sender.avatar || '/default-avatar.png',
        tag: `message-${sender.id || sender.ID}`, // Prevent duplicate notifications from same user
      });

      notification.onclick = () => {
        window.focus();
        // Open chat with the sender if not already open
        if (!openChats.some(c => (c.id || c.ID) === (sender.id || sender.ID))) {
          openChat(sender);
        }
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, [isWindowFocused, openChats]);

  // NEW: Function to handle incoming message notifications
  const handleIncomingMessage = useCallback((messageData) => {
    console.log(messageData, "nothing just test")
    const senderId = messageData.from;
    const sender = chatUsers.find(u => (u.id || u.ID) === senderId) ||
      { id: senderId, username: 'Unknown User' };

    // Update unread message count
    setUnreadMessages(prev => ({
      ...prev,
      [senderId]: (prev[senderId] || 0) + 1
    }));

    //Add to message notifications array
    setMessageNotifications(prev => [{
      id: Date.now(),
      sender,
      message: messageData,
      timestamp: new Date(),
      read: false
    }, ...prev.slice(0, 9)]); // Keep only last 10 notifications

    // Show browser notification if window is not focused
    // Show in-app notification toast
    setRealtimeNotification({
      type: 'message',
      message: `New message from ${sender.username || sender.name}`,
      timestamp: new Date(),
      sender: sender // Add sender info for click handling
    });

    //Auto-remove toast after 5 seconds (increased time)
    setTimeout(() => {
      setRealtimeNotification(null);
    }, 5000);
  }, [chatUsers, showBrowserNotification]);

  // Setup SharedWorker connection once user is set
  useEffect(() => {
    if (!user?.ID) return;

    if (!workerRef.current) {
      workerRef.current = new SharedWorker('/sharedWorker.jsx');
      const port = workerRef.current.port;

      port.start();
      port.postMessage({ type: "INIT", userId: user.ID });

      port.onmessage = (event) => {
        console.log("Message received from SharedWorker:", event.data);

        const { type, data, message } = event.data;

        // Handle incoming messages
        if (data && (type === "message" || data.type === "private")) {
          console.log('Processing chat message');
          setMessages((prev) => [...prev, data]);

          // NEW: Check if message is from another user (not sent by current user)
          if (data.from !== user.ID) {
            handleIncomingMessage(data);
          }
        }
        else if (message && (type === "message" || type === "private")) {
          console.log('Processing chat message (legacy format)');
          setMessages((prev) => [...prev, message]);

          // NEW: Check if message is from another user
          if (message.from !== user.ID) {
            handleIncomingMessage(message);
          }
        }
        // Handle other notifications
        else if (type === "notification" || type === "follow_request" ||
          type === "follow_request_response" || type === "follow_request_cancelled") {
          const notificationData = data || message;
          setNotifications(prev => [notificationData, ...prev]);
          setUnreadCount(prev => prev + 1);
          setRealtimeNotification(notificationData);
        }
        else if (type === "status" || type === "error") {
          const statusMessage = data || message;
          console.log(`[Worker]: ${statusMessage}`);
        }
      };
    }
  }, [user?.ID, handleIncomingMessage]);

  // NEW: Function to mark messages as read when chat is opened
  const markMessagesAsRead = useCallback((userId) => {
    setUnreadMessages(prev => ({
      ...prev,
      [userId]: 0
    }));

    setMessageNotifications(prev =>
      prev.map(notif =>
        (notif.sender.id || notif.sender.ID) === userId
          ? { ...notif, read: true }
          : notif
      )
    );
  }, []);

  // NEW: Enhanced openChat function
  const openChat = (user) => {
    const userId = user.id || user.ID;
    if (!openChats.some((c) => (c.id || c.ID) === userId)) {
      setOpenChats((prev) => [...prev, user]);
    }
    // Mark messages as read when chat is opened
    markMessagesAsRead(userId);
  };

  // Send chat message through SharedWorker with throttling
  const sendMessage = useCallback((chatMsg) => {
    if (!workerRef.current) {
      console.error("SharedWorker not initialized.");
      return;
    }

    if (!chatMsg || typeof chatMsg !== 'object') {
      console.error("Invalid chat message:", chatMsg);
      return;
    }

    // Throttle implementation
    const now = Date.now();
    const throttleDelay = 1000; // 1 second throttle

    if (lastMessageTime.current && now - lastMessageTime.current < throttleDelay) {
      console.log("Message throttled - please wait before sending another message");
      return;
    }

    lastMessageTime.current = now;

    workerRef.current.port.postMessage({ type: "SEND", message: chatMsg });

    const messageWithId = {
      ...chatMsg,
      uniqueId: `${chatMsg.from}-${chatMsg.to}-${chatMsg.timestamp}-${Date.now()}-sent`
    };

    setMessages(prev => {
      const validPrev = prev.filter(m => m && typeof m === 'object');
      const exists = validPrev.some(m =>
        m &&
        m.from === chatMsg.from &&
        m.to === chatMsg.to &&
        m.content === chatMsg.content &&
        m.timestamp && chatMsg.timestamp &&
        Math.abs(new Date(m.timestamp) - new Date(chatMsg.timestamp)) < 1000
      );

      if (exists) return prev;
      return [...prev, messageWithId];
    });
  }, []);

  // NEW: Calculate total unread message count
  const totalUnreadMessages = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);

  // NEW: Handle clicking on notification toast
  const handleNotificationClick = () => {
    if (realtimeNotification && realtimeNotification.sender) {
      // Open the chat with the sender
      openChat(realtimeNotification.sender);
      // Clear the notification
      setRealtimeNotification(null);
    }
  };

  // NEW: Handle clicking on message indicator
  const handleMessageIndicatorClick = () => {
    // Open messages sidebar
    setShowMessages(true);

    // Find users with unread messages and open their chats
    Object.entries(unreadMessages).forEach(([userId, count]) => {
      if (count > 0) {
        const user = chatUsers.find(u => (u.id || u.ID) === parseInt(userId));
        if (user) {
          openChat(user);
        }
      }
    });
  };

  const handleNotificationRemoved = useCallback((removeCallback) => {
    removeNotificationCallback.current = removeCallback;
  }, []);

  const onNotificationRemoved = useCallback((criteria) => {
    if (removeNotificationCallback.current) {
      removeNotificationCallback.current(criteria);
    }
  }, []);

  const togglePostForm = () => {
    setShowPostForm(prev => !prev)
  }

  const openMessages = () => {
    setShowMessages(true);
  };

  // Rest of your existing functions (fetchChatUsers, fetchUser, etc.) remain the same...
  useEffect(() => {
    fetchChatUsers();
    fetchUser();
    fetchPosts();
  }, []);

  const fetchChatUsers = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8080/api/chat-users", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setChatUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/profile", {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Unauthorized");

      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error("Error loading profile:", err);
      router.push("/login");
    }
  };

  const fetchPosts = () => {
    setLoading(true);
    fetch("http://localhost:8080/api/posts", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setPosts(data))
      .catch((err) => console.error("Error fetching posts:", err))
      .finally(() => setLoading(false));
  };

  const fetchUserById = async (userId) => {
    router.push(`/profile/${userId}`);
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
      } else if (privacy === "followers" || privacy === "private") {
        const res = await fetch("http://localhost:8080/api/recipients", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Impossible de récupérer les destinataires");
        const data = await res.json();
        finalRecipientIds = data.map((user) => user.id);
      }

      finalRecipientIds.forEach(id => {
        formData.append("recipient_ids", id);
      });

      const res = await fetch("http://localhost:8080/api/posts", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erreur lors de la publication");

      setSuccess("✅ Post publié !");
      setContent("");
      setImage(null);
      setPrivacy("public");

      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }

      fetchPosts();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearch(value);

    if (value.length > 1) {
      try {
        const res = await fetch(`http://localhost:8080/api/search?query=${value}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to search users");
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error("Error searching users:", err);
      }
    } else {
      setResults([]);
    }
  };

  const handleLogout = async () => {
    try {
      if (workerRef.current) {
        workerRef.current.port.close();
        workerRef.current = null;
      }

      const res = await fetch("http://localhost:8080/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        router.push("/login");
      } else {
        throw new Error("Logout failed");
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const fileInputRef = useRef();

  return (
    <div className={styles.pageContainer}>
      {/* NEW: Notification Toast */}
      {realtimeNotification && (
        <div
          className={`${styles.notificationToast} ${realtimeNotification.type === 'message' ? styles.messageNotification : ''}`}
          onClick={realtimeNotification.type === 'message' ? handleNotificationClick : undefined}
          style={{ cursor: realtimeNotification.type === 'message' ? 'pointer' : 'default' }}
        >
          <div className={styles.notificationContent}>
            <span>
              {realtimeNotification.message}
              {realtimeNotification.type === 'message' && (
                <small style={{ display: 'block', opacity: 0.8, fontSize: '0.75rem' }}>
                  Click to open chat
                </small>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRealtimeNotification(null);
              }}
              className={styles.closeNotification}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showMessages && user && (
        <MessageSidebar
          chatUsers={chatUsers}
          showMessages={showMessages}
          setShowMessages={setShowMessages}
          openChat={openChat}
          currentUserId={user?.ID}
          fetchChatUsers={fetchChatUsers}
          unreadMessages={unreadMessages} // NEW: Pass unread messages
        />
      )}

      {/* NEW: Message notification indicator in top bar or wherever appropriate */}
      {totalUnreadMessages > 0 && (
        <div
          className={styles.messageIndicator}
          onClick={handleMessageIndicatorClick}
        >
          <span className={styles.unreadBadge}>{totalUnreadMessages}</span>
          <span>New messages - Click to open</span>
        </div>
      )}

      <div className={styles.postFormContainer}>
        {showPostForm && (
          <div className={styles.postFormWrapper}>
            <PostForm
              content={content}
              setContent={setContent}
              image={image}
              setImage={setImage}
              privacy={privacy}
              setPrivacy={setPrivacy}
              handleSubmit={handleSubmit}
              creating={creating}
              ref={fileInputRef}
            />
          </div>
        )}
      </div>

      <h2 className={styles.postsHeading}></h2>
      {posts === null ? (
        <p className={styles.noPosts}>Aucun post à afficher.</p>
      ) : (
        posts.map(post => (
          <Post key={post.id} post={post} fetchUserById={fetchUserById} />
        ))
      )}

      <div className={styles.chatBoxContainer}>
        {openChats.map((u) => (
          <ChatBox
            key={u.id || u.ID}
            recipient={u}
            currentUser={user}
            messages={messages}
            input={input[u.id || u.ID] || ''}
            setInput={(val) => setInput(prev => ({ ...prev, [u.id || u.ID]: val }))}
            onSendMessage={sendMessage}
            onClose={() => {
              setOpenChats(prev => prev.filter(c => (c.id || c.ID) !== (u.id || u.ID)));
              markMessagesAsRead(u.id || u.ID); // Mark as read when closing
            }}
            unreadCount={unreadMessages[u.id || u.ID] || 0} // NEW: Pass unread count
          />
        ))}
      </div>
    </div>
  )
}