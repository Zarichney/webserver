import WebSocket from 'ws';

export function createWebsocketServer(server: any): WebSocket.Server {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (socket: WebSocket) => {
    console.log('a user connected');

    socket.send('Hello, client!');

    socket.on('message', (message: string) => {
      console.log('Received message from client:', message);
    });

    socket.on('close', () => {
      console.log('user disconnected');
    });
  });

  return wss;
}
