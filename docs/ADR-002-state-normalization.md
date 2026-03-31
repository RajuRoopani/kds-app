# ADR-002: Normalized State with Derived Kanban View

**Status:** Accepted

**Date:** 2024-01-01

---

## Context

The KDS frontend must maintain order state and display it in a kanban board with 5 columns (Received, Preparing, Ready, Completed, Cancelled). We need to decide how to structure the store:

1. **Normalized:** Single `Map<orderId, Order>` with a selector that groups by status on render
2. **Denormalized:** Pre-computed kanban view: `{ Received: [...], Preparing: [...], ... }`

---

## Decision

**Use normalized state with derived selectors.**

---

## Rationale

### **Single Source of Truth**
- One `Map<orderId, Order>` is the authoritative state
- All updates go to the map; derived views are recomputed on each render
- Prevents bugs where normalization and denormalization drift out of sync

### **Efficient Updates**
- ORDER_UPDATE for a single order: O(1) map lookup + update
- No need to remove from old column and add to new column (that's just rendering logic)
- Avoids defensive copying or complex merge logic

### **Reconnection Clarity**
- On STATE_SYNC (reconnect), replace entire map atomically: `store.replaceAllOrders(msg.orders)`
- No need to figure out which orders were deleted, which were added, which moved columns
- Prevents "stuck" orders (cards that don't remove themselves after auto-dismiss timer fires)

### **Testing**
- Store logic can be tested independently (add/update/remove orders)
- Kanban rendering can be tested with mock store data
- No need to maintain two data structures in tests

---

## Consequences

### **Positive**
- Simple store design (one data structure)
- Clear semantics for STATE_SYNC ("replace everything")
- O(1) lookups and updates
- Prevents state divergence bugs

### **Negative**
- Kanban view is computed on every render (not cached)
  - **Mitigation:** React's memo() on column components prevents re-renders if props don't change
  - **Performance:** Filtering 200 orders by status is <1ms; negligible cost

---

## Alternatives Considered

### **Denormalized State (Pre-grouped by Status)**
```typescript
{
  Received: [Order, Order, ...],
  Preparing: [Order, ...],
  Ready: [Order, ...],
  Completed: [Order, ...],
  Cancelled: [Order, ...],
}
```

- **Pros:** Direct rendering; no filtering needed
- **Cons:** 
  - ORDER_UPDATE requires finding and removing from old column, adding to new column (complex)
  - STATE_SYNC requires rebuilding entire structure from flat list (wasteful)
  - Risk of divergence: what if update is applied to one column but not another?
  - Bugs in production: "card appeared in two columns", "card disappeared without dismiss timer"
- **Verdict:** Rejected

### **Cached Derived View (Memoized)**
```typescript
const kanbanView = useMemo(() => {
  return {
    Received: orders.filter(o => o.status === "Received"),
    ...
  }
}, [orders]);
```

- **Pros:** Memoized, so filtering only happens when `orders` changes
- **Cons:** 
  - Still computing derived view; doesn't reduce code complexity
  - Adds useMemo boilerplate without significant perf gain
- **Verdict:** Use computed selectors in store (e.g., `store.getOrdersByStatus()`) instead; cleaner

---

## Implementation Notes

```typescript
// Store (single source of truth)
orders: Map<string, Order>

// Selectors (computed on demand)
getOrdersByStatus(status): Order[] {
  return Array.from(this.orders.values()).filter(o => o.status === status);
}

// Rendering (uses selectors)
const kanbanView = {
  Received: store.getOrdersByStatus("Received"),
  Preparing: store.getOrdersByStatus("Preparing"),
  // ...
};

// Updating (single operation)
store.updateOrderStatus(orderId, "Preparing"); // updates map[orderId].status
// Rendering automatically reflects change (new kanban view on next render)
```

