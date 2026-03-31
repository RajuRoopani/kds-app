/**
 * Kitchen Display System — Action Dispatcher
 * 
 * Sends action messages to the backend and waits for CONFIRMATION.
 * Implements:
 * - 5-second timeout for CONFIRMATION response
 * - Retry logic (caller can re-fire action if timeout)
 * - Deduplication of concurrent identical actions (double-click prevention)
 * - UUID generation for requestId
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ActionMessage,
  ConfirmationMessage,
  IWebSocketClient,
  IOrderStore,
  IActionDispatcher,
} from '../types';

/**
 * Pending action request being awaited
 */
interface PendingRequest {
  requestId: string;
  orderId: string;
  action: ActionMessage['action'];
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Action dispatcher implementation
 */
export class ActionDispatcher implements IActionDispatcher {
  private wsClient: IWebSocketClient;
  private orderStore: IOrderStore;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private recentActions: Set<string> = new Set(); // Track recent actions for dedup
  private unsubscribeMessage: (() => void) | null = null;

  private readonly CONFIRMATION_TIMEOUT_MS = 5000;
  private readonly DEDUP_WINDOW_MS = 500; // Window for deduplication

  constructor(wsClient: IWebSocketClient, orderStore: IOrderStore) {
    this.wsClient = wsClient;
    this.orderStore = orderStore;

    // Listen for CONFIRMATION messages
    this.unsubscribeMessage = this.wsClient.onMessage((message) => {
      if (message.type === 'CONFIRMATION') {
        this.handleConfirmation(message);
      }
    });
  }

  /**
   * Send an action and wait for CONFIRMATION
   * Returns immediately if action is deduplicated
   */
  public async dispatch(
    orderId: string,
    action: ActionMessage['action']
  ): Promise<void> {
    // Check deduplication window
    const dedupKey = `${orderId}:${action}`;
    if (this.recentActions.has(dedupKey)) {
      // Action already in flight or recently completed, ignore
      return;
    }

    // Mark action as recent (prevent double-clicks)
    this.recentActions.add(dedupKey);
    setTimeout(() => {
      this.recentActions.delete(dedupKey);
    }, this.DEDUP_WINDOW_MS);

    // Create request
    const requestId = uuidv4();
    const actionMessage: ActionMessage = {
      type: 'ACTION',
      requestId,
      orderId,
      action,
      timestamp: Date.now(),
    };

    // Set loading state on order
    this.orderStore.setIsLoading(orderId, true);

    return new Promise<void>((resolve, reject) => {
      // Create timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          this.orderStore.setIsLoading(orderId, false);
          reject(new Error(`Action timeout: CONFIRMATION not received within ${this.CONFIRMATION_TIMEOUT_MS}ms`));
        }
      }, this.CONFIRMATION_TIMEOUT_MS);

      // Register pending request
      const pending: PendingRequest = {
        requestId,
        orderId,
        action,
        resolve,
        reject,
        timeout,
      };
      this.pendingRequests.set(requestId, pending);

      // Send action
      this.wsClient
        .sendAction(actionMessage)
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          this.orderStore.setIsLoading(orderId, false);
          reject(error);
        });
    });
  }

  /**
   * Cancel all pending actions
   */
  public cancelPending(): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Action cancelled'));
      this.orderStore.setIsLoading(pending.orderId, false);
    }
    this.pendingRequests.clear();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.cancelPending();
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
    }
  }

  /**
   * Private: Handle CONFIRMATION message from backend
   */
  private handleConfirmation(message: ConfirmationMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      // Not our request, ignore
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.requestId);

    // Clear loading state
    this.orderStore.setIsLoading(pending.orderId, false);

    // Handle result
    if (message.success) {
      pending.resolve();
    } else {
      pending.reject(
        new Error(`Action failed: ${message.reason || 'Unknown error'}`)
      );
    }
  }
}

/**
 * Create action dispatcher
 */
export function createActionDispatcher(
  wsClient: IWebSocketClient,
  orderStore: IOrderStore
): ActionDispatcher {
  return new ActionDispatcher(wsClient, orderStore);
}
