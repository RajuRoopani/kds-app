/**
 * Kitchen Display System (KDS) — TypeScript Type Definitions
 * 
 * All types are derived from /kds_app/docs/ARCHITECTURE.md
 * Fully specified, zero `any` types.
 */

/**
 * Order Status: The 5 valid states in the kanban
 */
export type OrderStatus = 'Received' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';

/**
 * A single item in an order (e.g., "Burger", "Fries")
 */
export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
}

/**
 * Core order entity stored in the state store
 * Includes frontend-only fields for lifecycle management
 */
export interface Order {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number; // unix timestamp in ms
  updatedAt: number; // unix timestamp in ms
  // Frontend-only fields
  dismissTimer?: NodeJS.Timeout; // auto-dismiss timer ID for Completed/Cancelled
  isLoading?: boolean; // true while awaiting CONFIRMATION for an action
  lastSyncTimestamp?: number; // timestamp of last server sync for this order
}

/**
 * WebSocket Message Types: Discriminated union
 */

/**
 * Sent by backend when an existing order's status changes
 */
export interface OrderUpdateMessage {
  type: 'ORDER_UPDATE';
  orderId: string;
  status: OrderStatus;
  timestamp: number;
  metadata?: {
    updated_at: number;
    transitioned_by?: string;
  };
}

/**
 * Sent by backend when a new order arrives
 */
export interface OrderNewMessage {
  type: 'ORDER_NEW';
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus; // Always 'Received' for new orders
  createdAt: number;
  timestamp: number;
}

/**
 * Sent by backend after reconnection to sync full current state
 */
export interface OrderData {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  timestamp: number;
}

export interface StateSyncMessage {
  type: 'STATE_SYNC';
  orders: OrderData[];
  timestamp: number;
}

/**
 * Sent by backend in response to an ACTION message (user action)
 */
export interface ConfirmationMessage {
  type: 'CONFIRMATION';
  requestId: string; // UUID, matches the ACTION request
  orderId: string;
  action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL';
  success: boolean;
  reason?: string; // populated if success === false
  timestamp: number;
}

/**
 * Sent by backend when an error occurs
 */
export interface ErrorMessage {
  type: 'ERROR';
  code:
    | 'INVALID_MESSAGE'
    | 'ORDER_NOT_FOUND'
    | 'INVALID_ACTION'
    | 'RATE_LIMIT'
    | 'INTERNAL_ERROR';
  reason: string;
  timestamp: number;
}

/**
 * Union of all incoming message types from backend
 */
export type IncomingMessage =
  | OrderUpdateMessage
  | OrderNewMessage
  | StateSyncMessage
  | ConfirmationMessage
  | ErrorMessage;

/**
 * Sent by frontend when user clicks a state transition button
 */
export interface ActionMessage {
  type: 'ACTION';
  requestId: string; // UUID4, used to match CONFIRMATION
  orderId: string;
  action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL';
  timestamp: number;
}

/**
 * Union of all outgoing message types to backend
 */
export type OutgoingMessage = ActionMessage;

/**
 * Order Store API — Public interface
 */
export interface IOrderStore {
  // Mutable state
  orders: Map<string, Order>;

  // Mutations
  upsertOrder(order: Order): void;
  removeOrder(orderId: string): void;
  updateOrderStatus(orderId: string, newStatus: OrderStatus): void;
  replaceAllOrders(orders: Order[]): void; // called on STATE_SYNC
  setIsLoading(orderId: string, loading: boolean): void;

  // Selectors (derived)
  getOrdersByStatus(status: OrderStatus): Order[];
  getOrder(orderId: string): Order | undefined;
  getAllOrders(): Order[];
  getMetrics(): {
    total: number;
    byStatus: Record<OrderStatus, number>;
    avgWaitTime: number;
  };

  // Timer management
  startDismissTimer(orderId: string, delayMs: number): void;
  cancelDismissTimer(orderId: string): void;
  cancelAllDismissTimers(): void;

  // Subscription (pub/sub for React)
  subscribe(listener: (store: IOrderStore) => void): () => void;
}

/**
 * WebSocket Client API — Public interface
 */
export interface IWebSocketClient {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Send action
  sendAction(action: ActionMessage): Promise<void>;

  // Event handlers (React components subscribe to these)
  onConnected(callback: () => void): () => void;
  onDisconnected(callback: () => void): () => void;
  onMessage(callback: (message: IncomingMessage) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
}

/**
 * Action Dispatcher API — Public interface
 */
export interface IActionDispatcher {
  /**
   * Send an action and wait for confirmation
   * Throws if timeout (5s) or confirmation fails
   */
  dispatch(orderId: string, action: ActionMessage['action']): Promise<void>;

  /**
   * Cancel any pending action
   */
  cancelPending(): void;
}
