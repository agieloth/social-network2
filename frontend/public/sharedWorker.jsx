// public/sharedWorker.js
console.log("🚀 SharedWorker script loaded!");

let socket = null;
const ports = [];
let isConnected = false;
let userId = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectInterval = null;

function connectWebSocket() {
  // Clear any existing interval
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }

  socket = new WebSocket(`ws://localhost:8080/ws?userId=${encodeURIComponent(userId)}`);

  socket.onopen = () => {
    reconnectAttempts = 0;
    isConnected = true;
    console.log("✅ WebSocket connected for user:", userId);
    broadcast({ type: "status", connected: true, message: "✅ WebSocket connected" });
  };

  socket.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data);
      console.log("📨 Message received from WebSocket:", parsed);
      
      // Forward all messages to all ports
      broadcast({
        type: "message",
        data: parsed
      });
    } catch (err) {
      console.error("Error parsing message from WebSocket:", err, "Raw data:", msg.data);
      broadcast({
        type: "error",
        message: "Failed to parse message: " + err.message
      });
    }
  };

  socket.onerror = (err) => {
    broadcast({
      type: "status",
      connected: false,
      message: "❌ WebSocket error"
    });
  };

  socket.onclose = () => {
    isConnected = false;
    broadcast({
      type: "status",
      connected: false,
      message: "🔌 WebSocket disconnected"
    });

    // Start reconnection attempts every 3 seconds
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          connectWebSocket();
        } else {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
      }, 3000); // 3 seconds
    }
  };
}

onconnect = function (e) {
  const port = e.ports[0];
  ports.push(port);
  console.log("🔌 New port connected! Total ports:", ports.length);

  port.onmessage = function (event) {
    const data = event.data;

    console.log("📬 Message received on port:", data);

    switch (data.type) {
      case "INIT":
        console.log("🔑 INIT message received with userId:", data.userId);
        console.log("   Current userId:", userId, "Socket exists:", !!socket, "Is connected:", isConnected);
        
        // Always update userId
        userId = data.userId;
        
        if (!socket || !isConnected) {
          console.log("🔌 Creating new WebSocket connection for user:", userId);
          connectWebSocket();
        } else {
          console.log("✅ WebSocket already connected for user:", userId);
        }
        break;

      case "group":
        console.log("test if the groupsend the message ", data);
        
        if (socket && isConnected) {
          try {
            const payload = JSON.stringify(data);
            console.log("payload is : ", payload)
            socket.send(payload);
          } catch (err) {
            port.postMessage({
              type: "error",
              message: "Failed to send message"
            });
          }
        } else {
          console.log('hhhhhhhhhhhhhhhhh');
          
          port.postMessage({
            type: "error",
            message: "WebSocket not connected"
          });
        }
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
            // Send confirmation to port
            port.postMessage({
              type: "message_sent",
              data: data.message
            });
          } catch (err) {
            console.error("❌ Error sending message:", err);
            port.postMessage({
              type: "error",
              message: "Failed to send message: " + err.message
            });
          }
        } else {
          console.error("❌ WebSocket not connected. IsConnected:", isConnected, "Socket:", !!socket);
          port.postMessage({
            type: "error",
            message: "WebSocket not connected"
          });
        }
        break;

      case "PING":
        port.postMessage({ type: "PONG" });
        break;

      default:
        console.warn("Unknown message type:", data.type);
    }
  };

  port.start();

  // Send initial status
  port.postMessage({
    type: "status",
    connected: isConnected,
    message: isConnected ? "✅ WebSocket connected" : "🔌 WebSocket disconnected"
  });
};

function broadcast(msg) {
  ports.forEach((p) => {
    try {
      p.postMessage(msg);
    } catch (err) {
      console.warn("Failed to post message to port:", err);
    }
  });
}