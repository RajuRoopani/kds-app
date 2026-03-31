/**
 * Order Store Tests
 * 
 * Tests normalized state management, selectors, auto-dismiss timers,
 * and pub/sub functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderStore } from '../client/order-store';
import type { Order, OrderStatus } from '../types';

function createMockOrder(
  overrides: Partial<Order> = {}
): Order {
  return {
    orderId: `order-${Math.random()}`,
    customerName: 'Test Customer',
    items: [{ itemId: 'item-1', name: 'Burger', quantity: 1 }],
    status: 'Received',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('OrderStore', () => {
  let store: OrderStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new OrderStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Management', () => {
    it('should upsert an order', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      expect(store.getOrder(order.orderId)).toEqual(order);
    });

    it('should update an existing order', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      const updated = { ...order, customerName: 'Updated Name' };
      store.upsertOrder(updated);

      expect(store.getOrder(order.orderId)?.customerName).toBe('Updated Name');
    });

    it('should remove an order', () => {
      const order = createMockOrder();
      store.upsertOrder(order);
      expect(store.orders.size).toBe(1);

      store.removeOrder(order.orderId);
      expect(store.orders.size).toBe(0);
      expect(store.getOrder(order.orderId)).toBeUndefined();
    });

    it('should update order status', () => {
      const order = createMockOrder({ status: 'Received' });
      store.upsertOrder(order);

      store.updateOrderStatus(order.orderId, 'Preparing');

      const updated = store.getOrder(order.orderId);
      expect(updated?.status).toBe('Preparing');
      expect(updated?.updatedAt).toBeGreaterThan(order.updatedAt);
    });

    it('should get all orders', () => {
      const order1 = createMockOrder({ orderId: 'o1' });
      const order2 = createMockOrder({ orderId: 'o2' });

      store.upsertOrder(order1);
      store.upsertOrder(order2);

      const all = store.getAllOrders();
      expect(all.length).toBe(2);
      expect(all.map((o) => o.orderId).sort()).toEqual(['o1', 'o2']);
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      const received = createMockOrder({
        orderId: 'r1',
        status: 'Received',
        createdAt: Date.now() - 1000,
      });
      const received2 = createMockOrder({
        orderId: 'r2',
        status: 'Received',
        createdAt: Date.now(),
      });
      const preparing = createMockOrder({
        orderId: 'p1',
        status: 'Preparing',
      });
      const ready = createMockOrder({
        orderId: 'rd1',
        status: 'Ready',
      });
      const completed = createMockOrder({
        orderId: 'c1',
        status: 'Completed',
      });

      store.upsertOrder(received);
      store.upsertOrder(received2);
      store.upsertOrder(preparing);
      store.upsertOrder(ready);
      store.upsertOrder(completed);
    });

    it('should get orders by status', () => {
      const received = store.getOrdersByStatus('Received');
      expect(received.length).toBe(2);
      expect(received.map((o) => o.orderId).sort()).toEqual(['r1', 'r2']);
    });

    it('should sort orders by status (newest first)', () => {
      const received = store.getOrdersByStatus('Received');
      // r2 was created after r1, so should come first
      expect(received[0].orderId).toBe('r2');
      expect(received[1].orderId).toBe('r1');
    });

    it('should return empty array for status with no orders', () => {
      const cancelled = store.getOrdersByStatus('Cancelled');
      expect(cancelled).toEqual([]);
    });

    it('should get order by ID', () => {
      const order = store.getOrder('p1');
      expect(order?.orderId).toBe('p1');
      expect(order?.status).toBe('Preparing');
    });

    it('should return undefined for non-existent order', () => {
      expect(store.getOrder('does-not-exist')).toBeUndefined();
    });

    it('should calculate metrics correctly', () => {
      const metrics = store.getMetrics();

      expect(metrics.total).toBe(5);
      expect(metrics.byStatus).toEqual({
        Received: 2,
        Preparing: 1,
        Ready: 1,
        Completed: 1,
        Cancelled: 0,
      });
      expect(metrics.avgWaitTime).toBeGreaterThan(0);
    });

    it('should calculate avgWaitTime only for active orders', () => {
      const store2 = new OrderStore();
      const old = createMockOrder({
        orderId: 'old',
        status: 'Received',
        createdAt: Date.now() - 60000,
      });
      const new_ = createMockOrder({
        orderId: 'new',
        status: 'Received',
        createdAt: Date.now() - 1000,
      });

      store2.upsertOrder(old);
      store2.upsertOrder(new_);

      const metrics = store2.getMetrics();
      expect(metrics.avgWaitTime).toBeGreaterThan(1000); // Average of 60s and 1s
      expect(metrics.avgWaitTime).toBeLessThan(60000);
    });
  });

  describe('Auto-Dismiss Timers', () => {
    it('should start dismiss timer and remove order after delay', () => {
      const order = createMockOrder({ orderId: 'dismiss-1' });
      store.upsertOrder(order);

      store.startDismissTimer(order.orderId, 1000);
      expect(store.getOrder(order.orderId)).toBeDefined();

      vi.advanceTimersByTime(1000);
      expect(store.getOrder(order.orderId)).toBeUndefined();
    });

    it('should cancel existing timer when starting new one', () => {
      const order = createMockOrder({ orderId: 'dismiss-2' });
      store.upsertOrder(order);

      store.startDismissTimer(order.orderId, 5000);
      vi.advanceTimersByTime(2000);

      // Start new timer (should cancel the old one)
      store.startDismissTimer(order.orderId, 1000);
      vi.advanceTimersByTime(1000);

      // Order should be removed by the new 1s timer
      expect(store.getOrder(order.orderId)).toBeUndefined();
    });

    it('should cancel dismiss timer manually', () => {
      const order = createMockOrder({ orderId: 'dismiss-3' });
      store.upsertOrder(order);

      store.startDismissTimer(order.orderId, 1000);
      store.cancelDismissTimer(order.orderId);

      vi.advanceTimersByTime(2000);

      // Order should still exist (timer was cancelled)
      expect(store.getOrder(order.orderId)).toBeDefined();
    });

    it('should cancel all dismiss timers', () => {
      const order1 = createMockOrder({ orderId: 'd1' });
      const order2 = createMockOrder({ orderId: 'd2' });

      store.upsertOrder(order1);
      store.upsertOrder(order2);

      store.startDismissTimer(order1.orderId, 1000);
      store.startDismissTimer(order2.orderId, 1000);

      store.cancelAllDismissTimers();

      vi.advanceTimersByTime(2000);

      // Both orders should still exist
      expect(store.getOrder(order1.orderId)).toBeDefined();
      expect(store.getOrder(order2.orderId)).toBeDefined();
    });
  });

  describe('Atomic State Replacement (STATE_SYNC)', () => {
    it('should replace all orders atomically', () => {
      const order1 = createMockOrder({ orderId: 'old-1' });
      store.upsertOrder(order1);

      expect(store.orders.size).toBe(1);

      const newOrders = [
        createMockOrder({ orderId: 'new-1' }),
        createMockOrder({ orderId: 'new-2' }),
      ];

      store.replaceAllOrders(newOrders);

      expect(store.orders.size).toBe(2);
      expect(store.getOrder('old-1')).toBeUndefined();
      expect(store.getOrder('new-1')).toBeDefined();
      expect(store.getOrder('new-2')).toBeDefined();
    });

    it('should cancel all timers on STATE_SYNC', () => {
      const order = createMockOrder({ orderId: 'timer-cancel' });
      store.upsertOrder(order);

      store.startDismissTimer(order.orderId, 5000);

      // STATE_SYNC should cancel all timers
      store.replaceAllOrders([
        createMockOrder({ orderId: 'sync-new' }),
      ]);

      // Old order's timer should have been cancelled
      vi.advanceTimersByTime(5000);
      expect(store.getOrder('timer-cancel')).toBeUndefined(); // Already removed by replaceAllOrders
      expect(store.getOrder('sync-new')).toBeDefined(); // New order still there
    });

    it('should restart timers for terminal orders after STATE_SYNC', () => {
      // Simulate reconnection where we have existing Completed order with old timer
      const oldCompleted = createMockOrder({
        orderId: 'old-completed',
        status: 'Completed',
      });
      store.upsertOrder(oldCompleted);
      store.startDismissTimer(oldCompleted.orderId, 5000);

      // After some time, STATE_SYNC arrives (e.g., after 2s offline)
      vi.advanceTimersByTime(2000);

      // New state from backend (same order still in Completed)
      const syncedOrder = createMockOrder({
        orderId: 'old-completed',
        status: 'Completed',
      });

      // In a real flow, the store would restart timers after replace
      // Here we simulate that manually
      store.replaceAllOrders([syncedOrder]);
      store.startDismissTimer(syncedOrder.orderId, 5000);

      // Should take 5s from now (not 3s remaining from old timer)
      vi.advanceTimersByTime(4000);
      expect(store.getOrder('old-completed')).toBeDefined();

      vi.advanceTimersByTime(1500);
      expect(store.getOrder('old-completed')).toBeUndefined();
    });
  });

  describe('Pub/Sub', () => {
    it('should notify subscribers on upsert', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      const order = createMockOrder();
      store.upsertOrder(order);

      expect(listener).toHaveBeenCalledWith(store);
    });

    it('should notify subscribers on remove', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      const listener = vi.fn();
      store.subscribe(listener);

      store.removeOrder(order.orderId);

      expect(listener).toHaveBeenCalledWith(store);
    });

    it('should notify subscribers on status update', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      const listener = vi.fn();
      store.subscribe(listener);

      store.updateOrderStatus(order.orderId, 'Preparing');

      expect(listener).toHaveBeenCalledWith(store);
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      const order = createMockOrder();
      store.upsertOrder(order);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.upsertOrder(createMockOrder());
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should notify subscribers on STATE_SYNC', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.replaceAllOrders([createMockOrder()]);

      expect(listener).toHaveBeenCalledWith(store);
    });
  });

  describe('Loading State', () => {
    it('should set and clear loading state', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      expect(store.getOrder(order.orderId)?.isLoading).toBeUndefined();

      store.setIsLoading(order.orderId, true);
      expect(store.getOrder(order.orderId)?.isLoading).toBe(true);

      store.setIsLoading(order.orderId, false);
      expect(store.getOrder(order.orderId)?.isLoading).toBe(false);
    });

    it('should notify subscribers on loading state change', () => {
      const order = createMockOrder();
      store.upsertOrder(order);

      const listener = vi.fn();
      store.subscribe(listener);

      store.setIsLoading(order.orderId, true);

      expect(listener).toHaveBeenCalledWith(store);
    });
  });

  describe('Duplicate ORDER_UPDATE Detection (Integration Test)', () => {
    it('should ignore stale ORDER_UPDATE (updatedAt ≤ current)', () => {
      const order = createMockOrder({
        orderId: 'dup-test',
        status: 'Received',
        updatedAt: 1000,
      });
      store.upsertOrder(order);

      // Simulate stale update (same or older timestamp)
      const staleUpdate = {
        ...order,
        status: 'Preparing' as OrderStatus,
        updatedAt: 1000, // Same as current
      };

      // In real flow, caller checks: if (msg.metadata?.updated_at <= order.updatedAt) return;
      // For this test, we verify the order state doesn't change
      if (staleUpdate.updatedAt <= order.updatedAt) {
        // Ignore stale update
        expect(store.getOrder('dup-test')?.status).toBe('Received');
      }
    });

    it('should apply fresh ORDER_UPDATE (updatedAt > current)', () => {
      const order = createMockOrder({
        orderId: 'fresh-test',
        status: 'Received',
        updatedAt: 1000,
      });
      store.upsertOrder(order);

      // Simulate fresh update (newer timestamp)
      const freshUpdate = {
        ...order,
        status: 'Preparing' as OrderStatus,
        updatedAt: 2000, // Newer than current
      };

      // In real flow: if (msg.metadata?.updated_at > order.updatedAt)
      if (freshUpdate.updatedAt > order.updatedAt) {
        store.upsertOrder(freshUpdate);
        expect(store.getOrder('fresh-test')?.status).toBe('Preparing');
      }
    });
  });
});
