import WebSocket from 'ws';
import { WebSocketMessage } from '../models/websocket.message';

export class WebSocketService {
	private clients: Set<WebSocket>;

	constructor(private server: any) {
		this.clients = new Set<WebSocket>();
		this.start();
	}

	public start(): WebSocket.Server {
		const wss = new WebSocket.Server({ server: this.server });

		wss.on('connection', (socket: WebSocket) => {
			console.log('a user connected');
			this.clients.add(socket);

			this.send("someServerSideEventName", "Hello, client!");

			socket.on('message', (message: string) => {
				console.log('Received message from client:', message);
			});

			socket.on('close', () => {
				console.log('user disconnected');
				this.clients.delete(socket);
			});
		});

		return wss;
	}

	private send(eventName: string, data: any) {
		this.clients.forEach((client: WebSocket) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(new WebSocketMessage(eventName, data)));
			}
		});
	}
}