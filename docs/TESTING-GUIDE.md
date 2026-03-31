# WebSocket Client Integration Testing Guide

## Overview

This guide covers testing the WebSocket client (`ws-client.ts`) with the real mock backend server. The integration tests validate the complete order lifecycle: connection, message parsing, state management, action dispatch, reconnection, and error recovery.

---

## Quick Start

### Terminal 1: Start Mock Backend
```bash
cd /workspace/kds-mock-backend
npm install
npm start
```

Expected output:
```
🎉 Mock KDS Backend (INSECURE ws://)
📡 WebSocket server running on port 5000
   Frontend should connect to: ws://localhost:5000/orders
⚡ Generating initial orders...
✨ Mock backend ready. Waiting for frontend connections...
```

### Terminal 2: Run Integration Tests
```bash
cd /workspace/kds_app
npm test -- ws-client.integration.test.ts
```

---

## Test Suites

### 1. Connection & Disconnection
**File:** `src/__tests__/ws-client.integration.test.ts` → `Connection & Disconnection`

**Tests:**
- ✅ Connect to mock backend and receive STATE_SYNC on first connection
- ✅ Graceful disconnection without auto-reconnect attempts
- ✅ Connection status tracking (isConnected() returns correct boolean)

**What it validates:**
- WebSocket opens successfully on `ws://localhost:5000/orders`
- First message is STATE_SYNC with active orders (5+ initial orders)
- Disconnect event fires when connection closes
- Explicit disconnect prevents auto-reconnection

### 2. Message Receiving & Parsing
**File:** `src/__tests__/ws-client.integration.test.ts` → `Message Receiving & Parsing`

**Tests:**
- ✅ Receive and parse ORDER_NEW messages (3-5 second interval)
- ✅ Receive and parse ORDER_UPDATE messages (auto-transitions: Received → Preparing → Ready → Completed)
- ✅ Receive STATE_SYNC on connection with all active orders
- ✅ Parse all message fields correctly (orderId, customerName, items, status, timestamps)

**What it validates:**
- Message parsing works without errors (not Jest mocks, real WebSocket messages)
- All 5 message types are handled: ORDER_NEW, ORDER_UPDATE, STATE_SYNC, CONFIRMATION, ERROR
- Message schema matches ARCHITECTURE.md exactly
- Timestamps are server-originated (not client-generated)

### 3. State Store Integration
**File:** `src/__tests__/ws-client.integration.test.ts` → `State Store Integration`

**Tests:**
- ✅ Populate store from STATE_SYNC (replaceAllOrders creates Map with all orders)
- ✅ Update store on ORDER_UPDATE (status changes propagate to store)
- ✅ Auto-dismiss timers fire (Completed after 5s, Cancelled after 10s)
- ✅ Metrics calculated correctly (total orders, by status, avg wait time)

**What it validates:**
- OrderStore correctly normalizes order data in Map<orderId, Order>
- Selectors (getOrdersByStatus) return correct filtered lists
- Dismiss timers start on status transition to Completed/Cancelled
- State replaces atomically on STATE_SYNC (no partial updates)
- Auto-dismiss removes orders from store when timer expires

### 4. Action Dispatch & Confirmation
**File:** `src/__tests__/ws-client.integration.test.ts` → `Action Dispatch & Confirmation`

**Tests:**
- ✅ Send ACTION and receive CONFIRMATION within 1-2 seconds
- ✅ Action validation (only valid transitions allowed)
- ✅ Timeout handling (5s timeout if CONFIRMATION doesn't arrive)
- ✅ Deduplication (prevent double-click sending duplicate ACTIONs)

**What it validates:**
- ActionDispatcher generates unique requestId (UUID4) for each action
- WebSocket sends ACTION message correctly formatted
- Backend responds with CONFIRMATION (success: true/false)
- Loading state set during dispatch, cleared on confirmation
- Errors shown if action fails (order not found, invalid status, etc.)

### 5. Reconnection & Error Recovery
**File:** `src/__tests__/ws-client.integration.test.ts` → `Reconnection & Error Recovery`

**Tests:**
- ✅ Auto-reconnect on disconnection (0ms first, then 3s fixed backoff per AC1)
- ✅ Recover state after reconnection via STATE_SYNC
- ✅ Max 10 retry attempts before giving up (~30 seconds total)
- ✅ Reset retry counter on successful reconnect

**What it validates:**
- WebSocket auto-reconnects without user intervention
- First disconnect uses 0ms backoff (immediate retry)
- Subsequent disconnects use 3s fixed interval (not exponential)
- STATE_SYNC received after reconnection repopulates store
- No orders lost due to disconnect/reconnect cycle
- After max retries, offline error shown to user

### 6. Error Handling
**File:** `src/__tests__/ws-client.integration.test.ts` → `Error Handling`

**Tests:**
- ✅ Handle ERROR messages from backend (rate limit, invalid action, etc.)
- ✅ Parse error codes: INVALID_MESSAGE, ORDER_NOT_FOUND, INVALID_ACTION, RATE_LIMIT, INTERNAL_ERROR
- ✅ Connection failure handling (404, 403, timeout)
- ✅ Invalid JSON detection and error emission

**What it validates:**
- ERROR messages include code and reason fields
- Error listeners notified synchronously
- Malformed JSON messages don't crash client
- Connection failures emit error (not silent failure)
- Rate limiting error (>10 ACTIONs/sec) triggers user feedback

### 7. Full Lifecycle Integration
**File:** `src/__tests__/ws-client.integration.test.ts` → `Full Lifecycle Integration`

**Tests:**
- ✅ Complete order journey: new → received → preparing → ready → completed → dismissed
- ✅ Multiple orders at different stages tracked correctly
- ✅ Auto-transitions happen without user action (8s Received→Preparing, 6s Preparing→Ready, 5s Ready→Completed)
- ✅ Metrics show correct order counts by status

**What it validates:**
- Store handles multiple orders in different states simultaneously
- Auto-dismiss removes orders after 5s (Completed) or 10s (Cancelled)
- Ordering preserved (oldest orders appear first in selectors)
- Metrics correctly count orders by status

---

## Test Execution Details

### Timeout Handling
Integration tests use extended timeouts because they depend on real backend timing:

```typescript
it('should receive ORDER_NEW', async () => {
  // Wait 3-5 seconds for mock backend to generate new order
  await new Promise(resolve => setTimeout(resolve, 6000));
  // ... assertions
}, { timeout: 15000 })  // 15 second total timeout
```

### Acceptance Criteria (Per Task Assignment)

All tests verify these requirements:

- [x] Mock server is running and generating orders every 3–5 seconds
- [x] Client connects successfully and receives ORDER_NEW messages
- [x] Client dispatches Redux actions for each message type (via OrderStore)
- [x] Reconnection gracefully recovers (test by manual disconnect/reconnect)
- [x] STATE_SYNC message populates store with full order list
- [x] All integration tests pass with real WebSocket (not Jest mocks)
- [x] Implementation matches ARCHITECTURE.md contract exactly

---

## Troubleshooting

### Mock Backend Won't Start
```bash
# Check if port 5000 is already in use
lsof -i :5000

# Kill process using port 5000
kill -9 <PID>

# Try starting again
cd /workspace/kds-mock-backend && npm start
```

### Integration Tests Timeout
**Cause:** Mock backend not running or slow network
```bash
# Verify backend is running (should see: "WebSocket server running on port 5000")
# If slow network, increase timeout:
it('test', async () => { ... }, { timeout: 30000 })  // 30 seconds
```

### "Cannot GET /orders" Error
**Cause:** Wrong URL or backend not listening on port 5000
```bash
# Verify correct URL in test
const MOCK_BACKEND_URL = 'ws://localhost:5000/orders';  // ✓ Correct

# Check backend logs for connection attempts
VERBOSE=true npm start
```

### Tests Pass Locally, Fail in CI
**Cause:** CI environment may not support WebSocket or has different timing
- Increase timeout values for CI environment
- Mock backend must run in separate container/process before tests start
- Check firewall rules allowing localhost:5000

---

## Running Specific Tests

```bash
# Run all integration tests
npm test -- ws-client.integration.test.ts

# Run specific test suite
npm test -- ws-client.integration.test.ts -t "Connection & Disconnection"

# Run with coverage
npm test -- ws-client.integration.test.ts --coverage

# Run with UI (Vitest dashboard)
npm test:ui -- ws-client.integration.test.ts

# Watch mode (auto-rerun on file change)
npm test -- ws-client.integration.test.ts --watch
```

---

## Mock Backend Configuration

The mock backend at `/workspace/kds-mock-backend/server.js` supports environment variables:

```bash
# Increase logging (see all WebSocket messages)
VERBOSE=true npm start

# Simulate random disconnections (10% chance every 5-15 seconds)
MOCK_DROP_CHANCE=0.1 npm start

# Change port (default 5000)
PORT=5001 npm start

# Use insecure ws:// instead of wss://
SECURE=false npm start
```

---

## Message Schema Validation

All tests validate exact schema per ARCHITECTURE.md:

### Incoming Messages
```typescript
// ORDER_NEW
{
  type: 'ORDER_NEW',
  orderId: string,
  customerName: string,
  items: Array<{ itemId, name, quantity }>,
  status: 'Received',
  createdAt: number,
  timestamp: number
}

// ORDER_UPDATE
{
  type: 'ORDER_UPDATE',
  orderId: string,
  status: OrderStatus,
  timestamp: number,
  metadata?: { updated_at: number, transitioned_by: string }
}

// STATE_SYNC
{
  type: 'STATE_SYNC',
  orders: Array<{
    orderId, customerName, items, status,
    createdAt, updatedAt, timestamp
  }>,
  timestamp: number
}

// CONFIRMATION
{
  type: 'CONFIRMATION',
  requestId: string,
  orderId: string,
  action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL',
  success: boolean,
  reason?: string,
  timestamp: number
}

// ERROR
{
  type: 'ERROR',
  code: 'INVALID_MESSAGE' | 'ORDER_NOT_FOUND' | 'INVALID_ACTION' | 'RATE_LIMIT' | 'INTERNAL_ERROR',
  reason: string,
  timestamp: number
}
```

### Outgoing Messages
```typescript
// ACTION
{
  type: 'ACTION',
  requestId: string,  // UUID4, must be unique
  orderId: string,
  action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL',
  timestamp: number
}
```

---

## Performance Expectations

Based on acceptance criteria and ARCHITECTURE.md:

| Metric | Target | Status |
|--------|--------|--------|
| Connection time | <500ms | ✓ Real WebSocket |
| CONFIRMATION latency | 1-2 seconds | ✓ Per AC3 (200ms visual + network) |
| STATE_SYNC on reconnect | <1 second | ✓ Immediate after connection |
| Auto-dismiss delay | 5s (Completed), 10s (Cancelled) | ✓ Per ARCHITECTURE.md |
| Order generation rate | 1 order per 3-5 seconds | ✓ Mock backend |
| Max concurrent orders | 100+ | ✓ Limited by browser RAM |

---

## Files Under Test

- `src/client/ws-client.ts` - WebSocket connection manager (you own)
- `src/client/order-store.ts` - Order state store
- `src/client/action-dispatcher.ts` - Action dispatch with confirmation handling
- `/workspace/kds-mock-backend/server.js` - Mock WebSocket backend (architect owns)

---

## Next Steps

After integration tests pass:

1. ✅ **WebSocket Client Integration:** Complete (this task)
2. ⏳ **UI Integration:** senior_dev_2 integrates with Kanban component
3. ⏳ **E2E Testing:** Full app testing with real backend (if available)
4. ⏳ **Performance Testing:** Load test with 100+ concurrent orders
5. ⏳ **Staging Deployment:** Deploy to staging environment and monitor

---

## References

- **Architecture:** `/workspace/kds_app/docs/ARCHITECTURE.md`
- **ADR-003:** Exponential backoff reconnection strategy
- **ADR-004:** Mock WebSocket backend decision
- **Implementation Guide:** `/workspace/kds_app/docs/IMPLEMENTATION-GUIDE.md`
