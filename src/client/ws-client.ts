/**
 * Kitchen Display System — WebSocket Client Layer
 * 
 * Manages the WebSocket connection, message parsing, reconnection logic,
 * and event dispatching to subscribers.
 * 
 * Connection lifecycle:
 * - Offline/Init → Connecting → Connected
 *                  ↓(error/close)
 *                  Reconnecting → Backoff
 *                  ↓(max retries)
 *                  Offline
 * 
 * Reconnection strategy (per AC1):
 * - First disconnect: 0ms (immediate retry)
 * - Subsequent: 3s fixed interval (not exponential)
 * - Max 10 attempts (~30s total before permanent offline)
 */

import type { IncomingMessage, OutgoingMessage, IWebSocketClient } from '../types';

type EventCallback<T> = (data: T) => void;

interface Unsubscribe {
  (): void;
}

/**
 * WebSocket client implementation with auto-reconnection
 */
export class WebSocketClient implements IWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private retryCount: number = 0;
  private retryTimer: NodeJS.Timeout | null = null;

  // Backoff delays: 0ms, then 3s fixed for 9 more attempts
  private readonly BACKOFF_DELAYS = [0, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000];
  private readonly MAX_RETRIES = this.BACKOFF_DELAYS.length;

  // Event listeners
  private connectedListeners: Set<EventCallback<void>> = new Set();
  private disconnectedListeners: Set<EventCallback<void>> = new Set();
  private messageListeners: Set<EventCallback<IncomingMessage>> = new Set();
  private errorListeners: Set<EventCallback<Error>> = new Set();

  constructor(wsUrl: string = 'wss://localhost:5000/orders') {
    this.url = wsUrl;
  }

  /**
   * Connect to WebSocket and start listening for messages
   */
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.addEventListener('open', () => {
          this.onOpen(resolve);
        });

        this.ws.addEventListener('message', (event) => {
          this.onMessage(event);
        });

        this.ws.addEventListener('error', (event) => {
          this.onError(event, reject);
        });

        this.ws.addEventListener('close', () => {
          this.onClose();
        });
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Failed to create WebSocket');
        this.errorListeners.forEach((listener) => listener(err));
        reject(err);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.ws) {
      // Prevent auto-reconnect by setting to null before closing
      const ws = this.ws;
      this.ws = null;
      ws.close(1000, 'User disconnect');
    }

    this.retryCount = 0;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.ws != null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send an outgoing message to the backend
   * Throws if not connected
   */
  public async sendAction(action: OutgoingMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const message = JSON.stringify(action);
    this.ws!.send(message);
  }

  /**
   * Register listener for connection event
   * Returns unsubscribe function
   */
  public onConnected(callback: () => void): Unsubscribe {
    this.connectedListeners.add(callback);
    return () => {
      this.connectedListeners.delete(callback);
    };
  }

  /**
   * Register listener for disconnection event
   */
  public onDisconnected(callback: () => void): Unsubscribe {
    this.disconnectedListeners.add(callback);
    return () => {
      this.disconnectedListeners.delete(callback);
    };
  }

  /**
   * Register listener for incoming messages
   */
  public onMessage(callback: (message: IncomingMessage) => void): Unsubscribe {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Register listener for errors
   */
  public onError(callback: (error: Error) => void): Unsubscribe {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  /**
   * Private: Handle successful connection
   */
  private onOpen(resolve: () => void): void {
    // Reset retry counter on successful connection
    this.retryCount = 0;

    // Emit connected event
    this.connectedListeners.forEach((listener) => listener());

    resolve();
  }

  /**
   * Private: Handle incoming WebSocket message
   */
  private onMessage(event: MessageEvent<any>): void {
    try {
      const message: IncomingMessage = JSON.parse(event.data);

      // Validate message has a type
      if (!message.type) {
        throw new Error('Message missing type discriminator');
      }

      // Emit to all listeners
      this.messageListeners.forEach((listener) => listener(message));
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error('Failed to parse WebSocket message');
      this.errorListeners.forEach((listener) => listener(err));
    }
  }

  /**
   * Private: Handle WebSocket error
   */
  private onError(event: Event, reject?: (reason?: any) => void): void {
    const error = new Error('WebSocket error');
    this.errorListeners.forEach((listener) => listener(error));

    if (reject) {
      reject(error);
    }
  }

  /**
   * Private: Handle WebSocket close (disconnection)
   */
  private onClose(): void {
    // Don't reconnect if user explicitly disconnected (ws is null)
    if (!this.ws) {
      this.retryCount = 0;
      return;
    }

    // Emit disconnected event
    this.disconnectedListeners.forEach((listener) => listener());

    // Attempt reconnection with backoff
    this.scheduleReconnect();
  }

  /**
   * Private: Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.retryCount >= this.MAX_RETRIES) {
      // Max retries exceeded, give up
      this.ws = null;
      const error = new Error('Max reconnection attempts exceeded');
      this.errorListeners.forEach((listener) => listener(error));
      return;
    }

    const delayMs = this.BACKOFF_DELAYS[this.retryCount];
    this.retryCount++;

    this.retryTimer = setTimeout(() => {
      this.connect().catch((error) => {
        // Retry failed, will reschedule in next onClose
        // Error already emitted in connect()
      });
    }, delayMs);
  }
}

/**
 * Create a singleton WebSocket client instance
 */
export function createWebSocketClient(
  wsUrl?: string
): WebSocketClient {
  return new WebSocketClient(wsUrl);
}
