// public/worker.js
console.log("🚀 Worker script loaded!");

let socket = null;
let isConnected = false;
let userId = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let reconnectInterval = null;
let isManuallyDisconnected = false;

function connectWebSocket() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }

  if (isManuallyDisconnected) {
    console.log("⚠️ WebSocket manually disconnected, not attempting to reconnect");
    return;
  }

  console.log("🔌 Attempting WebSocket connection for user:", userId);
  socket = new WebSocket(`ws://localhost:8080/ws?userId=${encodeURIComponent(userId)}`);

  socket.onopen = () => {
    reconnectAttempts = 0;
    isConnected = true;
    isManuallyDisconnected = false;
    console.log("✅ WebSocket connected for user:", userId);
    postMessage({ type: "status", connected: true, message: "✅ WebSocket connected" });
  };

  socket.onmessage = (msg) => {
    try {
      // Handle ping frames - the browser automatically sends pong, so we just log and ignore
      if (msg.data === "") {
        console.log("📍 Ping received from server");
        return;
      }

      const parsed = JSON.parse(msg.data);
      console.log("📨 Message received from WebSocket:", parsed);
      
      // Extract the actual message type from the data
      // Can be either 'Type' (from Notification model) or 'type' (from Message model)
      const messageType = parsed.Type || parsed.type || "message";
      
      postMessage({
        type: messageType,
        data: parsed
      });
    } catch (err) {
      console.error("Error parsing message from WebSocket:", err, "Raw data:", msg.data);
      postMessage({
        type: "error",
        message: "Failed to parse message: " + err.message
      });
    }
  };

  socket.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    postMessage({
      type: "status",
      connected: false,
      message: "❌ WebSocket error"
    });
  };

  socket.onclose = () => {
    isConnected = false;
    console.log("🔌 WebSocket disconnected");
    postMessage({
      type: "status",
      connected: false,
      message: "🔌 WebSocket disconnected"
    });

    // Only attempt to reconnect if not manually disconnected
    if (!isManuallyDisconnected && !reconnectInterval) {
      reconnectInterval = setInterval(() => {
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log("🔄 Reconnecting attempt", reconnectAttempts, "of", maxReconnectAttempts);
          connectWebSocket();
        } else {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
          console.error("❌ Max reconnection attempts reached");
        }
      }, 3000);
    }
  };
}

onmessage = function (event) {
  const data = event.data;
  console.log("📬 Message received in worker:", data);

  switch (data.type) {
    case "INIT":
      console.log("🔑 INIT message received with userId:", data.userId);
      userId = data.userId;
      isManuallyDisconnected = false;
      
      if (!socket || !isConnected) {
        console.log("🔌 Creating new WebSocket connection for user:", userId);
        connectWebSocket();
      } else {
        console.log("✅ WebSocket already connected for user:", userId);
      }
      break;

    case "DISCONNECT":
      console.log("🛑 DISCONNECT message received");
      isManuallyDisconnected = true;
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
      isConnected = false;
      break;

    case "SEND":
      console.log("📤 SEND message - Socket connected:", isConnected, "Message:", data.message);
      if (socket && isConnected) {
        try {
          const payload = typeof data.message === "string"
            ? data.message
            : JSON.stringify(data.message);
          console.log("🚀 Sending message via WebSocket:", payload);
          socket.send(payload);
          postMessage({
            type: "message_sent",
            data: data.message
          });
        } catch (err) {
          console.error("❌ Error sending message:", err);
          postMessage({
            type: "error",
            message: "Failed to send message: " + err.message
          });
        }
      } else {
        console.error("❌ WebSocket not connected. IsConnected:", isConnected, "Socket:", !!socket);
        postMessage({
          type: "error",
          message: "WebSocket not connected"
        });
      }
      break;

    case "PING":
      postMessage({ type: "PONG" });
      break;

    default:
      console.warn("Unknown message type:", data.type);
  }
};

console.log("🚀 Worker initialization complete");
