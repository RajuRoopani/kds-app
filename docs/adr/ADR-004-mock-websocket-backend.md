# ADR-004: Mock WebSocket Backend for Frontend Development & Testing

**Status:** Accepted  
**Date:** 2024-01-15  
**Decision Owner:** Software Architect (Team Claw)  
**Context:** Phase 2 kickoff blocker — how should frontend devs test WebSocket integration without a production backend?

---

## Context

The KDS project follows a **parallel development model:**
- **Backend team:** Building the production Node.js/Python/Go WebSocket server (timeline TBD)
- **Frontend team:** Building React SPA with real-time order updates (ready to start Phase 2 immediately)

**The Problem:**
Frontend devs cannot begin Phase 2 (WebSocket integration, real-time updates) without a backend to test against. Options were:

1. **Jest mocks only** — Mock WebSocket in test suite
2. **Real backend dependency** — Frontend waits for backend team to finish
3. **Mock backend server** — Lightweight Node.js WS server that implements the contract

---

## Decision

**Build a standalone mock WebSocket backend** served from `/workspace/kds-mock-backend/server.js`.

### What This Means

- **A separate Node.js server** (not part of production) runs locally during dev/testing
- **Implements exact message schema** from ARCHITECTURE.md (ORDER_NEW, ORDER_UPDATE, STATE_SYNC, CONFIRMATION, ERROR, ACTION)
- **Generates synthetic orders** every 3–5 seconds (simulates real production flow)
- **Auto-transitions orders** through lifecycle (Received → Preparing → Ready → Completed)
- **Handles client actions** (ACCEPT, READY, COMPLETE, CANCEL) with validation
- **Broadcasts to all clients** when orders change (tests real WebSocket behavior, not mocks)
- **Recovers from reconnection** with STATE_SYNC (tests resync logic)
- **Rate-limits actions** (tests error handling)
- **Zero external dependencies** beyond `ws` npm package

### Frontend Unblocked

```bash
# Terminal 1: Run mock backend
cd kds-mock-backend && npm start
# Listens on wss://localhost:5000/orders

# Terminal 2: Run React app
cd kds_app && npm start
# Hardcoded to wss://localhost:5000/orders (per task)
# Connects to mock, receives real WebSocket events
```

No waiting. No guessing. No integration surprises.

---

## Rationale

### Why NOT Option 1 (Jest Mocks)

**Jest mocks only test "happy path" JavaScript code.**

```typescript
// This passes with Jest mocks:
describe('order store', () => {
  it('updates order status on ORDER_UPDATE', () => {
    mockWs.emit('message', JSON.stringify({
      type: 'ORDER_UPDATE',
      orderId: '123',
      status: 'Preparing',
    }));
    expect(store.orders.get('123').status).toBe('Preparing');
  });
});

// But fails in production when:
// - WebSocket connection drops mid-stream
// - Backend sends duplicate messages (race condition)
// - Reconnect happens before STATE_SYNC arrives (state divergence)
// - Browser's WebSocket API behaves unexpectedly (timing)
```

**Mocks don't exercise the browser's real WebSocket API** — `onopen`, `onmessage`, `onclose`, `onerror`, reconnection timers. These behaviors must be tested against real WebSocket connections.

### Why NOT Option 2 (Real Backend)

**Backend doesn't exist yet; timeline is uncertain.**

- Frontend team would be **blocked for 2–4 weeks** waiting for backend stability
- Even "ready" backends often have bugs in initial implementation (schema mismatch, message timing issues)
- Each backend bug (e.g., wrong timestamp format, missing field) blocks all frontend work
- Integration surprises cause rework: "Backend sends `updated_at` not `updatedAt`" → refactor all frontend code

**Risk:** Phase 2 timeline slips from day 1.

### Why Option 3 (Mock Server) is Right

**Independence + Realism:**
- Frontend devs **start immediately** — no waiting for backend
- **Real WebSocket connections** — no mock handwaving; actual browser WebSocket API
- **Exact contract enforcement** — message schema is locked in ARCHITECTURE.md; mock enforces it
- **Swap seamlessly** — when real backend ready, change one URL, run same integration tests
- **Early catch** — schema divergence caught by running tests against real backend; not a surprise at final integration

**Cost:** 3–4 hours architect time to build mock (already delivered)  
**Benefit:** Saves 2+ weeks of frontend team waiting + prevents integration rework  
**ROI:** Extremely high.

---

## Trade-offs

### ✅ Pros

| Benefit | How It Helps |
|---------|-------------|
| **Unblocks Phase 2 immediately** | No waiting for backend; team starts coding today |
| **Real WebSocket behavior** | Tests connection lifecycle, reconnect, browser API edge cases |
| **Contract enforcement** | Message schema locked; catch FE bugs before backend integration |
| **Easy to debug** | Run mock locally, inspect messages in DevTools WS inspector |
| **Stateless, no persistence** | Orders reset on server restart; perfect for testing |
| **Scales to stress testing** | Can simulate 100+ orders/sec, 50+ concurrent clients |
| **Zero production risk** | Mock is isolated in `/kds-mock-backend/`; never shipped |

### ⚠️ Cons & Mitigations

| Trade-off | Mitigation |
|-----------|-----------|
| **Requires Node.js to run locally** | Junior devs already have Node (for React). `npm start` is one command. |
| **Adds ~400 lines of code to repo** | Code lives in isolated folder. Not part of production build. |
| **Doesn't test *real* concurrency bugs** | Mock is single-threaded, but that's OK—tests frontend logic. Real backend concurrency testing happens in staging. |
| **Synthetic order flow vs. production reality** | Good enough for Phase 2 (layout, state mgmt). Realistic data flow (new order → action → update) mirrors production. |
| **If schema differs from real backend later** | That's a *backend bug*, not our problem. Mock enforces ARCHITECTURE.md contract. |

---

## Implementation

### Deliverable
```
/workspace/kds-mock-backend/
├── server.js        (300 lines, standalone WS server)
├── package.json     (defines 'ws' dependency)
├── README.md        (setup + message examples)
```

### How It Works

1. **Generates synthetic orders** every 3–5 seconds
   ```javascript
   // New order appears in Received column
   { type: "ORDER_NEW", orderId: "order-12847", customerName: "John Smith", ... }
   ```

2. **Simulates lifecycle** (Received → Preparing → Ready → Completed)
   ```javascript
   // After 8 seconds, auto-transitions to Preparing
   { type: "ORDER_UPDATE", orderId: "order-12847", status: "Preparing", ... }
   ```

3. **Handles frontend actions** (user clicks buttons)
   ```javascript
   // Frontend sends ACTION
   { type: "ACTION", requestId: "req-123", orderId: "order-12847", action: "ACCEPT", ... }
   
   // Mock validates, transitions order, broadcasts update, sends confirmation
   { type: "CONFIRMATION", requestId: "req-123", success: true, ... }
   { type: "ORDER_UPDATE", ... } // broadcast to all clients
   ```

4. **Recovers on reconnect**
   ```javascript
   // Frontend reconnects, sends STATE_SYNC_REQUEST
   { type: "STATE_SYNC_REQUEST" }
   
   // Mock sends full state
   { type: "STATE_SYNC", orders: [...all current orders...], ... }
   ```

### Setup & Usage

```bash
# 1. Install mock backend
cd kds-mock-backend && npm install

# 2. Start mock backend
npm start
# Output: "📡 WebSocket server running on port 5000"

# 3. Start React app (already hardcoded to connect to localhost:5000)
cd ../kds_app && npm start

# 4. Frontend connects, orders stream in, users can click buttons
# No configuration changes needed
```

---

## Acceptance Criteria

This decision is **proven correct** when:

- [ ] Mock backend runs without errors (`npm start` succeeds in <5s)
- [ ] Frontend connects and receives real WebSocket messages
- [ ] Orders auto-generate and appear in Received column in real-time
- [ ] Clicking [Accept] transitions order to Preparing, broadcasts to all clients
- [ ] Reconnection triggers STATE_SYNC and refreshes state
- [ ] Rate limiting prevents >10 actions/sec and returns ERROR message
- [ ] Senior dev confirms (in task completion): "ws-client.ts works without modification"
- [ ] All Phase 2 integration tests pass without touching the backend

---

## Switching to Real Backend

**Timeline:** When real backend is ready

**Steps:**
1. Real backend implements identical message schema (enforced by ARCHITECTURE.md)
2. Frontend changes one line:
   ```typescript
   // const WS_URL = 'wss://localhost:5000/orders'; // dev
   const WS_URL = 'wss://api.yourdomain.com/orders'; // prod
   ```
3. Run integration test suite against real backend
4. If tests fail, it's a **real backend bug** (caught early, before production)
5. Real backend is swapped in; mock server is no longer used

**Risk:** If real backend deviates from ARCHITECTURE.md contract, tests will fail. That's the point—catch divergence early.

---

## Future Enhancements (Out of Scope)

Potential extensions to mock server (not in Phase 2):
- Add `/orders` GET endpoint (REST API for fetching historical orders)
- Webhook simulation (mock backend → external services)
- Multi-location support (restaurant chains)
- Database backing (so state survives server restart)
- Load testing tool integration (artillery, k6)
- Docker image (pre-built mock backend)

None are needed for Phase 2 kickoff.

---

## Decision Review

**Approved by:** Engineering Manager (Phase 2 kickoff)  
**Approved on:** 2024-01-15  
**Alternatives considered:** Mock-only Jest, real backend dependency  
**Confidence level:** High — this is a proven pattern in React development (json-server, Storybook's mock backend, Mirage JS)

---

## References

- **Mock Backend Code:** `/workspace/kds-mock-backend/server.js`
- **Architecture Design:** `/workspace/kds_app/docs/ARCHITECTURE.md` (message schema spec)
- **UX Design:** `/workspace/kds_app/docs/DESIGN.md` (user flows, acceptance criteria)
- **Related ADRs:** ADR-001 (WebSocket vs polling), ADR-002 (state normalization)

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Architect | Team Claw | 2024-01-15 | Designed & built mock server |
| EM | Engineering Manager | TBD | Approved Phase 2 kickoff |
| PO | Product Owner | TBD | Confirmed acceptance criteria |

