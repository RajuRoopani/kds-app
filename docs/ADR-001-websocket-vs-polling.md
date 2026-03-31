# ADR-001: WebSocket vs. Polling for Real-time Order Updates

**Status:** Accepted

**Date:** 2024-01-01

---

## Context

The Kitchen Display System requires real-time order updates with sub-second latency (200ms visual confirmation per AC3) at 100–200 orders/sec throughput. We need to decide between two transport mechanisms:

1. **WebSocket:** Persistent bidirectional connection; server pushes updates; frontend sends actions (Accept, Ready, etc.)
2. **Polling:** Frontend periodically fetches full order state via REST (e.g., every 500ms)

---

## Decision

**Use WebSocket.**

---

## Rationale

### **Performance**
- **WebSocket:** ~50–100ms latency per message (one network hop, no polling interval overhead)
- **Polling every 500ms:** ~250–500ms latency (poll interval wait + request RTT)
- **Polling every 100ms:** Approaches WebSocket latency but creates 10x more HTTP overhead

For 100–200 new orders/sec, WebSocket reduces server load by eliminating redundant polling requests:
- Polling: 50 clients × 10 polls/sec = 500 REST requests/sec
- WebSocket: 50 clients × ~2–4 broadcasts/sec (only on actual order changes) = broadcast-only model

### **Scalability**
- **WebSocket:** Persistent connection per client; efficient for long-lived sessions (8–12 hour kitchen shifts)
- **Polling:** HTTP connections are stateless; each poll is independent; more server resource per active session

### **Bidirectionality**
- **WebSocket:** Frontend easily sends ACCEPT/READY/COMPLETE actions; backend responds with CONFIRMATION
- **Polling:** Would require separate HTTP POST endpoints for actions; two separate transport channels (REST for actions, polling for updates)

### **User Experience**
- **WebSocket:** Immediate visual feedback (order appears in column instantly on ORDER_NEW)
- **Polling:** Orders appear after next poll cycle (up to 500ms delay visible to user)

---

## Consequences

### **Positive**
- Sub-second latency achieved ✓
- Single transport for both updates (push) and actions (bidirectional messaging)
- Lower server load and network bandwidth
- Handles high throughput (200 orders/sec) naturally

### **Negative**
- Requires WebSocket server infrastructure (most backend frameworks support this)
- Reconnection logic needed (if network drops)
- Must manage per-connection state on backend (more memory per session)
- Firewalls/proxies may block WebSocket (rare, but enterprise networks sometimes do)

---

## Alternatives Considered

### **Server-Sent Events (SSE)**
- **Pros:** Simpler than WebSocket for unidirectional server → client
- **Cons:** Frontend would still need separate HTTP POST for actions (two transport channels)
- **Verdict:** Chosen WebSocket instead for bidirectional efficiency

### **REST Polling**
- **Pros:** Simple to implement; no persistent state on server
- **Cons:** Latency (250–500ms) and throughput issues at 100–200 orders/sec
- **Verdict:** Rejected due to latency requirement (AC3: 200ms confirmation)

---

## Implementation Notes

- Backend must handle concurrent WebSocket connections (sticky sessions if load-balanced)
- Frontend must implement exponential backoff reconnection (per AC1)
- Both frontend and backend must validate/parse messages (defense in depth)

