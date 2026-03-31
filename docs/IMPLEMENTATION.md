# KDS Phase 2 — WebSocket Client & State Management Implementation Guide

## Overview

This document describes the client-side WebSocket layer and state management system built for the Kitchen Display System (KDS) real-time dashboard.

## Architecture

### Layer 1: WebSocket Client (`src/client/ws-client.ts`)

**Purpose:** Manages the WebSocket connection lifecycle, message parsing, and auto-reconnection with exponential backoff.

**Key Features:**
- Opens WebSocket to backend at `wss://localhost:5000/orders`
- Parses incoming JSON messages by type discriminator
- Implements hybrid backoff: 0ms immediate, then 3s fixed intervals (max 10 attempts)
- Emits events: `onConnected`, `onDisconnected`, `onMessage`, `onError`
- Handles auto-reconnect on disconnection (unless user explicitly disconnects)

**Public API:**

```typescript
class WebSocketClient implements IWebSocketClient {
  connect(): Promise<void>           // Start connection
  disconnect(): void                 // Stop and prevent auto-reconnect
  isConnected(): boolean              // Check connection status
  sendAction(action: OutgoingMessage): Promise<void>  // Send message
  
  // Event subscribers (return unsubscribe function)
  onConnected(callback: () => void): () => void
  onDisconnected(callback: () => void): () => void
  onMessage(callback: (message: IncomingMessage) => void): () => void
  onError(callback: (error: Error) => void): () => void
}
```

**Usage Example:**

```typescript
const wsClient = new WebSocketClient('wss://localhost:5000/orders');

await wsClient.connect();

wsClient.onMessage((message) => {
  if (message.type === 'ORDER_NEW') {
    console.log(`New order: ${message.orderId}`);
  }
});

wsClient.onError((error) => {
  console.error('WebSocket error:', error.message);
});
```

**Reconnection Strategy (per AC1):**

```
Attempt 0: 0ms       (immediate retry on first disconnect)
Attempt 1: 3000ms
Attempt 2: 3000ms
...
Attempt 9: 3000ms    (max 10 attempts)
Total:     ~30 seconds before permanent offline error
```

### Layer 2: Order State Store (`src/client/order-store.ts`)

**Purpose:** Maintains normalized order state and provides selectors and pub/sub for React components.

**Design:**
- **Normalized:** Orders stored in `Map<orderId, Order>` for O(1) lookups
- **Derived:** Selectors compute kanban grouping on-demand (no denormalization)
- **Immutable updates:** Each state change triggers subscriber notifications
- **Auto-dismiss:** Completed orders removed after 5s, Cancelled after 10s

**Public API:**

```typescript
class OrderStore implements IOrderStore {
  // State
  orders: Map<string, Order>

  // Mutations
  upsertOrder(order: Order): void
  removeOrder(orderId: string): void
  updateOrderStatus(orderId: string, newStatus: OrderStatus): void
  replaceAllOrders(orders: Order[]): void  // Called on STATE_SYNC
  setIsLoading(orderId: string, loading: boolean): void

  // Selectors (computed on-demand)
  getOrdersByStatus(status: OrderStatus): Order[]
  getOrder(orderId: string): Order | undefined
  getAllOrders(): Order[]
  getMetrics(): { total: number; byStatus: Record<OrderStatus, number>; avgWaitTime: number }

  // Timer management
  startDismissTimer(orderId: string, delayMs: number): void
  cancelDismissTimer(orderId: string): void
  cancelAllDismissTimers(): void

  // Pub/Sub for React components
  subscribe(listener: (store: IOrderStore) => void): () => void
}
```

**Usage Example:**

```typescript
const store = new OrderStore();

// Subscribe to changes
const unsubscribe = store.subscribe((store) => {
  console.log('Orders updated!');
  const received = store.getOrdersByStatus('Received');
  console.log(`${received.length} orders in Received`);
});

// Upsert order
const order = {
  orderId: 'order-123',
  customerName: 'Alice',
  items: [{ itemId: 'item-1', name: 'Burger', quantity: 1 }],
  status: 'Received' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
store.upsertOrder(order);

// Auto-dismiss after 5s
store.startDismissTimer('order-123', 5000);

// Later: unsubscribe
unsubscribe();
```

**Auto-Dismiss Behavior:**

| Status | Delay | Behavior |
|--------|-------|----------|
| Completed | 5s | Automatically removed from state |
| Cancelled | 10s | Automatically removed from state |
| Received, Preparing, Ready | — | No auto-dismiss |

**Timer Restart on Reconnect (STATE_SYNC):**

When the backend sends `STATE_SYNC` after reconnection:
1. All existing dismiss timers are cancelled
2. Orders from `STATE_SYNC` are inserted
3. For each Completed order: start 5s timer
4. For each Cancelled order: start 10s timer

This prevents "stuck" timers if the STATE_SYNC message arrives late.

### Layer 3: Action Dispatcher (`src/client/action-dispatcher.ts`)

**Purpose:** Sends user actions to the backend and waits for CONFIRMATION, with timeout and deduplication logic.

**Key Features:**
- Generates UUID for each `requestId`
- Sets order to loading state while awaiting CONFIRMATION
- 5-second timeout; rejects if no CONFIRMATION arrives
- Dedups concurrent identical actions (double-click prevention)
- Clears loading state on success or failure

**Public API:**

```typescript
class ActionDispatcher implements IActionDispatcher {
  constructor(wsClient: IWebSocketClient, orderStore: IOrderStore)

  dispatch(orderId: string, action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL'): Promise<void>
  cancelPending(): void
  destroy(): void
}
```

**Usage Example:**

```typescript
const dispatcher = new ActionDispatcher(wsClient, store);

try {
  await dispatcher.dispatch('order-123', 'ACCEPT');
  console.log('Action succeeded');
} catch (error) {
  console.error('Action failed:', error.message);
  // User can retry or show error UI
}
```

**Deduplication Window:**
- Concurrent identical actions (same orderId + action) are deduplicated
- Dedup window is 500ms
- After window expires, user can re-fire the action

## Message Flow

### 1. Connection Established

```
User opens KDS
  ↓
WebSocketClient.connect()
  ↓
WebSocket onopen
  ↓
Emit onConnected event
  ↓
(React component re-renders)
```

### 2. New Order Arrives (ORDER_NEW)

```
Backend sends: { type: "ORDER_NEW", orderId: "o-1", status: "Received", items: [...] }
  ↓
WebSocketClient parses message
  ↓
Emits onMessage event with order data
  ↓
(React component receives ORDER_NEW via wsClient listener)
  ↓
Component calls store.upsertOrder(order)
  ↓
Store notifies subscribers
  ↓
(React components re-render and show new card in Received column)
```

### 3. User Clicks "Accept" (ACTION → CONFIRMATION)

```
User clicks [Accept] button in modal
  ↓
Component calls dispatcher.dispatch(orderId, 'ACCEPT')
  ↓
Dispatcher sets order.isLoading = true
  ↓
Dispatcher sends ACTION message with requestId UUID
  ↓
Store notifies subscribers (order shows loading state)
  ↓
(Component shows spinner on button)
  ↓
Backend receives ACTION
  ↓
Backend validates and updates database
  ↓
Backend sends CONFIRMATION with matching requestId
  ↓
Dispatcher receives CONFIRMATION
  ↓
Dispatcher clears order.isLoading
  ↓
Promise resolves
  ↓
Component closes modal
  ↓
(On next ORDER_UPDATE from backend, card moves to new column)
```

### 4. Reconnection (STATE_SYNC)

```
WebSocket closes (network loss)
  ↓
WebSocketClient emits onDisconnected
  ↓
(React component shows error banner)
  ↓
WebSocketClient schedules backoff retry (0ms for first, then 3s fixed)
  ↓
WebSocketClient reconnects
  ↓
WebSocketClient emits onConnected
  ↓
Backend automatically sends STATE_SYNC with full order state
  ↓
Dispatcher receives STATE_SYNC
  ↓
Store calls replaceAllOrders() (atomic)
  ↓
All existing dismiss timers cancelled
  ↓
Dismiss timers restarted for Completed/Cancelled orders
  ↓
Store notifies subscribers
  ↓
(React component dismisses error banner, re-renders with synced state)
```

## Data Types

All types are fully defined in `src/types.ts` with zero `any` types.

### Order

```typescript
interface Order {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;  // "Received" | "Preparing" | "Ready" | "Completed" | "Cancelled"
  createdAt: number;    // unix timestamp ms
  updatedAt: number;    // unix timestamp ms
  // Frontend-only
  dismissTimer?: NodeJS.Timeout;
  isLoading?: boolean;
}
```

### Incoming Messages (Backend → Frontend)

1. **ORDER_NEW**: New order arrives
2. **ORDER_UPDATE**: Existing order status changes
3. **STATE_SYNC**: Full state snapshot after reconnection
4. **CONFIRMATION**: Response to user action
5. **ERROR**: Backend error

### Outgoing Messages (Frontend → Backend)

1. **ACTION**: User clicked a transition button

See `src/types.ts` for full interface definitions.

## Error Handling

### WebSocket Errors

| Error | Action |
|-------|--------|
| Parse error (invalid JSON) | Emits onError, connection stays open |
| Network disconnect | Emits onDisconnected, auto-reconnects with backoff |
| Max retries exceeded | Emits onError with "Max reconnection attempts exceeded" |
| User explicit disconnect | No error, connection closed cleanly |

### Action Dispatch Errors

| Error | Action |
|-------|--------|
| Not connected | Rejects immediately with "WebSocket not connected" |
| Timeout (5s) | Rejects with "Action timeout" |
| Server validation failure | Rejects with failure reason from CONFIRMATION |
| Dedup (concurrent identical) | Returns immediately (silent dedup) |

### Frontend Component Responsibility

Components should:
1. Wrap `dispatcher.dispatch()` in try/catch
2. Show error toast on failure
3. Provide retry button for timeout errors
4. Show loading state while awaiting CONFIRMATION
5. Listen to `wsClient.onError()` for connection errors

## Integration with React

### Example: Custom Hook

```typescript
function useOrderStore(wsClient: IWebSocketClient, dispatcher: IActionDispatcher) {
  const [store, setStore] = useState<OrderStore>(() => new OrderStore());

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Subscribe to messages
    const unsub1 = wsClient.onMessage((message) => {
      if (message.type === 'ORDER_NEW') {
        store.upsertOrder({
          orderId: message.orderId,
          customerName: message.customerName,
          items: message.items,
          status: message.status,
          createdAt: message.createdAt,
          updatedAt: message.timestamp,
        });
      } else if (message.type === 'ORDER_UPDATE') {
        // Check for duplicate (ignore if updatedAt ≤ current)
        const current = store.getOrder(message.orderId);
        if (current && message.metadata?.updated_at <= current.updatedAt) {
          return; // Ignore stale update
        }
        store.updateOrderStatus(message.orderId, message.status);
        
        // Start dismiss timer if terminal
        if (message.status === 'Completed') {
          store.startDismissTimer(message.orderId, 5000);
        } else if (message.status === 'Cancelled') {
          store.startDismissTimer(message.orderId, 10000);
        }
      } else if (message.type === 'STATE_SYNC') {
        const orders = message.orders.map((o) => ({
          orderId: o.orderId,
          customerName: o.customerName,
          items: o.items,
          status: o.status,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        }));
        store.replaceAllOrders(orders);
        
        // Restart dismiss timers
        for (const order of message.orders) {
          if (order.status === 'Completed') {
            store.startDismissTimer(order.orderId, 5000);
          } else if (order.status === 'Cancelled') {
            store.startDismissTimer(order.orderId, 10000);
          }
        }
      }
    });

    const unsub2 = wsClient.onError((error) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      unsub1();
      unsub2();
      wsClient.disconnect();
    };
  }, [wsClient, store]);

  // Subscribe to store changes
  const [, setTrigger] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setTrigger((prev) => prev + 1);
    });
    return unsub;
  }, [store]);

  return { store, dispatcher };
}
```

## Testing

All three client layers have comprehensive unit tests with 85%+ coverage.

### Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage   # Coverage report
npm run test:ui         # Vitest UI dashboard
```

### Test Files

- `src/__tests__/ws-client.test.ts` (20+ tests)
  - Connection lifecycle, message parsing, reconnection logic
  - Mock WebSocket (no real server needed)

- `src/__tests__/order-store.test.ts` (30+ tests)
  - State management, selectors, auto-dismiss timers
  - Pub/sub, atomic STATE_SYNC

- `src/__tests__/action-dispatcher.test.ts` (15+ tests)
  - Action sending, CONFIRMATION matching, timeout logic
  - Request deduplication, error handling

## Performance Notes

### Memory Footprint
- Each order: ~500 bytes (in JavaScript object)
- 200 orders = ~100 KB (negligible)

### Message Throughput
- 100–200 orders/sec incoming
- ~3–4 messages per status change (ORDER_UPDATE broadcast + confirmation)
- 20–50 concurrent sessions
- Total: ~500–2000 messages/sec (WebSocket easily handles)

### State Updates
- `upsertOrder()`: O(1) map insertion + subscriber notify
- `getOrdersByStatus()`: O(n) filter (n = active orders, typically <500)
- React re-render: batched by React, should be <100ms

## Limitations & Future Work

### Current (MVP)

✅ Real-time order state  
✅ Auto-dismiss timers  
✅ Reconnection with STATE_SYNC  
✅ Action timeout + retry  
✅ Dedup concurrent actions  

### Out of Scope

- Order history/analytics (future phase)
- Undo/redo for state transitions
- Multi-location support (single KDS instance per restaurant)
- Order filtering/search (future phase)
- Bulk actions (accept multiple at once)

## Troubleshooting

### WebSocket Won't Connect

**Check:**
- Backend URL is correct: `wss://localhost:5000/orders`
- Backend is running and listening
- TLS certificate is valid (for `wss://`, not `ws://`)
- Firewall doesn't block WebSocket port 5000

**Debug:**
```typescript
wsClient.onError((error) => console.error('WS Error:', error));
wsClient.onDisconnected(() => console.log('WS Disconnected'));
```

### Orders Not Updating

**Check:**
- WebSocket is connected: `wsClient.isConnected()`
- Messages are being received: `wsClient.onMessage((msg) => console.log(msg))`
- Store subscribers are registered: `store.subscribe(...)`
- React is re-rendering: check DevTools

### Action Timeouts

**Check:**
- Server is responding: check backend logs
- Network latency: use DevTools Network tab
- CONFIRMATION message format matches schema
- requestId in CONFIRMATION matches ACTION requestId

### Stuck Timers

**Cause:** Order stuck in Completed/Cancelled but not removed (timer didn't fire)

**Fix:** Ensure STATE_SYNC cancels all timers and restarts them:
```typescript
store.cancelAllDismissTimers();
for (const order of syncedOrders) {
  if (order.status === 'Completed') {
    store.startDismissTimer(order.orderId, 5000);
  }
}
```

## API Contract Summary

### Backend Must Provide

✅ WebSocket endpoint: `/orders` at `wss://localhost:5000`  
✅ Send ORDER_NEW when new order arrives  
✅ Send ORDER_UPDATE when status changes  
✅ Send STATE_SYNC on client reconnection  
✅ Send CONFIRMATION after ACTION received  
✅ Include `updatedAt` in ORDER_UPDATE (for dedup)  
✅ Validate action and current status before updating  

### Frontend Guarantees

✅ All orders kept in memory (no polling)  
✅ Duplicate ORDER_UPDATE detection (by `updatedAt`)  
✅ Auto-dismiss Completed/Cancelled after 5/10s  
✅ UUID requestId for every ACTION  
✅ Auto-reconnect with backoff on disconnect  
✅ STATE_SYNC atomic replacement (not merge)  

---

**Document Version:** 1.0  
**Status:** Ready for Phase 2 development  
**Owned by:** Senior Developer (Team Claw)  
**Last Updated:** [Current Date]
