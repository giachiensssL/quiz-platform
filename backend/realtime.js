let webSocketServer = null;

const setWebSocketServer = (server) => {
  webSocketServer = server;
  
  webSocketServer.on("connection", (socket) => {
    console.log("New client connected to WS");
    
    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(raw);
        if (data.event === "chat_message") {
          // Broadcast chat message to everyone (including role for admin detection)
          broadcast("chat_message", {
            user: data.user,
            text: data.text,
            avatar: data.avatar || '',
            role: data.role || 'user',
            timestamp: data.timestamp || Date.now(),
          });
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });

    socket.on("close", () => {
      console.log("Client disconnected from WS");
    });
  });
};

const broadcast = (event, payload = {}) => {
  if (!webSocketServer) return;
  const message = JSON.stringify({ event, payload, timestamp: Date.now() });

  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 is OPEN
      client.send(message);
    }
  });
};

module.exports = {
  setWebSocketServer,
  broadcast,
};
