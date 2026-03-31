# ADR-005: Hybrid WebSocket Testing Strategy (Jest Mocks + Mock Backend)

**Status:** Accepted
**Date:** 2025 (Phase 2 Launch)
**Architect Decision:** Both Option A (Jest mocks) AND Option B (mock backend integration tests)

---

## Context

Phase 2 WebSocket client testing faced a trade-off:
- **Option A (Jest mocks only):** Fast, no server dependency, but doesn't test real browser WebSocket API behavior
- **Option B (real backend):** Slow, requires environment setup, blocks team

The team needed a testing strategy that:
1. Unblocks parallel development (no server dependency during unit test phase)
2. Validates the WebSocket contract end-to-end (catches timing bugs, real API behavior)
3. Launches Phase 2 this week without delay

---

## Decision

**Use a dual testing approach: Jest mocks for unit tests + mock backend for integration tests.**

### Unit Tests (Jest Mocks) — Fast, Parallel-Dev Unblocked

**File:** `src/__tests__/ws-client.test.ts`

Jest mocks test JavaScript logic without any server:
- Message parsing and validation
- Error handling (malformed JSON, missing fields, invalid types)
- Event pub/sub deduplication and routing
- Reconnect backoff logic (timing, attempt count, state)
- Store mutation logic (upsert, update, remove)

**No server dependency.** Runs in CI instantly. Junior devs can write component tests in parallel.

### Integration Tests (Mock Backend) — Real, Contract-Validated

**File:** `src/__tests__/ws-client.integration.test.ts`
**Backend:** `/kds-mock-backend/server.js`

Real WebSocket integration tests validate:
- Browser WebSocket API lifecycle (onopen, onmessage, onclose, onerror)
- Connection state machine (connecting → connected → reconnecting → connected)
- Reconnection timing (0ms first retry, 3s backoff per AC1)
- Message delivery and parsing on real WebSocket frames
- STATE_SYNC atomicity on reconnect
- Full order lifecycle (NEW → UPDATE → Completed → auto-dismiss)

**Requires mock backend running.** Unblocks contract validation without blocking component shipping.

---

## Comparison Table

| Aspect | Jest Mocks | Mock Backend |
|--------|------------|--------------|
| **Speed** | ⚡ <100ms per suite | ⚠️ 2-5s per test (network delays) |
| **CI Dependency** | None | Requires `kds-mock-backend` deployed |
| **Tests browser API?** | ❌ No | ✅ Yes |
| **Tests connection lifecycle?** | ❌ No (instant callbacks) | ✅ Yes (real async) |
| **Unblocks parallel dev?** | ✅ Yes | ❌ (requires setup) |
| **Catches timing bugs?** | ❌ No | ✅ Yes |
| **Cost** | Low | Medium (3-4 hrs already invested) |

---

## Implementation

### sr_dev_1 (WebSocket Client Tests)

1. **Unit tests (Jest mocks)** — Continue expanding `ws-client.test.ts`:
   - Edge cases for message parsing
   - Malformed message recovery
   - Duplicate message detection
   - Error callback routing
   - Reconnect backoff sequences

2. **Integration tests (mock backend)** — Keep `ws-client.integration.test.ts` as-is:
   - Run locally before PR (requires `cd kds-mock-backend && npm start`)
   - Optional in CI (requires mock backend deployment)
   - Validates contract without production risk

### junior_dev_1 (React Components)

- Start component unit tests using Jest mocks immediately (don't wait for sr_dev_2's layout)
- Mock `useWebSocket()` hook using same pattern as existing tests
- Full parallel development unblocked

### Phase 2 Acceptance Criteria

- ✅ Jest test suite passes in CI (no server dependency)
- ✅ Integration tests pass locally (manual run with mock backend)
- ✅ All 7 AC validated via manual testing + Jest coverage
- ✅ Mock backend can be swapped for real backend with zero code changes

---

## Rationale

### Why Not Jest Mocks Only?

Jest mocks test JavaScript logic but fail to catch:
- **Browser WebSocket API timing issues** — Instant callbacks in tests don't reflect real network delays
- **Reconnection state machine bugs** — Race conditions between reconnect timers and incoming messages
- **Message delivery guarantees** — Real WebSocket behavior (duplicate frames, out-of-order, partial frames)
- **Contract divergence** — If backend message schema changes, jest mocks won't catch it

**Consequence:** Ship with hidden integration bugs that appear in production (disconnects don't reconnect, state sync loses orders).

### Why Not Real Backend?

A real backend dependency (even "staging") blocks the team:
- **Setup friction** — Need credentials, environment config, VPN access
- **Timing dependency** — Backend unavailability blocks all FE work
- **Slow feedback loop** — 10-15 second tests per suite change
- **Not production-like anyway** — Staging backend != KDS kitchen traffic

**Consequence:** Junior devs wait for sr_dev_1, sr_dev_2 waits for backend team, launch slips by 2+ weeks.

### Why Hybrid Approach?

**Jest mocks** unblock parallel development and enable fast CI.
**Mock backend** validates contract and catches integration bugs.

Together, they provide:
1. **Fast feedback** (Jest in <100ms)
2. **Real validation** (mock backend integration tests)
3. **No blocking dependencies** (both tests can run independently)
4. **Safe contract evolution** (mock backend forces exact schema match)

---

## Migration Path: To Real Backend

When KDS real backend is ready, **zero code changes needed:**

```javascript
// Just change the URL in integration tests
const BACKEND_URL = process.env.WS_URL || 'ws://localhost:5000/orders';

// Same test suite; same contract; zero logic changes
describe('WebSocket Client Integration Tests', () => {
  // All 15 tests pass against real backend with no modifications
});
```

The mock backend enforces the contract so strictly that real backend integration is seamless.

---

## Consequences

### Positive
- ✅ Unblocks 3 devs immediately (no server setup)
- ✅ Jest tests run in CI in seconds
- ✅ Integration tests validate contract end-to-end
- ✅ Phase 2 launches on schedule (this week)
- ✅ Zero rework when real backend arrives

### Tradeoffs
- ⚠️ Integration tests require mock backend running (manual test step)
- ⚠️ CI won't run full integration suite (requires deployment setup)
- ⚠️ Two test files to maintain (mock logic + integration scenarios)

**Assessment:** Tradeoffs are acceptable. The 2-3 hours managing two test suites is trivial compared to the 2+ weeks saved by unblocking the team.

---

## References

- **ADR-004:** Mock WebSocket Backend (why we built it)
- **TESTING-GUIDE.md:** Full test running instructions
- **ws-client.test.ts:** Jest mock examples
- **ws-client.integration.test.ts:** Real backend integration examples
