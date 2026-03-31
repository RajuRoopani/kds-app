# ADR-003: Exponential Backoff with Fixed 3-Second Retry

**Status:** Accepted

**Date:** 2024-01-01

---

## Context

The Kitchen Display System relies on a persistent WebSocket connection. Network disruptions (wifi drop, backend restart, etc.) will cause disconnections. We need a reconnection strategy that:

- Recovers quickly after temporary blips (brownouts, brief wifi reconnect)
- Doesn't hammer the backend with reconnection attempts during longer outages
- Respects AC1 requirement: "Fixed 3-second retry per spec"

---

## Decision

**Implement a hybrid strategy: immediate retry on first disconnect, then fixed 3-second retry intervals for subsequent attempts, up to 10 total retries (~30 seconds).**

---

## Rationale

### **Fast Recovery on Transient Blips**
- First disconnect: retry immediately (0ms delay)
- Most browser wifi/mobile blips recover within 1–2 seconds
- Immediate retry catches these without user noticing

### **Respect AC1 (Fixed 3-Second Retry)**
- Subsequent retries (2–10): 3 seconds each
- Backend stays responsive; not hammered by rapid reconnection attempts
- Predictable behavior (staff knows "system will try again in 3 seconds")

### **Clear Offline State**
- After 10 failed retries (~30 seconds total), show permanent offline error
- User can click "Retry" button to reset counter
- Prevents infinite silent retries that fail

### **Prevents Cascade Failures**
- During backend restart/deployment, kitchen staff see "offline" quickly (within 30s)
- They're informed to wait rather than continuously refreshing
- Once backend is up, one retry succeeds and system recovers

---

## Consequences

### **Positive**
- Fast recovery for transient issues (most common case)
- Controlled backoff respects AC1 spec
- Clear user feedback after 30s (offline error, not silent hanging)
- Easy to tune (change BACKOFF_DELAYS array)

### **Negative**
- 30-second outage visibility (during deployment or network issue)
- User might miss orders during that window
  - **Mitigation:** STATE_SYNC on reconnect re-syncs all orders; no data loss

---

## Alternatives Considered

### **Immediate Retry Forever**
```
[Disconnect] → retry immediately → [Disconnect] → retry immediately → ...
```

- **Cons:** 
  - Hammers backend during outages
  - No backoff; can contribute to cascade failures
  - Backend sees 100+ reconnection attempts/sec from single client
- **Verdict:** Rejected (violates best practices)

### **Exponential Backoff Only (No Immediate Retry)**
```
[Disconnect] → wait 1s → [Disconnect] → wait 2s → [Disconnect] → wait 4s → ...
```

- **Cons:** 
  - Slow recovery on transient blips (user waits 1s+ for something that could recover immediately)
  - Kitchen staff notice: every wifi blip = 1s+ of stale orders
- **Verdict:** Rejected (poor UX for common case)

### **Fixed Interval (3s from Start)**
```
[Disconnect] → wait 3s → [Disconnect] → wait 3s → [Disconnect] → wait 3s → ...
```

- **Pros:** Simple, matches AC1
- **Cons:** 
  - Slow recovery on transient blips (3s every time)
  - Kitchen staff might think "system is laggy" if every tiny wifi glitch adds 3s
- **Verdict:** Hybrid (immediate + fixed) is better

---

## Implementation

```typescript
const BACKOFF_DELAYS = [0, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000]; // 10 attempts
const MAX_RETRIES = BACKOFF_DELAYS.length;

class WebSocketManager {
  private retryCount = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  
  private onClose(event: CloseEvent) {
    if (this.retryCount >= MAX_RETRIES) {
      // Offline: show permanent error
      this.setStatus("offline");
      showToast("Kitchen system offline. Click to reconnect.", "error");
      return;
    }
    
    const delayMs = BACKOFF_DELAYS[this.retryCount];
    this.retryCount++;
    
    this.setStatus("reconnecting");
    
    if (delayMs === 0) {
      // Immediate retry
      this.connect();
    } else {
      // Delayed retry
      this.retryTimer = setTimeout(() => {
        this.connect();
      }, delayMs);
    }
  }
  
  private onOpen(event: Event) {
    // Success: reset retry counter and sync state
    clearTimeout(this.retryTimer!);
    this.retryCount = 0;
    this.setStatus("connected");
    
    // Immediately fetch full state to prevent divergence
    this.fetchFullState();
  }
  
  public manualRetry() {
    // User clicked "Retry" button
    clearTimeout(this.retryTimer!);
    this.retryCount = 0;
    this.connect();
  }
}
```

---

## Monitoring

Track:
- Reconnection attempts per session (sum of retries)
- Time to recovery (from disconnect to next successful open)
- Retry success rate (% of retries that succeed vs fail)

Use these metrics to tune BACKOFF_DELAYS if needed. Current strategy targets:
- p50 recovery: ~0ms (transient blips recover immediately)
- p95 recovery: ~30s (longer outages show error within 30s)

