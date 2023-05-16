
export interface WebSocketMessage<T> {
	eventName: string;
	data: T;
}
export class WebSocketMessage<T> {
	constructor(public eventName: string, public data: T) { }
}