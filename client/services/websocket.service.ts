import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import io, { Socket } from 'socket.io-client';

class ServiceConsumer {
	// Array of callback events to run when the server calls the client event name
	registeredEvents: Map<string, Function> = new Map();

	public addEvent(eventName: string, eventCallback: Function) {
		if (!this.registeredEvents.has(eventName))
			this.registeredEvents.set(eventName, eventCallback);
	}

	public removeEvent(eventName: string) {
		if (this.registeredEvents.has(eventName))
			this.registeredEvents.delete(eventName);
	}
}

@Injectable({
	providedIn: 'root'
})
export class WebsocketService {
	private socket!: Socket;
	private readonly url: string = 'https://localhost:444';
	private connected: boolean = false;

	private enableVerbose: boolean = false;
	private enableLogging: boolean = false;

	// Holds in memory all the components that are currently using the websocket service
	// And collection of scope objects using scopeID as the key
	private consumers: Map<string, ServiceConsumer> = new Map();

	constructor() {
		this.connect();

	}

	private log(msg: string, obj?: any): void {
		if (this.enableLogging) {
			if (obj) console.log(msg, obj);
			else console.log(msg);
		}
	}

	private verbose(msg: string, obj?: any): void {
		if (this.enableVerbose) {
			if (obj) console.log(msg, obj);
			else console.log(msg);
		}
	}

	private error(msg: string, ex?: Error): void {
		if (ex) console.error(msg, ex);
		else console.error(msg);
	}


	private connect(): void {
		this.socket = io(this.url);

	}

	private disconnect(): void {
		this.socket.disconnect();
	}

	public Subscribe(consumerID: string) {

		let scope = new ServiceConsumer();
		this.consumers.set(consumerID, scope);

		return scope;
	}

	// public sendMessage(message: string): void {
	// 	this.socket.emit('message', message);
	// }

	public getMessages(): Observable<string> {
		return new Observable<string>(observer => {
			this.socket.on('message', (data: string) => {
				observer.next(data);
			});
			return () => {
				this.socket.disconnect();
			};
		});
	}

	// Used to register a callback to run when the server calls the client event name
	public When(consumerID: string, eventName: string, callback: Function) {

		if (eventName && callback) {

			this.RegisterEvent(eventName, callback, consumerID);

		}
	}

	// When an event name is registered, the callback will execute when the server calls it
	RegisterEvent(eventName: string, callback: Function, consumerID?: string): boolean | Error {

		if (consumerID) {
			this.verbose(`Registering event ${eventName} for consumer ${consumerID}`);

			let scope: ServiceConsumer | undefined;
			if (this.consumers.has(consumerID)) {
				scope = this.consumers.get(consumerID);
				if (!scope) throw new Error();
			} else {
				scope = this.Subscribe(consumerID);
			}
			scope.addEvent(eventName, callback);
		}

		if (!this.connected) {
			// If the socket is not connected, the registry will occur during reconnection
			this.error(`Cannot register event ${eventName} because the socket is not connected`);
			return false;
		}

		this.socket.on(eventName, (data: any) => {
			this.verbose(`Received ${eventName}`, data);
			if (!this.connected) {
				this.error(`Cannot execute ${eventName} because the socket is not connected`);
			} else {
				this.verbose(`Executing callback for ${eventName}`);
				try {
					callback(data);
				} catch (error: any) { this.error(`Callback error in ${eventName}`, error); }
			}
		});

		this.verbose(`Registered callback for event ${eventName}`, callback);
		return true;
	}

	// Re-registered all callback with the hub connection
	private RegisterAllEvents(): boolean {

		if (!this.connected) {
			this.error(`Cannot register events because the socket is not connected`);
			return false;
		}

		let success: boolean = true;
		this.verbose(`Registering all events`);
		for (let consumer of this.consumers.values()) {
			for (let [event, callback] of consumer.registeredEvents) {
				if (!this.RegisterEvent(event, callback)) {
					success = false;
				}
			}
		}
		return success;
	}

	// Unregistered all callback with the hub connection
	private UnregisterAllEvents(): boolean {

		if (!this.connected) {
			this.error(`Cannot unregister events because the socket is not connected`);
			return false;
		}

		let success: boolean = true;
		this.verbose(`Unregistering all events`);
		for (let consumer of this.consumers.values()) {
			for (let event of consumer.registeredEvents.keys()) {
				this.socket.off(event);
				consumer.removeEvent(event);
			}
		}
		return success;
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