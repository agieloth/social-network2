// public/sharedWorker.js
let socket = null;
const ports = [];
let isConnected = false;
let userId = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectInterval = null; // Add this line for interval tracking

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
    broadcast({ type: "status", connected: true, message: "✅ WebSocket connected" });
  };

  socket.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data);
      console.log("coming data : ", parsed);
      
      // Forward all messages to all ports
      broadcast({
        type: "message",
        data: parsed
      });
    } catch (err) {
      console.error("Error parsing message:", err);
      broadcast({
        type: "error",
        message: "Failed to parse message"
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

  port.onmessage = function (event) {
    const data = event.data;

    console.log("ya rbi salama ",data)

    switch (data.type) {
      case "INIT":
        userId = data.userId;
        if (!socket) {
          connectWebSocket();
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
        if (socket && isConnected) {
          try {
            const payload = typeof data.message === "string"
              ? data.message
              : JSON.stringify(data.message);
            socket.send(payload);
          } catch (err) {
            port.postMessage({
              type: "error",
              message: "Failed to send message"
            });
          }
        } else {
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