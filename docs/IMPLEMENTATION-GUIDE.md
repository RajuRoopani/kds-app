# KDS Implementation Guide for Dev Team

This guide breaks down the architecture into concrete tasks for frontend and backend teams.

---

## Sync Point: Message Schema (Lock This First)

**Before anyone codes, both teams must agree on:**

1. ✅ All 6 message types (ORDER_NEW, ORDER_UPDATE, STATE_SYNC, CONFIRMATION, ERROR, ACTION)
2. ✅ Exact JSON structure (field names, types, presence of optional fields)
3. ✅ Message delivery guarantees (what happens on duplicate? what's the idempotency key?)
4. ✅ Timestamps (are they server or client? which field is authoritative?)

**Reference:** `ARCHITECTURE.md` sections "WebSocket Message Schema" (locked, ready to code against)

---

## Frontend Task Breakdown

### **Phase 1: WebSocket Connection & Message Parsing**

**Task: `useWebSocket` Hook**

```typescript
// hooks/useWebSocket.ts
export function useWebSocket(url: string) {
  const [status, setStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Open connection on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const connectWebSocket = () => {
    // Connect to backend WebSocket
    // Handle onopen, onmessage, onerror, onclose
  };

  const onMessage = (event: MessageEvent) => {
    // Parse JSON
    const msg = JSON.parse(event.data);
    
    // Route by msg.type
    switch (msg.type) {
      case "ORDER_NEW": handleOrderNew(msg); break;
      case "ORDER_UPDATE": handleOrderUpdate(msg); break;
      case "STATE_SYNC": handleStateSync(msg); break;
      case "CONFIRMATION": handleConfirmation(msg); break;
      case "ERROR": handleError(msg); break;
    }
  };

  const onClose = () => {
    // Implement exponential backoff (0ms, then 3s fixed)
    // See ADR-003 for algorithm
  };

  const sendAction = (orderId: string, action: ActionType) => {
    // Queue ACTION message with new requestId
    // Set 5s timeout for CONFIRMATION
  };

  return { status, errors, sendAction };
}
```

**Acceptance Criteria:**
- [ ] WebSocket opens on component mount
- [ ] All 5 message types are parsed without errors
- [ ] Connection closes and retries with correct backoff (0ms, 3s, 3s, ...)
- [ ] Errors are captured and exposed (for toast notifications)
- [ ] `sendAction()` queues messages with requestId (UUID4)
- [ ] 5-second timeout triggers retry prompt if CONFIRMATION doesn't arrive

---

### **Phase 2: Order State Store**

**Task: `OrderStore` (Zustand)**

```typescript
// store/orderStore.ts
import { create } from "zustand";

interface Order {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  dismissTimer?: NodeJS.Timeout;
  isLoading?: boolean;
  lastSyncTimestamp?: number;
}

interface OrderStore {
  orders: Map<string, Order>;
  
  // Mutations
  upsertOrder(order: Order): void;
  removeOrder(orderId: string): void;
  updateOrderStatus(orderId: string, newStatus: OrderStatus): void;
  replaceAllOrders(orders: Order[]): void; // STATE_SYNC
  setIsLoading(orderId: string, loading: boolean): void;
  
  // Selectors
  getOrdersByStatus(status: OrderStatus): Order[];
  getOrder(orderId: string): Order | undefined;
  getAllOrders(): Order[];
  
  // Timer management
  startDismissTimer(orderId: string, delayMs: number): void;
  cancelDismissTimer(orderId: string): void;
  cancelAllDismissTimers(): void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: new Map(),

  upsertOrder(order: Order) {
    set((state) => {
      const newMap = new Map(state.orders);
      newMap.set(order.orderId, order);
      return { orders: newMap };
    });
  },

  removeOrder(orderId: string) {
    set((state) => {
      const newMap = new Map(state.orders);
      newMap.delete(orderId);
      return { orders: newMap };
    });
  },

  updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const order = get().orders.get(orderId);
    if (!order) return;
    
    const updated = { ...order, status: newStatus, updatedAt: Date.now() };
    get().upsertOrder(updated);
  },

  replaceAllOrders(orders: Order[]) {
    // Cancel all existing timers first
    get().cancelAllDismissTimers();
    
    // Replace state
    set({ orders: new Map(orders.map((o) => [o.orderId, o])) });
    
    // Restart timers for terminal states
    orders.forEach((order) => {
      if (order.status === "Completed") {
        get().startDismissTimer(order.orderId, 5000);
      } else if (order.status === "Cancelled") {
        get().startDismissTimer(order.orderId, 10000);
      }
    });
  },

  getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(get().orders.values())
      .filter((order) => order.status === status)
      .sort((a, b) => a.createdAt - b.createdAt); // Oldest first
  },

  getOrder(orderId: string): Order | undefined {
    return get().orders.get(orderId);
  },

  getAllOrders(): Order[] {
    return Array.from(get().orders.values());
  },

  startDismissTimer(orderId: string, delayMs: number) {
    const order = get().orders.get(orderId);
    if (!order) return;

    // Cancel existing timer
    if (order.dismissTimer) {
      clearTimeout(order.dismissTimer);
    }

    const timer = setTimeout(() => {
      get().removeOrder(orderId);
      // Optional: show toast "Order dismissed"
    }, delayMs);

    get().upsertOrder({ ...order, dismissTimer: timer });
  },

  cancelDismissTimer(orderId: string) {
    const order = get().orders.get(orderId);
    if (!order?.dismissTimer) return;

    clearTimeout(order.dismissTimer);
    get().upsertOrder({ ...order, dismissTimer: undefined });
  },

  cancelAllDismissTimers() {
    for (const order of get().orders.values()) {
      if (order.dismissTimer) {
        clearTimeout(order.dismissTimer);
      }
    }
  },

  setIsLoading(orderId: string, loading: boolean) {
    const order = get().orders.get(orderId);
    if (!order) return;
    get().upsertOrder({ ...order, isLoading: loading });
  },
}));
```

**Acceptance Criteria:**
- [ ] Store initializes empty
- [ ] `upsertOrder()` adds or updates order (keyed by orderId)
- [ ] `removeOrder()` deletes order (idempotent, no error if missing)
- [ ] `replaceAllOrders()` atomically replaces entire store + restarts timers
- [ ] `startDismissTimer()` starts 5s/10s countdown and removes order when timer fires
- [ ] `cancelDismissTimer()` stops timer (called on reconnect before STATE_SYNC)
- [ ] Selectors return correct filtered lists (no mutations)
- [ ] Timer is idempotent (calling `removeOrder()` when timer fires is safe)

---

### **Phase 3: Kanban Board Component**

**Task: `KanbanBoard` Component**

```typescript
// components/KanbanBoard.tsx
export function KanbanBoard() {
  const store = useOrderStore();
  
  const kanbanView = {
    Received: store.getOrdersByStatus("Received"),
    Preparing: store.getOrdersByStatus("Preparing"),
    Ready: store.getOrdersByStatus("Ready"),
    Completed: store.getOrdersByStatus("Completed"),
    Cancelled: store.getOrdersByStatus("Cancelled"),
  };

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <div className="kanban-container">
      {Object.entries(kanbanView).map(([status, orders]) => (
        <KanbanColumn
          key={status}
          title={status}
          orders={orders}
          onCardClick={(order) => setSelectedOrder(order)}
        />
      ))}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAction={(action) => handleAction(selectedOrder.orderId, action)}
        />
      )}
    </div>
  );
}

function KanbanColumn({ title, orders, onCardClick }) {
  return (
    <div className="column">
      <h3>{title}</h3>
      <div className="orders">
        {orders.map((order) => (
          <OrderCard
            key={order.orderId}
            order={order}
            onClick={() => onCardClick(order)}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onClick }) {
  return (
    <div className="card" onClick={onClick}>
      <div className="card-header">
        <span className="order-id">{order.orderId}</span>
        <span className="status-badge">{order.status}</span>
      </div>
      <div className="card-body">
        <p className="customer-name">{order.customerName}</p>
        <p className="items-count">{order.items.length} items</p>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] 5 columns rendered (Received, Preparing, Ready, Completed, Cancelled)
- [ ] Orders grouped correctly by status (derived from store)
- [ ] Card click opens modal with order details
- [ ] Card displays: orderId, customerName, itemCount, status badge
- [ ] Card animates on entry (optional flash for ORDER_NEW)
- [ ] Card animates on exit when auto-dismissed (optional fade)
- [ ] Responsive layout (mobile breakpoint ≤600px, columns stack)

---

### **Phase 4: Order Modal & Actions**

**Task: `OrderModal` Component**

```typescript
// components/OrderModal.tsx
export function OrderModal({ order, onClose, onAction }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActionClick = async (action: ActionType) => {
    setIsLoading(true);
    setError(null);

    try {
      await onAction(action);
      // onAction will trigger CONFIRMATION or timeout
      // If success, close modal
      onClose();
    } catch (err) {
      setError(err.message);
      // Show toast, keep modal open, allow retry
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableActions = (): ActionType[] => {
    switch (order.status) {
      case "Received": return ["ACCEPT", "CANCEL"];
      case "Preparing": return ["READY", "CANCEL"];
      case "Ready": return ["COMPLETE", "CANCEL"];
      case "Completed": return ["DISMISS"];
      case "Cancelled": return ["DISMISS"];
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Order {order.orderId}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p><strong>Customer:</strong> {order.customerName}</p>
          <p><strong>Status:</strong> {order.status}</p>

          <div className="items">
            <h4>Items:</h4>
            <ul>
              {order.items.map((item) => (
                <li key={item.itemId}>
                  {item.quantity}x {item.name}
                </li>
              ))}
            </ul>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-actions">
          {getAvailableActions().map((action) => (
            <button
              key={action}
              disabled={isLoading}
              onClick={() => handleActionClick(action)}
            >
              {isLoading ? "Loading..." : action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Modal displays order ID, customer name, full items list
- [ ] Action buttons match current status (Accept for Received, Ready for Preparing, etc.)
- [ ] Buttons are disabled while loading (awaiting CONFIRMATION)
- [ ] Timeout error shows after 5s (no CONFIRMATION): "Request timed out. Click to retry."
- [ ] Server error shows: "Order was already [action] by another user"
- [ ] Success: close modal, card moves to new column
- [ ] Dismiss button: closes modal, removes card immediately

---

### **Phase 5: Integrate WebSocket & Store**

**Task: Hook up useWebSocket to dispatch events to OrderStore**

In `App.tsx` or main component:

```typescript
export function App() {
  const { status, errors, sendAction } = useWebSocket(WS_URL);
  const store = useOrderStore();

  // When WebSocket receives ORDER_NEW
  useEffect(() => {
    if (status === "connected") {
      // Listen to WebSocket messages and dispatch to store
      // This is handled inside useWebSocket; dispatch via callbacks
    }
  }, [status]);

  // Handle error toasts
  useEffect(() => {
    errors.forEach((error) => {
      showToast(error.reason, "error");
    });
  }, [errors]);

  return (
    <>
      <div className={`status-bar status-${status}`}>
        {status === "offline" && (
          <>
            <span>Kitchen system offline</span>
            <button onClick={() => sendAction(null, "RECONNECT")}>Retry</button>
          </>
        )}
      </div>
      <KanbanBoard />
    </>
  );
}
```

**Acceptance Criteria:**
- [ ] WebSocket message handlers call store methods (upsertOrder, removeOrder, etc.)
- [ ] ACTION sent via `sendAction(orderId, action)`
- [ ] CONFIRMATION handlers match requestId and update loading state
- [ ] STATE_SYNC handler calls `store.replaceAllOrders()`
- [ ] Toast notifications shown for errors
- [ ] Offline status bar shown when disconnected

---

## Backend Task Breakdown

### **Task 1: WebSocket Endpoint (`/ws/orders`)**

**Requirements:**
- Upgrade HTTP connection to WebSocket
- Authenticate (verify token in header/query param)
- Accept connections from multiple clients (50+ concurrent)
- Route incoming messages by `type` field
- Broadcast ORDER_UPDATE/ORDER_NEW to all connected clients
- Handle disconnections (cleanup per-session state)

**Pseudocode:**
```
on /ws/orders upgrade:
  validate auth token
  create session (track client ID, user ID, connection time)
  send STATE_SYNC (full current order list)
  
on message:
  parse JSON
  switch msg.type:
    case "ACTION": handle_action(msg)
    case other: ignore or log
    
on close:
  cleanup session
  broadcast to other clients? (optional: "user left")
```

**Acceptance Criteria:**
- [ ] WebSocket endpoint accepts connections at `/ws/orders`
- [ ] Authenticates with Bearer token
- [ ] Sends STATE_SYNC immediately after connection (full order list)
- [ ] Receives ACTION messages and validates (orderId, action, status)
- [ ] Broadcasts ORDER_UPDATE to all clients after state change
- [ ] Sends CONFIRMATION back to requester (within 1-2s per AC3)
- [ ] Handles disconnections gracefully
- [ ] Implements rate limiting (10 ACTIONs/sec per session)

### **Task 2: Order State Management**

**Responsibilities:**
- Maintain current order state (in-memory or DB-backed)
- Validate action is legal for current status
- Apply state transition atomically
- Persist to DB (before broadcast)
- Prevent concurrent modifications (use lock or versioning)

**State Machine:**
```
Received ──(ACCEPT)──> Preparing ──(READY)──> Ready ──(COMPLETE)──> Completed
   │                      │                       │
   └──(CANCEL)────────────┴──────────────────────┴──> Cancelled
```

**Concurrency Strategy:**
- Option A: Row-level database lock (SELECT ... FOR UPDATE)
- Option B: Optimistic locking (version column, retry on conflict)
- Option C: Single-threaded queue (all action processing serialized)

Recommend: **Option A** (row-level lock, simplest for small volumes)

**Pseudocode:**
```
on ACTION(orderId, action):
  lock row (order where id = orderId)
  
  if order not found:
    send CONFIRMATION(success: false, reason: "Order not found")
    return
  
  if not valid_transition(order.status, action):
    send CONFIRMATION(success: false, reason: "Invalid action for status")
    return
  
  new_status = apply_transition(order.status, action)
  order.status = new_status
  order.updated_at = now()
  
  save to DB
  unlock row
  
  broadcast ORDER_UPDATE(orderId, new_status) to all clients
  send CONFIRMATION(requestId, success: true) to requester
```

**Acceptance Criteria:**
- [ ] Action validation (order exists, status allows transition)
- [ ] Atomic update (no partial state)
- [ ] Concurrent action handling (first wins, others get `success: false`)
- [ ] Broadcast ORDER_UPDATE to all clients within 500ms
- [ ] Send CONFIRMATION within 1-2s (AC3: 200ms visual confirmation)
- [ ] Persist state changes to DB before broadcast
- [ ] Include `updated_at` timestamp in ORDER_UPDATE (for duplicate prevention)

### **Task 3: STATE_SYNC Handler**

**Purpose:** On reconnection, send full order list to client.

**Pseudocode:**
```
on /ws/orders upgrade (after auth):
  send STATE_SYNC:
    orders = all orders in DB where status != very_old
    include: orderId, customerName, items, status, createdAt, updatedAt, timestamp
    
  note: "very_old" = completed/cancelled >5 min ago (optional retention limit)
```

**Acceptance Criteria:**
- [ ] Sent immediately after WebSocket handshake
- [ ] Includes all active orders (Received through Ready)
- [ ] Includes Completed/Cancelled orders <10 minutes old
- [ ] Each order has: orderId, customerName, items[], status, createdAt, updatedAt, timestamp
- [ ] Timestamp is server time (not client time)

### **Task 4: Error Handling & Logging**

**Error messages backend sends:**

| Code | Reason | Example |
|------|--------|---------|
| INVALID_MESSAGE | Message format unrecognized | Missing required field |
| ORDER_NOT_FOUND | orderId doesn't exist | ACTION for non-existent order |
| INVALID_ACTION | Action not valid for status | ACCEPT when status != Received |
| RATE_LIMIT | Too many requests from client | >10 ACTIONs/sec |
| INTERNAL_ERROR | Server error | Unexpected exception |

**Logging:** Log all state transitions (who, what, when) for audit trail.

---

## Testing Strategy

### **Frontend Unit Tests**

```typescript
// Test store mutations
test("upsertOrder adds order to map", () => {
  const store = useOrderStore.getState();
  store.upsertOrder({ orderId: "1", status: "Received", ... });
  expect(store.orders.get("1")).toBeDefined();
});

test("removeOrder is idempotent", () => {
  const store = useOrderStore.getState();
  store.removeOrder("non-existent");
  expect(() => store.removeOrder("non-existent")).not.toThrow();
});

// Test state machine
test("getOrdersByStatus filters correctly", () => {
  const store = useOrderStore.getState();
  store.upsertOrder({ orderId: "1", status: "Received", ... });
  store.upsertOrder({ orderId: "2", status: "Preparing", ... });
  expect(store.getOrdersByStatus("Received")).toHaveLength(1);
});

// Test auto-dismiss timers
test("startDismissTimer removes order after delay", (done) => {
  const store = useOrderStore.getState();
  store.upsertOrder({ orderId: "1", status: "Completed", ... });
  store.startDismissTimer("1", 100);
  
  setTimeout(() => {
    expect(store.orders.get("1")).toBeUndefined();
    done();
  }, 150);
});
```

### **Integration Tests (Frontend)**

- Test useWebSocket hook with mocked WebSocket
- Test KanbanBoard renders correct columns
- Test OrderModal action buttons send correct ACTION messages
- Test reconnection flow (disconnect → retry → STATE_SYNC)

### **Backend Integration Tests**

- Test ACTION validation (valid transition succeeds, invalid fails)
- Test concurrent ACTIONs (first wins, second fails)
- Test broadcast to multiple clients
- Test STATE_SYNC on connect
- Test rate limiting

---

## Deployment Checklist

- [ ] Frontend: Build and test locally
- [ ] Backend: Test WebSocket endpoint with simple client
- [ ] Sync: Both teams agree on message schema
- [ ] Auth: Verify token validation in WebSocket upgrade
- [ ] Monitoring: Add metrics (connection count, message throughput, latency)
- [ ] Staging: Deploy to staging and smoke test with real network conditions
- [ ] Rollout: Deploy to production, monitor errors and reconnection rate

