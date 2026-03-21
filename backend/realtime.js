let webSocketServer = null;

const setWebSocketServer = (server) => {
  webSocketServer = server;
};

const broadcast = (event, payload = {}) => {
  if (!webSocketServer) return;
  const message = JSON.stringify({ event, payload, timestamp: Date.now() });

  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
};

module.exports = {
  setWebSocketServer,
  broadcast,
};
