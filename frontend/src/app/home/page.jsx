"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PostForm from "./components/PostForm";
import Post from './components/Post'
import styles from './HomePage.module.css'
import { useMessageSidebar } from "../../contexts/MessageSideBarContext";
import { useWorker } from "../../contexts/WorkerContext";
import { useNavbar } from "../../contexts/NavBarContext";
import { useChat } from "../../contexts/ChatContext";

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
  const [showPostForm, setShowPostForm] = useState(false)
  const [realtimeNotification, setRealtimeNotification] = useState(null)

  // NEW: Message notification states
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const { showMessages, setShowMessages } = useMessageSidebar()
  const { worker: contextWorker, setWorker } = useWorker()
  const { setNotifications, setUnreadCount } = useNavbar()

  // Use global chat context
  const globalChat = useChat();
  
  const removeNotificationCallback = useRef(null);

  // --- Worker related ---
  const workerRef = useRef(contextWorker);

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
      // Ensure sender has a valid name
      const senderName = sender?.full_name || sender?.username || sender?.name || `User ${sender?.id || sender?.ID || '?'}`;
      
      const notification = new Notification(`New message from ${senderName}`, {
        body: message.content,
        icon: sender?.avatar || '/default-avatar.png',
        tag: `message-${sender?.id || sender?.ID}`,
      });

      notification.onclick = () => {
        window.focus();
        globalChat.openChat(sender);
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, [isWindowFocused, globalChat]);

  // NEW: Function to handle incoming message notifications
  const handleIncomingMessage = useCallback((messageData) => {
    console.log(messageData, "nothing just test")
    const senderId = messageData.from;
    let sender = globalChat.chatUsers.find(u => (u.id || u.ID) === senderId);
    
    // If sender not found in chatUsers, create a basic object with the data we have
    if (!sender) {
      sender = {
        id: senderId,
        username: messageData.sender_nickname || messageData.senderNickname || `User ${senderId}`,
        full_name: messageData.sender_nickname || messageData.senderNickname || `User ${senderId}`,
        name: messageData.sender_nickname || messageData.senderNickname || `User ${senderId}`,
        avatar: '/avatar.png'
      };
    }

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

    // Show in-app notification toast
    const displayName = sender.full_name || sender.username || sender.name || `User ${senderId}`;
    setRealtimeNotification({
      type: 'message',
      message: `New message from ${displayName}`,
      timestamp: new Date(),
      sender: sender // Add sender info for click handling
    });

    // Show browser notification
    showBrowserNotification(sender, messageData);

    //Auto-remove toast after 5 seconds (increased time)
    setTimeout(() => {
      setRealtimeNotification(null);
    }, 5000);
  }, [globalChat, showBrowserNotification]);

  // Setup Worker message handler - use Worker from context or create local
  // NEW: Setup Worker message handler - CRITICAL: Keep stable to avoid re-registration
  const handleWorkerMessage = useCallback((event) => {
    console.log("📨 Message received from Worker in home/page.jsx:", event.data);

    const { type, data, message } = event.data;

    // Handle incoming PRIVATE messages only (show toast notification)
    if (data && (type === "private" || data.type === "private")) {
      console.log('Processing private chat message in home');
      
      // Add message to global chat context
      globalChat.addMessageForRecipient(data);
      
      // Check if message is from another user (not sent by current user)
      if (data.from !== user?.ID) {
        handleIncomingMessage(data);
      }
    }
    // Handle GROUP messages (no toast, just store)
    else if (data && (type === "group_message" || data.type === "group_message")) {
      console.log('Processing group message in home');
      // Group messages are handled elsewhere
    }
    // Handle other notifications (no toast, just add to notification list with unread count)
    else if (type === "notification" || type === "follow_request" ||
      type === "follow_request_response" || type === "follow_request_cancelled" ||
      type === "group_event_created" || type === "group_join_request" ||
      type === "group_invitation" || type === "user_online") {
      const notificationData = data || message;
      console.log('Processing notification:', type, notificationData);
      setNotifications(prev => [notificationData, ...prev]);
      // DO NOT show toast for non-message notifications
    }
    else if (type === "status" || type === "error") {
      const statusMessage = data || message;
      console.log(`[Worker]: ${statusMessage}`);
    }
  }, [user?.ID, handleIncomingMessage, setNotifications, setUnreadCount, globalChat]);

  useEffect(() => {
    let activeWorker = workerRef.current;
    
    // If no worker yet, create one locally
    if (!activeWorker && user?.ID) {
      console.log("🔧 Creating Worker in home/page.jsx for user:", user.ID);
      try {
        activeWorker = new Worker('/worker.js');
        activeWorker.postMessage({ type: 'INIT', userId: user.ID });
        workerRef.current = activeWorker;
        setWorker(activeWorker); // Store in context
      } catch (err) {
        console.error("❌ Error creating Worker:", err);
        return;
      }
    }

    if (!activeWorker) {
      console.log("⏳ Worker not yet available in home/page.jsx");
      return;
    }

    console.log("✅ Worker available in home/page.jsx, setting up message handler");

    // Use addEventListener with the stable handler
    activeWorker.addEventListener('message', handleWorkerMessage);

    // Cleanup: Remove listener on unmount or handler change
    return () => {
      activeWorker.removeEventListener('message', handleWorkerMessage);
    };
  }, [contextWorker, user?.ID, handleWorkerMessage]);

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
  const openChat = useCallback((user) => {
    globalChat.openChat(user);
    markMessagesAsRead(user.id || user.ID);
  }, [globalChat]);

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
    const throttleDelay = 500; // 0.5 second throttle

    if (lastMessageTime.current && now - lastMessageTime.current < throttleDelay) {
      console.log("Message throttled - please wait before sending another message");
      return;
    }

    lastMessageTime.current = now;

    // Ensure timestamp is in ISO format
    const messageToSend = {
      ...chatMsg,
      timestamp: chatMsg.timestamp || new Date().toISOString()
    };

    console.log("Sending message to Worker:", messageToSend);
    workerRef.current.postMessage({ type: "SEND", message: messageToSend });

    // DON'T add optimistic message - wait for server confirmation
    // The server will send the message back to us via WebSocket
    // This avoids deduplication issues and ensures consistency
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
        const user = globalChat.chatUsers.find(u => (u.id || u.ID) === parseInt(userId));
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
      globalChat.setChatUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, [globalChat]);

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
      // Don't close worker - it should stay alive for other components
      // Worker is managed globally by WorkerContext

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
              onClose={() => setShowPostForm(false)}
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
    </div>
  )
}