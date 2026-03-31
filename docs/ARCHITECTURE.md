# Kitchen Display System (KDS) — Architecture Design

## Overview

The KDS is a real-time React SPA that displays incoming food orders in a kanban-style dashboard with 5 status columns (Received → Preparing → Ready → Completed → Cancelled). The frontend maintains order state by consuming WebSocket messages from the backend, allowing kitchen staff to transition orders with one-click actions. The architecture prioritizes:

- **Sub-second latency** (200ms visual confirmation per user story AC3)
- **High throughput** (100–200 orders/sec)
- **State consistency** during network disruptions (reconnection with state reconciliation)
- **Order loss prevention** (no orders dropped during reconnect)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND                                 │
│  (Node.js / Python / Go WebSocket Server)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WebSocket Endpoint: /ws/orders                       │  │
│  │ - Sends: order updates (state changes, new orders)   │  │
│  │ - Receives: user actions (accept, ready, complete)   │  │
│  │ - Max concurrent: 20-50 kitchen staff sessions       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Order State Store (Database)                         │  │
│  │ - Orders table (id, status, items, timestamps)       │  │
│  │ - Broadcast all state changes to connected clients   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WebSocket Manager                                    │  │
│  │ - Open connection on mount                           │  │
│  │ - Parse incoming messages (type, payload)            │  │
│  │ - Exponential backoff reconnect on close             │  │
│  │ - Sync state after reconnect (fetch full state)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Order State Store (React Context / Zustand)          │  │
│  │ - Normalized: Map<orderId, Order>                    │  │
│  │ - Keyed by order ID for O(1) lookups                 │  │
│  │ - Derived: grouped by status for kanban rendering    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Kanban Board Component                               │  │
│  │ - 5 columns: Received | Preparing | Ready |          │  │
│  │             Completed | Cancelled                    │  │
│  │ - Auto-dismiss: Completed (5s) + Cancelled (10s)     │  │
│  │ - Order card modal on click (confirm action)         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. **WebSocket Manager** (`hooks/useWebSocket.ts`)
Responsible for establishing and managing the WebSocket connection lifecycle, message parsing, and reconnection logic.

**Responsibilities:**
- Open WebSocket on component mount
- Parse incoming messages by type (STATE_SYNC, ORDER_UPDATE, ORDER_NEW, CONFIRMATION, ERROR)
- Queue outgoing action messages (ACCEPT, READY, COMPLETE, CANCEL) with idempotency keys
- Implement exponential backoff reconnection (3s, 6s, 12s, 24s, max 60s)
- Fetch full order state after reconnect to prevent state divergence
- Emit events to OrderStateStore

### 2. **Order State Store** (`store/orderStore.ts`)
Manages the normalized order state and provides selectors for the kanban board.

**Responsibilities:**
- Maintain Map<orderId, Order> (normalized)
- Apply WebSocket updates atomically (upsert or delete)
- Compute derived state: orders grouped by status
- Trigger auto-dismiss timers when order enters Completed or Cancelled state
- Expose selectors: `getOrdersByStatus()`, `getOrder()`, `getAllOrders()`

### 3. **Kanban Board Component** (`components/KanbanBoard.tsx`)
Renders the 5-column display, order cards, and modal for actions.

**Responsibilities:**
- Render 5 status columns (Received, Preparing, Ready, Completed, Cancelled)
- Render order cards (ID, customer name, items count, status badge)
- Show modal on card click (display items, confirm action buttons)
- Disable action buttons during network error (show retry message)
- Handle auto-dismiss by removing order from DOM after timer fires

### 4. **Modal Component** (`components/OrderModal.tsx`)
Display order details and action buttons.

**Responsibilities:**
- Show order ID, customer name, full items list
- Render action buttons matching current status:
  - Received → [Accept] or [Cancel]
  - Preparing → [Ready] or [Cancel]
  - Ready → [Complete] or [Cancel]
  - Completed/Cancelled → [Dismiss] (auto-dismissed after timer, manual override via button)
- Send action message to WebSocket on button click
- Show loading state while awaiting confirmation

---

## WebSocket Message Schema

### **1. Incoming Messages (Backend → Frontend)**

All messages are JSON objects with a `type` discriminator field.

#### **A. ORDER_UPDATE**
Sent when an existing order's status changes.

```json
{
  "type": "ORDER_UPDATE",
  "orderId": "order-12345",
  "status": "Preparing",
  "timestamp": 1704067200000,
  "metadata": {
    "updated_at": 1704067200000,
    "transitioned_by": "kitchen_user_42"
  }
}
```

**TypeScript:**
```typescript
interface OrderUpdateMessage {
  type: "ORDER_UPDATE";
  orderId: string;
  status: OrderStatus;
  timestamp: number;
  metadata?: {
    updated_at: number;
    transitioned_by?: string;
  };
}
```

**Frontend Behavior:**
- Update order's status in state store
- If status is Completed or Cancelled, start auto-dismiss timer
- Trigger re-render (move card to new column)

#### **B. ORDER_NEW**
Sent when a new order arrives.

```json
{
  "type": "ORDER_NEW",
  "orderId": "order-12346",
  "customerName": "Alice Chen",
  "items": [
    { "itemId": "item-001", "name": "Burger", "quantity": 2 },
    { "itemId": "item-002", "name": "Fries", "quantity": 1 }
  ],
  "status": "Received",
  "createdAt": 1704067200000,
  "timestamp": 1704067200100
}
```

**TypeScript:**
```typescript
interface OrderNewMessage {
  type: "ORDER_NEW";
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  timestamp: number;
}

interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
}
```

**Frontend Behavior:**
- Insert order into state store (status = Received)
- Card appears in Received column
- Flash animation (visual pulse) to draw attention

#### **C. STATE_SYNC**
Sent after reconnection to resync the full current state (all active orders).

```json
{
  "type": "STATE_SYNC",
  "orders": [
    {
      "orderId": "order-12345",
      "customerName": "Bob Smith",
      "items": [
        { "itemId": "item-003", "name": "Pizza", "quantity": 1 }
      ],
      "status": "Preparing",
      "createdAt": 1704067200000,
      "updatedAt": 1704067210000,
      "timestamp": 1704067210000
    }
  ],
  "timestamp": 1704067210100
}
```

**TypeScript:**
```typescript
interface StateSyncMessage {
  type: "STATE_SYNC";
  orders: OrderData[];
  timestamp: number;
}

interface OrderData {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  timestamp: number;
}
```

**Frontend Behavior:**
- Replace entire order map with synced state
- Clear all in-flight auto-dismiss timers
- Restart timers for any orders already in Completed/Cancelled state
- No visual flash (silent sync)

#### **D. CONFIRMATION**
Sent in response to a user action (ACCEPT, READY, COMPLETE, CANCEL).

```json
{
  "type": "CONFIRMATION",
  "requestId": "req-uuid-12345",
  "orderId": "order-12345",
  "action": "ACCEPT",
  "success": true,
  "timestamp": 1704067215000
}
```

**TypeScript:**
```typescript
interface ConfirmationMessage {
  type: "CONFIRMATION";
  requestId: string;
  orderId: string;
  action: "ACCEPT" | "READY" | "COMPLETE" | "CANCEL";
  success: boolean;
  reason?: string; // if success === false
  timestamp: number;
}
```

**Frontend Behavior:**
- Match `requestId` to outstanding request in queue
- If success, remove from pending queue and update order state
- If failure, show toast error (reason) and re-enable button
- Close modal and clear loading state

#### **E. ERROR**
Sent when server encounters an error (invalid message, internal error).

```json
{
  "type": "ERROR",
  "code": "INVALID_MESSAGE",
  "reason": "Message format unrecognized",
  "timestamp": 1704067220000
}
```

**TypeScript:**
```typescript
interface ErrorMessage {
  type: "ERROR";
  code: "INVALID_MESSAGE" | "ORDER_NOT_FOUND" | "INVALID_ACTION" | "RATE_LIMIT" | "INTERNAL_ERROR";
  reason: string;
  timestamp: number;
}
```

**Frontend Behavior:**
- Log error
- Show toast notification (brief)
- For RATE_LIMIT, show user-facing message: "Kitchen system busy, please try again"
- Non-fatal; connection remains open

---

### **2. Outgoing Messages (Frontend → Backend)**

#### **A. ACTION**
Sent when user clicks a state transition button in the modal.

```json
{
  "type": "ACTION",
  "requestId": "req-uuid-67890",
  "orderId": "order-12345",
  "action": "ACCEPT",
  "timestamp": 1704067205000
}
```

**TypeScript:**
```typescript
interface ActionMessage {
  type: "ACTION";
  requestId: string; // UUID4, used to match CONFIRMATION
  orderId: string;
  action: "ACCEPT" | "READY" | "COMPLETE" | "CANCEL";
  timestamp: number;
}
```

**Backend Behavior:**
- Validate orderId exists and current status allows action
- Update order state in database
- Broadcast ORDER_UPDATE to all connected clients
- Send CONFIRMATION back to requesting client (within 1-2s per AC3)

---

## State Management Architecture

### **Order State Shape (Normalized)**

```typescript
// Single order in the store
interface Order {
  orderId: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  // Frontend-only fields for lifecycle management
  dismissTimer?: NodeJS.Timeout; // auto-dismiss timer ID
  isLoading?: boolean; // true while awaiting CONFIRMATION
  lastSyncTimestamp?: number; // timestamp of last server sync for this order
}

type OrderStatus = "Received" | "Preparing" | "Ready" | "Completed" | "Cancelled";

interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
}

// Global state store (using Zustand or React Context)
interface OrderStore {
  // Normalized map: orderId → Order
  orders: Map<string, Order>;
  
  // Methods
  upsertOrder(order: Order): void;
  removeOrder(orderId: string): void;
  updateOrderStatus(orderId: string, newStatus: OrderStatus): void;
  replaceAllOrders(orders: Order[]): void; // called on STATE_SYNC
  
  // Derived selectors (computed in render, not cached)
  getOrdersByStatus(status: OrderStatus): Order[];
  getOrder(orderId: string): Order | undefined;
  getAllOrders(): Order[];
  
  // Timers
  startDismissTimer(orderId: string, delayMs: number): void;
  cancelDismissTimer(orderId: string): void;
  setIsLoading(orderId: string, loading: boolean): void;
}
```

### **Kanban Board Derived State**

The kanban view is NOT stored; it's computed from `orders` on each render:

```typescript
const kanbanView = {
  Received: orderStore.getOrdersByStatus("Received"),
  Preparing: orderStore.getOrdersByStatus("Preparing"),
  Ready: orderStore.getOrdersByStatus("Ready"),
  Completed: orderStore.getOrdersByStatus("Completed"),
  Cancelled: orderStore.getOrdersByStatus("Cancelled"),
};
```

**Why normalized + derived?**
- **Normalized:** O(1) lookups and updates; single source of truth
- **Derived:** Kanban rendering is simple filtering/mapping; avoids maintaining two copies of truth
- **No denormalization:** Tempting to pre-group by status, but causes bugs on reconnect (stale grouping, duplicate cards)

---

## Auto-Dismiss State Machine

### **Rules**

1. When an order **transitions to Completed**:
   - Start 5-second countdown timer
   - Show countdown badge (optional UI detail)
   - After 5s, automatically remove from DOM (call `removeOrder()`)
   - User can click [Dismiss] button to close modal immediately (override timer)

2. When an order **transitions to Cancelled**:
   - Start 10-second countdown timer
   - After 10s, automatically remove from DOM
   - User can click [Dismiss] button to close modal immediately (override timer)

3. When **reconnection occurs** (STATE_SYNC):
   - Cancel all existing timers for completed/cancelled orders
   - For each synced order in Completed/Cancelled state, restart its timer
   - Prevents "stuck" timers if sync message is delayed

### **Implementation (Pseudo-code)**

```typescript
// In OrderStore
startDismissTimer(orderId: string, delayMs: number) {
  const existingTimer = this.orders.get(orderId)?.dismissTimer;
  if (existingTimer) clearTimeout(existingTimer);
  
  const timer = setTimeout(() => {
    this.removeOrder(orderId);
    // Notify UI that card was dismissed (optional toast)
  }, delayMs);
  
  this.orders.set(orderId, {
    ...this.orders.get(orderId)!,
    dismissTimer: timer,
  });
}

cancelDismissTimer(orderId: string) {
  const order = this.orders.get(orderId);
  if (order?.dismissTimer) {
    clearTimeout(order.dismissTimer);
    order.dismissTimer = undefined;
  }
}

// When WebSocket receives ORDER_UPDATE with Completed/Cancelled:
onOrderUpdate(msg: OrderUpdateMessage) {
  const order = this.orders.get(msg.orderId);
  if (!order) return;
  
  const wasTerminal = order.status === "Completed" || order.status === "Cancelled";
  const isNowTerminal = msg.status === "Completed" || msg.status === "Cancelled";
  
  this.updateOrderStatus(msg.orderId, msg.status);
  
  if (isNowTerminal && !wasTerminal) {
    const delayMs = msg.status === "Completed" ? 5000 : 10000;
    this.startDismissTimer(msg.orderId, delayMs);
  }
}

// On reconnection (STATE_SYNC):
onStateSync(msg: StateSyncMessage) {
  // Cancel all existing timers
  for (const order of this.orders.values()) {
    this.cancelDismissTimer(order.orderId);
  }
  
  // Replace state
  this.replaceAllOrders(msg.orders);
  
  // Restart timers for terminal orders
  for (const order of msg.orders) {
    if (order.status === "Completed") {
      this.startDismissTimer(order.orderId, 5000);
    } else if (order.status === "Cancelled") {
      this.startDismissTimer(order.orderId, 10000);
    }
  }
}
```

---

## Reconnection & Error Recovery Strategy

### **Connection Lifecycle**

```
[Offline/Init]
      ↓ (mount)
   [Connecting]
      ↓ (onopen)
   [Connected] ←─────────────────┐
      ↓ (onerror/onclose)       │
   [Reconnecting] ─→ [Backoff] ─┘
      ↓ (max retries exceeded)
   [Offline] (show error toast, retry button)
```

### **Exponential Backoff Strategy**

Per AC1 (fixed 3-second retry), the strategy is:
- **First disconnect:** Retry immediately (assume temporary blip)
- **Subsequent disconnects:** 3s, 3s, 3s (fixed per AC1)
- **Max attempts:** 10 retries = ~30 seconds total before showing offline error
- **Recovery:** After successful reconnect, reset counter; return to [Connected] state

**Implementation:**

```typescript
const BACKOFF_DELAYS = [0, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000]; // 10 total attempts
const MAX_RETRIES = BACKOFF_DELAYS.length;

class WebSocketManager {
  private retryCount = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  
  onClose() {
    if (this.retryCount >= MAX_RETRIES) {
      // Show permanent offline error
      showToast("Kitchen system is offline. Click to retry.");
      return;
    }
    
    const delayMs = BACKOFF_DELAYS[this.retryCount];
    this.retryCount++;
    
    this.retryTimer = setTimeout(() => {
      this.connect();
    }, delayMs);
  }
  
  onOpen() {
    // Success: reset counter and fetch full state
    clearTimeout(this.retryTimer);
    this.retryCount = 0;
    this.fetchFullState(); // triggers STATE_SYNC
  }
}
```

### **State Reconciliation on Reconnect**

After reconnection, the frontend **must** fetch the full order state to prevent divergence:

1. **Problem:** Orders may have changed while offline. Frontend cache is stale.
2. **Solution:** On successful reconnect, immediately request STATE_SYNC.
3. **Backend:** Maintain all orders in database; send full snapshot of active orders (exclude very old Completed/Cancelled if needed, per retention policy).
4. **Frontend:** On STATE_SYNC, **replace** entire order map (not merge), then restart dismiss timers.

**Message flow:**
```
Frontend onopen
  ↓ (auto, no user action needed)
Frontend sends: { type: "STATE_SYNC_REQUEST" } (or backend proactively sends on accept)
  ↓
Backend sends: { type: "STATE_SYNC", orders: [...] }
  ↓
Frontend: replaceAllOrders(msg.orders), restart timers
```

**Why replace, not merge?**
- Merge is bug-prone (what if order was deleted server-side? Merge misses it)
- Replace is atomic and guarantees consistency
- Completed/Cancelled orders are removed from state after timer fires anyway, so no "bloat"

---

## Error Recovery Scenarios

### **Scenario 1: Backend Sends Duplicate ORDER_UPDATE**
**Problem:** Network retransmit or race condition causes duplicate message.

**Solution:**
- Backend includes `updatedAt` timestamp
- Frontend: On ORDER_UPDATE, only apply if `msg.updatedAt > order.updatedAt`
- Silently drop stale updates

```typescript
onOrderUpdate(msg: OrderUpdateMessage) {
  const order = this.orders.get(msg.orderId);
  if (order && msg.metadata?.updated_at <= order.updatedAt) {
    return; // stale update, ignore
  }
  // apply update...
}
```

### **Scenario 2: Frontend Offline When Completed Order is Auto-Dismissed**
**Problem:** User's browser disconnects. Backend removes order after 5s. Frontend reconnects later.

**Solution:**
- STATE_SYNC will not include that order (it's already removed server-side)
- Frontend's local timer still runs, but when it fires, `removeOrder()` is idempotent (no error if order doesn't exist)
- No data loss; order state was synced to server before disconnect

### **Scenario 3: User Clicks "Accept" → No CONFIRMATION Arrives**
**Problem:** Network drops after ACTION sent but before CONFIRMATION received. User doesn't know if action succeeded.

**Solution:**
1. Frontend queues ACTION with `requestId` UUID
2. Show loading state on button (disabled)
3. Set timeout (5 seconds) for response
4. If timeout, show toast: "Accept request timed out. Click to retry." + retry button
5. User can click retry (sends new ACTION with new `requestId`)
6. On reconnect, STATE_SYNC will show current server state (if action succeeded, order will be in new status; if it failed, old status)
7. Toast auto-clears once STATE_SYNC resolves the ambiguity

**This handles both:**
- Order successfully transitioned (STATE_SYNC shows new status, toast clears)
- Order still in old status (user can retry)

### **Scenario 4: Frontend Sends ACTION for Order That No Longer Exists**
**Problem:** Order was already transitioned by another kitchen staff member; user clicks "Accept" on stale card.

**Solution:**
- Backend receives ACTION for `orderId` not in database (or in wrong status)
- Sends CONFIRMATION with `success: false, reason: "Order no longer in Received status"`
- Frontend shows toast: "Order was already accepted by another user"
- Close modal
- User will see it disappeared from Received column on next STATE_SYNC or ORDER_UPDATE broadcast

---

## API Contract for Actions

### **Backend Expectations**

When frontend sends ACTION message, backend must:

1. **Validate orderId exists** in current state
2. **Validate action is legal** for current status:
   - Received → ACCEPT or CANCEL only
   - Preparing → READY or CANCEL only
   - Ready → COMPLETE or CANCEL only
   - Completed/Cancelled → no transitions allowed
3. **Persist new state** to database atomically
4. **Broadcast ORDER_UPDATE** to all connected clients (including the one who sent the action)
5. **Send CONFIRMATION** back to requester within 1-2 seconds (per AC3: 200ms visual confirmation)

### **Status Transition State Machine (Backend)**

```
Received ──→ Preparing ──→ Ready ──→ Completed
   ↓            ↓          ↓           ↓
  CANCEL      CANCEL     CANCEL      (no transitions)
   ↓            ↓          ↓
Cancelled ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←

Valid Transitions:
Received + ACCEPT  → Preparing
Received + CANCEL  → Cancelled
Preparing + READY  → Ready
Preparing + CANCEL → Cancelled
Ready + COMPLETE   → Completed
Ready + CANCEL     → Cancelled
Completed + X      → (no action allowed)
Cancelled + X      → (no action allowed)
```

### **Concurrency Handling (Backend)**

Multiple kitchen staff may send conflicting actions (e.g., two "Accept" clicks for same order).

**Approach:**
- Use database row-level lock or optimistic versioning (`version` column)
- First ACTION to commit wins
- Losers receive CONFIRMATION with `success: false, reason: "Order state changed; please refresh"`
- Frontend shows toast; user dismisses modal; next STATE_SYNC/ORDER_UPDATE shows current state

---

## Non-Functional Considerations

### **Performance**

- **Message throughput:** 100–200 new orders/sec → ~200–400 messages/sec (ORDER_NEW + ORDER_UPDATE for status changes)
- **Latency:** Sub-second (200ms target per AC3)
  - Backend commit time: ~50ms (DB write)
  - Broadcast to clients: ~20ms (in-memory queue)
  - Network RTT: ~50–100ms
  - Browser render: ~30ms
  - Total: ~150–200ms ✓
- **DOM updates:** React will batch updates; use key={orderId} on order cards to enable efficient diffing
- **No polling:** WebSocket is push-only; no client-side polling needed

### **Scalability**

- **Concurrent sessions:** 20–50 kitchen staff (small restaurant) → one WebSocket per session
- **Orders in memory:** Assume ~200–500 active orders (Received through Ready) at any time
  - Completed/Cancelled auto-dismissed after 5–10s, don't stay in state
  - Total state size: ~200 orders × ~500 bytes/order = ~100 KB ✓ (trivial)
- **Broadcast:** Backend sends ORDER_UPDATE to all connected clients
  - 100 orders/sec × 50 clients = 5,000 message deliveries/sec
  - With persistent DB + async broadcast queue, easily achievable

### **Security**

1. **Authentication:** Frontend must include auth token in WebSocket handshake (Bearer token in query param or custom header)
   - Backend validates on /ws/orders upgrade
   - Rejects unauthenticated connections at HTTP 401/403 (before WebSocket opens)

2. **Authorization:** Backend validates that `action` requester has permission to modify orders
   - Optional: track `transitioned_by` user ID in ORDER_UPDATE metadata
   - Log all state changes for audit trail

3. **Input validation:** 
   - Frontend validates ACTION message fields (orderId is UUID, action is one of 4 enum values)
   - Backend re-validates (never trust client)
   - Both reject oversized or malformed messages

4. **Rate limiting:** 
   - Per-session: max 10 ACTIONs/second per kitchen staff (prevents spam)
   - Send ERROR (RATE_LIMIT) if exceeded; connection stays open
   - Global: 1,000 total messages/sec across all clients (circuit breaker to prevent DDoS)

5. **Secrets:** 
   - Auth token from environment variable or secure cookie
   - Never log or echo tokens in error messages

### **Reliability**

- **No order loss:** Orders persisted to DB before state change broadcast
- **Idempotent actions:** requestId in ACTION allows backend to deduplicate if ACTION is sent twice
- **Connection drops:** Exponential backoff + STATE_SYNC recovery ensures frontend re-syncs on reconnect
- **Server restarts:** Completed/Cancelled orders auto-removed from state after 5–10s; no data recovery needed

### **Monitoring & Observability**

- **Metrics to track:**
  - WebSocket connections (count, connect/disconnect rate)
  - Messages sent/received per second (throughput)
  - Order latency: time from ORDER_NEW to CONFIRMATION (p50, p95, p99)
  - Error rate (by error code)
  - Reconnection success rate

- **Logs:** 
  - Frontend: connection events, errors, action submissions
  - Backend: action requests, validation failures, state transitions

---

## Implementation Checklist for Dev Team

### **Frontend (React TypeScript)**

- [ ] `hooks/useWebSocket.ts` — WebSocket connection lifecycle, message parsing, reconnect logic
- [ ] `store/orderStore.ts` — Zustand or Context store with normalized state and selectors
- [ ] `components/KanbanBoard.tsx` — 5 columns, order cards, responsive layout
- [ ] `components/OrderModal.tsx` — Order details, action buttons, loading state
- [ ] `hooks/useDismissTimer.ts` — Auto-dismiss timer management for Completed/Cancelled orders
- [ ] `types/index.ts` — TypeScript interfaces (Order, OrderStatus, all message types)
- [ ] Styling: Responsive design (mobile breakpoint ≤600px per UX spec)
- [ ] Error toasts: "Kitchen system offline", "Order already accepted", "Request timed out"

### **Backend (Node.js / Python / Go)**

- [ ] `/ws/orders` WebSocket endpoint
- [ ] Message parsing and routing (by `type` field)
- [ ] Order state store (in-memory or DB-backed)
- [ ] Broadcast logic (send ORDER_UPDATE to all clients)
- [ ] State validation (order exists, action is valid for status)
- [ ] Optimistic locking or versioning (handle concurrent actions)
- [ ] Reconnect handler: send STATE_SYNC with full order list on request
- [ ] Rate limiting (per-session and global)
- [ ] Logging and monitoring hooks

---

## Assumptions & Out of Scope

### **Assumptions**
- Backend is already built (API available)
- Authentication/authorization is handled elsewhere (frontend receives valid token)
- Database schema exists (Orders table with id, status, items, timestamps)
- 20–50 concurrent kitchen staff (not 1,000s)
- Orders are removed from state after 5–10s auto-dismiss (retention handled separately)

### **Out of Scope (Per User Story)**
- Mobile app (responsive web only)
- Printing receipts
- Inventory management
- Customer notifications
- Advanced filtering/search (MVP is kanban only)
- Undo/redo for state transitions
- Multi-location restaurants (single location per KDS instance)

---

## References

- **User Story:** Kitchen Display System (KDS) — MVP Real-time Order Dashboard
- **Design Lead:** Architecture Design Document (this file)
- **Related ADRs:** ADR-001 (WebSocket vs polling), ADR-002 (normalized vs denormalized state), ADR-003 (exponential backoff retry)

