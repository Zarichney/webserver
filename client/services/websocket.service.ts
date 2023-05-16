import { Injectable } from '@angular/core';
import { WebSocketMessage } from '../../server/models/websocket.message';

type ErrorHandlerType = (...args: any[]) => any;

class ServiceConsumer {
	// Array of callback events to run when the server calls the client event name
	registeredEvents: Map<string, Function> = new Map();
	public id!: string;

	constructor(subscriberID: string) {
		this.id = subscriberID;
	}

	public addEvent(eventName: string, eventCallback: Function) {
		if (this.registeredEvents.has(eventName))
			return false;

		this.registeredEvents.set(eventName, eventCallback);
		return true;
	}

	public removeEvent(eventName: string) {
		if (!this.registeredEvents.has(eventName))
			return false;

		this.registeredEvents.delete(eventName);
		return true;
	}
}

@Injectable({
	providedIn: 'root'
})
export class WebsocketService {
	private socket!: WebSocket;
	private readonly url: string = 'wss://localhost:444';
	private latestSubscriberID!: string;
	private connected: boolean = false;
	private connectionAttempts: number = 0;

	// Holds in memory all the components that are currently using the websocket service
	// And collection of scope objects using scopeID as the key
	private subscribers: Map<string, ServiceConsumer> = new Map();

	// Keeps track of whether an event name is registered already
	private registeredEvents: string[] = [];

	private enableVerbose: boolean = false; // Turn this on to see all service activity
	private enableLogging: boolean = true;  // Turn this on to log major service activity
	private throwErrors: boolean = true;    // Turn this on for troubleshooting

	constructor() {
		if (this.enableVerbose) {
			this.enableLogging = true;
			this.throwErrors = true;
		}

		this.start();
	}

	private verbose(msg: string, obj?: any): void {
		if (this.enableVerbose) {
			// console.log("My socket client", this.socket); // for deep troubleshooting
			this.log(msg, obj);
		}
	}

	private log(msg: string, obj?: any): void {
		if (this.enableLogging) {
			msg = "Websocket Service >> " + msg;
			if (obj) console.log(msg, obj);
			else console.log(msg);
		}
	}

	private error(msg: string, ex?: Error | Event) {
		if (ex) {
			console.error(msg, ex);
			if (ex instanceof Error)
				console.error(ex.stack);
			if (this.throwErrors)
				throw ex;
		}
		else {
			console.error(msg);
			if (this.throwErrors)
				throw new Error(msg);
		}
	}

	private handleError: ErrorHandlerType = (err: Error) => {
		this.error(err.message, err);
	};

	private errorHandler = (handler: ErrorHandlerType): ErrorHandlerType => {

		return (...args: any[]) => {
			try {
				const ret = handler.apply(this, args);
				if (ret && typeof ret.catch === "function") {
					// async handler
					ret.catch(this.handleError);
				}
			} catch (e: any) {
				// sync handler
				this.handleError(e);
			}
		};
	};

	private start(): void {

		if (this.socket && this.connected) {
			this.verbose('Disconnecting from server');
			this.socket.close();
		}

		this.verbose("Initiating connecting to server...");

		this.socket = new WebSocket(this.url);

		this.socket.onopen = this.errorHandler(this.connect);
		this.socket.onerror = (error) => {
			this.error("Socket error", error);
		};
		this.socket.onclose = this.errorHandler(this.disconnect);
		this.socket.onmessage = this.errorHandler(this.messageHandler);

	}

	private reconnect(): void {

		// randomize a delayed reconnect to avoid server overload between 0.5s and 1 second
		this.connectionAttempts += 1;
		let attempt = this.connectionAttempts;

		let delay: number;

		if (attempt < 3) {
			delay = Math.random() * 500; // 0 to 0.5 seconds
		} else if (attempt < 6) {
			delay = Math.random() * 2500 + 500; // 0.5 to 3 seconds
		} else if (attempt < 10) {
			delay = Math.random() * 5000 + 5000; // 5 to 10 seconds
		} else {
			delay = 60000; // 1 minute
		}

		setTimeout(() => {
			this.start();
		}, delay);

	}

	private connect(): void {

		this.connected = true;
		this.connectionAttempts = 0;

		this.log("Connected to server", this.connected);

		this.RegisterAllEvents();

	}

	private disconnect(event: CloseEvent): void {

		if (this.connected) {
			this.verbose('Disconnecting from server');
			this.socket.close();
		}

		this.log("Disconnected from server", event);
		this.connected = false;

		this.reconnect();

	}

	public send(eventName: string, data: any): void {
		try {
			let message = new WebSocketMessage<any>(eventName, data);
			this.socket.send(JSON.stringify({ eventName, data }));
		} catch (ex: any) {
			this.error("emit error", ex);
		}
	}

	// Todo: add onConnectCallback and onDisconnectCallback as parameters
	public Subscribe(subscriberID: string): WebsocketService {

		if (!subscriberID) {
			// Without the scope, callback couldn't get automatically deregistered
			// when the scope is disposed (aka controller no longer being used)
			this.error("Service requires an ID to register consumer callbacks");
		}

		let scope = new ServiceConsumer(subscriberID);

		// Internally store service consumer to auto handle:
		//	- unregistration of callbacks during scope disposal, or
		//  - re-registrations of callbacks during reconnection to server
		this.subscribers.set(subscriberID, scope);

		// Temporarily set this to use during the registration of events
		this.latestSubscriberID = subscriberID;

		this.log(`New service consumer`, subscriberID);

		return this;
	}

	public Unsubscribe(subscriberID: string): boolean {

		this.verbose("Unsubscribing service consumer", subscriberID);

		if (!subscriberID) {
			this.error("Service consumer ID not provided");
			return false;
		}

		if (!this.subscribers.has(subscriberID)){
			this.error(`Consumer with ID ${subscriberID} is not currently subscribed`);
			return false;
		}

		let consumer = this.subscribers.get(subscriberID);
		if (!consumer) throw new Error();

		for (let eventName of consumer.registeredEvents.keys()) {
			this.UnregisterEvent(eventName, subscriberID);
		}

		this.subscribers.delete(subscriberID);
		this.log(`Service consumer unsubscribed`, subscriberID);

		return true;
	}


	// Used to register a callback to run when the server calls the client event name
	public On(eventName: string, callback: Function) {

		if (!eventName) {
			this.error("Event name not provided");
			return;
		}

		if (!callback) {
			this.error("Callback not provided");
			return;
		}

		return this.RegisterEvent(eventName, callback, this.latestSubscriberID);
	}

	// When an event name is registered, the callback will execute when the server calls it
	private RegisterEvent(eventName: string, callback: Function, subscriberID?: string): boolean {

		if (subscriberID) {
			this.verbose(`Registering event '${eventName}' for consumer ${subscriberID}`);

			let subscriber: ServiceConsumer | undefined;
			if (!this.subscribers.has(subscriberID)) {
				this.Subscribe(subscriberID);
			}
			subscriber = this.subscribers.get(subscriberID);
			if (!subscriber) throw new Error();

			if (subscriber.addEvent(eventName, callback))
				this.verbose(`Registered callback for event '${eventName}'`, callback);
		}

		// Check if event is already registered
		if (this.registeredEvents.includes(eventName)) {
			this.verbose(`Event ${eventName} is already registered`);
			return true;
		}

		this.registeredEvents.push(eventName);
		this.verbose(`Registered event name '${eventName}'`);

		return true;
	}

	private messageHandler(event: MessageEvent) {

		let message: WebSocketMessage<any> = JSON.parse(event.data);
		this.log(`Received from server event '${message.eventName}'`);

		if (!this.connected) {
			this.error(`Cannot register event '${message.eventName}' because the socket is not connected`);
			return false;
		}

		// Iterate over all service consumers and run the callback for all that are registered for this event
		for (let consumer of this.subscribers.values()) {
			if (consumer.registeredEvents.has(message.eventName)) {
				let consumerCallback = consumer.registeredEvents.get(message.eventName);
				if (consumerCallback) {
					this.verbose(`Executing callback for consumer ${consumer.id}`, consumerCallback);
					try{
						consumerCallback(message.data);
					} catch (ex: any) {
						this.error("Consumer callback error", ex);
					}
				}
			}
		}

		return true;
	}

	// Re-registered all callback with the hub connection
	private RegisterAllEvents(): boolean {

		if (!this.connected) {
			this.error(`Cannot register events because the socket is not connected`);
			return false;
		}

		if (this.subscribers.size == 0) {
			return false;
		}

		this.log(`Registering all events`);

		let success: boolean = true;
		for (let consumer of this.subscribers.values()) {
			for (let [event, callback] of consumer.registeredEvents) {
				if (!this.RegisterEvent(event, callback)) {
					success = false;
					this.error(`Cannot register event ${event} for consumer ${consumer.id}`);
				}
			}
		}

		return success;
	}

	private UnregisterEvent(event: string, subscriberID?: string): boolean {

		if (subscriberID && this.subscribers.has(subscriberID)) {
			let consumer = this.subscribers.get(subscriberID);
			if (!consumer) throw new Error();
			consumer.removeEvent(event);
		}

		// Remove from the list of registered events only if no other service consumer is registered for the same event
		for (let consumer of this.subscribers.values()) {

			if (consumer.registeredEvents.has(event)) {
				// Another service consumer is also subscribed to the same event: no need to unregister
				return true;
			}
		}

		this.registeredEvents = this.registeredEvents.filter(e => e != event);

		return true;
	}
}



/* This is the original code from an older angularjs project. This new websocket service is based off of this code:

  angular.module("HLSConnect").service("hubService", function ($rootScope, $resource, $q) {

				// Turn this boolean to have the hub pump out info in the console
				const enableLogging = false;
				function log(msg, obj) {
					 if (enableLogging) {
						  if (obj) console.log(msg, obj);
						  else console.log(msg);
					 }
				}
				// Adds extra websocket activity info in console
				const enableVerbose = false;
				function verbose(msg, obj) {
					 if (enableVerbose) {
						  if (obj) console.log(msg, obj);
						  else console.log(msg);
					 }
				}
				function error(msg, ex) {
					 if ($rootScope.environment !== "Production")
						  if (ex) console.error(msg, ex);
						  else console.error(msg);
				}

				// The logging level at which the SignalR library will pump out info in the console
				let signalrLogLevel = signalR.LogLevel.Trace;
				if (enableLogging)
					 signalrLogLevel = signalR.LogLevel.Trace;
				else if ($rootScope.environment === "Development")
					 signalrLogLevel = signalR.LogLevel.Error;
				else if ($rootScope.environment === "Staging")
					 signalrLogLevel = signalR.LogLevel.Warning;
				else if ($rootScope.environment === "Production")
					 signalrLogLevel = signalR.LogLevel.None;

				// Container of registered controller scopes. Used for firing connection/disconnection callbacks and events registration
				let scopes = [];

				// Event fired when client has initially connected to the server
				function Connected(e) {
					 log('connected', e);
					 hub.connected = true;

					 // Should be as simple as getting it from "hub.connection.hub.connectionId", but connection.hub doesn't seem to exist. Get it from the URL instead.
					 let transport = hub.connection.connection.transport;
					 var url = transport.url || transport.webSocket.url;
					 hub.connectionID = /.*\=(.*)/.exec(url)[1];
					 log('connectionID', hub.connectionID);

					 ExecuteAllOnConnectCallbacks();
				}

				// Event fired when client has disconnected and is attempting to reconnect for the first time
				function Reconnection(e) {
					 log('reconnecting', e);
					 hub.connected = false;

					 ExecuteAllOnDisconnectCallbacks();
				}

				// Event fired when client has reconnected to server
				function Reconnected(e) {
					 log('reconnected', e);
					 hub.connected = true;

					 ExecuteAllOnConnectCallbacks();
				}

				// The end of life for hub connection
				function Disconnect(e, dontReconnect) {
					 log('disconnecting', e);
					 hub.connected = false;

					 DeregisterAllEvents();

					 if (hub.connection && hub.connection.state === "Connected")
						  hub.connection.stop().then(p => {
								log('Connection stopped', p);
								if (dontReconnect) hub.connection = null;
								else RestartConnection();
						  }, e => {
								error('Connection failed to stop', e);
								if (dontReconnect) hub.connection = null;
								else RestartConnection();
						  });
					 else
						  if (dontReconnect) hub.connection = null;
						  else RestartConnection();
				}

				// Triggers a delay before performing reconnection
				function RestartConnection(delayBeforeRestarting) {
					 log('restarting');
					 hub.connection = null;

					 let timeout = delayBeforeRestarting || hub.startupFailureTimeout;
					 timeout = Math.random() * timeout; // Randomly staggered mass reconnections
					 setTimeout(() => {
						  log('delay over. initiate restart');
						  hub.StartConnection();
					 }, timeout);
				}

				// Execute all registered on connect callback
				function ExecuteAllOnConnectCallbacks() {
					 verbose('Calling on connect callbacks');
					 scopes.forEach(scope => {
						  if (scope.onConnectCallback)
								try {
									 scope.onConnectCallback();
								} catch (e) {
									 error('On connect callback failed', e);
								}
					 });
				}

				// Execute all registered on disconnect callbacks
				function ExecuteAllOnDisconnectCallbacks() {
					 verbose('Calling all disconnect callbacks');
					 scopes.forEach(scope => {
						  if (scope.onDisconnectCallback)
								try {
									 scope.onDisconnectCallback();
								} catch (e) {
									 error('On disconnect callback failed', e);
								}
					 });
				}

				// Re-registered all callback with the hub connection
				function RegisterAllEvents() {
					 verbose('Registering all events');
					 scopes.forEach(scope => {
						  scope.registeredEvents.forEach(event => {
								RegisterEvent(event.name, event.function);
						  });
					 });
				}

				// De-registered all callback with the hub connection
				function DeregisterAllEvents() {
					 verbose('Deregistering all events');
					 if (hub.connection)
						  scopes.forEach(scope => {
								scope.registeredEvents.forEach(event => {
									 hub.connection.off(event.name);
								});
						  });
					 else error(`attempted to deregister ${eventName} when the connection has not been established`);
				}

				// When an event name is registered, the callback will execute when the server calls it
				function RegisterEvent(eventName, callback) {
					 verbose('Registering event', eventName);
					 if (hub.connection)
						  hub.connection.on(eventName, result => {
								if (hub.connected)
									 try {
										  verbose(`Received ${eventName}`, result);
										  $rootScope.$apply(() => { callback(result); });
									 } catch (ex) {
										  error(`Callback failed for ${eventName}`, ex);
									 }
								else error(`${eventName} was called however client is not connected?`);
						  });
					 else error(`attempted to call ${eventName} when the connection has not been established`);
				}

				// Mechanism for handling token authentication
				function FetchAndCacheServiceAccountToken() {
					 // The following assumes that if the current client is logged in using the service account,
					 // it is using an android web wrapper which cannot not utilize web cookies. 
					 // Therefore to pass authentication and establish connection, it must use the JWT token.
					 // All to say that Terminals use the hlsconnect service account and the SPA is wrapped in an android applicable therefore requires JWT authentication
					 const serviceAccountUsername = "hlsconnect";
					 let deferred = $q.defer();
					 if ($rootScope.username === serviceAccountUsername)
						  $rootScope.cache("serviceAccountToken", function () {
								return $resource("/api/auth/token").save(null, { Username: serviceAccountUsername });
						  }).then(response => {
								deferred.resolve(response.Token);
						  }, e => {
								$rootScope.clearCache("serviceAccountToken");
								error('hub failed to retrieve access token', e);
						  });
					 else deferred.resolve();
					 return deferred.promise;
				}

				// The hub object is what holds the connection and provides the interfaced methods for communicating with the server
				const hub = {
					 startupFailureTimeout: 10000, // If unable to get connection going, try again in 10 seconds

					 StartConnection: function (e) {
						  log('Starting new connection', e);
						  this.connected = false;

						  // This is when to allow the user to have the option to force restart the connection startup. Recalls StartConnection()
						  setTimeout(() => { $rootScope.offerToReconnect = true; }, this.startupFailureTimeout);

						  if (this.connection)
								return Disconnect();

						  this.connection = new signalR.HubConnectionBuilder()
								.withUrl("/WebClientHub", {
									 accessTokenFactory: FetchAndCacheServiceAccountToken
								})
								//.withAutomaticReconnect([0, 2000, 10000, 30000]) // Four attempts of 0, 2, 10 and 30 seconds
								.withAutomaticReconnect({
									 nextRetryDelayInMilliseconds: retryContext => {
										  if (retryContext.elapsedMilliseconds < 300000)
												// If we've been reconnecting for less than 5 minute so far,
												// wait between 0 and 10 seconds before the next reconnect attempt.
												return Math.random() * this.startupFailureTimeout;
										  else
												// If unsuccessful after a minute, stop reconnecting and trigger disconnect event
												return null;
									 }
								})
								.configureLogging(signalrLogLevel)
								.build();

						  RegisterAllEvents();

						  // With automatic reconnection, event is triggered after all failed attempts of reconnection
						  this.connection.onclose(e => { Disconnect(e, location.pathname !== "/terminal"); });

						  // Event fired when disconnection occurs and first reconnection event starts
						  this.connection.onreconnecting(e => { Reconnection(e); });

						  // Event fired upon establishing connection but not initial start up
						  this.connection.onreconnected(e => { Reconnected(e); });

						  try {
								// This is where the connection is executed. Upon success calls the Connection function. Error handlers below
								this.connection.start().then(e => { Connected(e); },
									 e => {
										  error('websocket connection failed to start - promise', e);
										  Disconnect(e, location.pathname !== "/terminal");
									 });
						  } catch (e) {
								error('websocket connection failed to start - trycatch', e);
								Disconnect();
						  }
					 },

					 // Calls a server method and returns a promise
					 Call: function (...params) {
						  if (this.connection)
								if (this.connected)
									 try {
										  verbose(`Invoking ${params[0]}`, params);
										  return this.connection.invoke.apply(this.connection, params);
									 } catch (ex) {
										  error('Error invoking command', ex);
									 }
								else error('Cannot invoke command. Not connected');
						  else error('Cannot invoke command. Connection not established');
					 },

					 // Calls a void server method that does not expect a return (fire and forget)
					 Send: function (...params) {
						  if (this.connection)
								if (this.connected)
									 try {
										  verbose(`Sending ${params[0]}`, params);
										  this.connection.send.apply(this.connection, params);
									 } catch (ex) {
										  error('Error sending command', ex);
									 }
								else error('Cannot send command. Not connected');
						  else error('Cannot send command. Connection not established');
					 },

					 // Used to register a callback to run when the server calls the client event name
					 When: function (eventName, callback) {
						  if (eventName && callback) {
								const scopeIndex = scopes.findIndex(s => s.id === this.lastestID);
								if (scopeIndex >= 0) {
									 scopes[scopeIndex].registeredEvents.push({ name: eventName, function: callback });

									 if (hub.connection)
										  RegisterEvent(eventName, callback);
								} else
									 // Assumes that `When` was called in same line of executing
									 // as when the hubService($scope) was initialized
									 error('Unable to find scope using ID', this.latestID);
						  } else {
								if (!eventName) error("Event Name not supplied");
								else error("Event callback not supplied for " + eventName);
						  }
					 }

					 // Use to provide frequent updates to server (coming soon, when we have a need for it)
					 //Stream: function(eventName, Subject) { return this.connection.stream(eventName, Subject); }
				};

				log('Init start up');
				hub.StartConnection(); // Initial connection call when service has been first injected

				// "Constructor" for controller consumption. Returns the hub with the communication methods available
				return function (scope, onConnectCallback, onDisconnectCallback) {
					 // On connect/disconnect callbacks are optional
					 // Useful when a controller would like specific functionality
					 // executed when going offline or coming back online

					 if (!scope || !scope.$id) {
						  // Without the scope, callback couldn't get automatically deregistered
						  // when the scope is disposed (aka controller no longer being used)
						  error("hubService requires the scope to be attached");
						  return;
					 }

					 // Registers controller's scope in hub's memory for handling events during connections/disconnections
					 scopes.push({ id: scope.$id, registeredEvents: [] });

					 // If supplied, stashes callback and executes if connected
					 if (onConnectCallback) {
						  scopes.find(s => s.id === scope.$id).onConnectCallback = onConnectCallback;
						  if (hub.connected)
								try {
									 onConnectCallback();
								} catch (e) {
									 error('On connect callback failed', e);
								}
					 }

					 // If supplied, stashes callback and executes if currently disconnected
					 if (onDisconnectCallback) {
						  scopes[scopes.findIndex(s => s.id === scope.$id)].onDisconnectCallback = onDisconnectCallback;
						  if (!hub.connected)
								try {
									 onDisconnectCallback();
								} catch (e) {
									 error('On disconnect callback failed', e);
								}
					 }

					 // Controller's "destructor". Executes clean up like event deregistration and removes callbacks when scopes gets disposed
					 scope.$on("$destroy", () => {
						  const i = scopes.findIndex(s => s.id === scope.$id);
						  if (i >= 0) {
								let deregistered = [];
								scopes[i].registeredEvents.forEach(event => {
									 // Make sure that client hub doesnt execute event callback
									 // when the server hub calls the event name
									 hub.connection.off(event.name);
									 deregistered.push(event.name);
								});

								// Remove disposed scope from hub memory
								scopes.splice(i, 1);

								// In case of collision in event name registration
								// Go throught all intended registered events
								// And re-register callbacks from different scopes with same name
								scopes.forEach(scope => {
									 scope.registeredEvents.forEach(event => {
										  if (deregistered.includes(event.name))
												RegisterEvent(event.name, event.function);
									 });
								});
						  } else log('scope already removed or wasnt stashed?');
					 });

					 // Work around for not needing the `When` function to requiring the scope ID as a param
					 hub.lastestID = scope.$id;

					 return hub;
				};
		  });

		  */