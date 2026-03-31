/**
 * Action Dispatcher Tests
 * 
 * Tests action sending, CONFIRMATION handling, timeout logic,
 * and request deduplication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionDispatcher } from '../client/action-dispatcher';
import { OrderStore } from '../client/order-store';
import type { IWebSocketClient, ConfirmationMessage } from '../types';

/**
 * Mock WebSocket client for testing
 */
class MockWSClient implements IWebSocketClient {
  public messageListeners: Set<Function> = new Set();
  public connectedListeners: Set<Function> = new Set();
  private _isConnected = true;

  public async connect(): Promise<void> {
    this._isConnected = true;
  }

  public disconnect(): void {
    this._isConnected = false;
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public async sendAction(action: any): Promise<void> {
    // Mock: just validate
    if (!action.requestId || !action.orderId) {
      throw new Error('Invalid action');
    }
  }

  public onConnected(callback: () => void) {
    this.connectedListeners.add(callback);
    return () => this.connectedListeners.delete(callback);
  }

  public onDisconnected(callback: () => void) {
    return () => {};
  }

  public onMessage(callback: (message: any) => void) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onError(callback: (error: Error) => void) {
    return () => {};
  }

  public simulateConfirmation(message: ConfirmationMessage) {
    this.messageListeners.forEach((listener) => listener(message));
  }
}

describe('ActionDispatcher', () => {
  let dispatcher: ActionDispatcher;
  let mockWS: MockWSClient;
  let store: OrderStore;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWS = new MockWSClient();
    store = new OrderStore();
    dispatcher = new ActionDispatcher(mockWS, store);
  });

  afterEach(() => {
    dispatcher.destroy();
    vi.useRealTimers();
  });

  describe('Action Dispatch', () => {
    it('should send ACTION message with UUID requestId', async () => {
      const sendSpy = vi.spyOn(mockWS, 'sendAction');

      const orderPromise = dispatcher.dispatch('order-1', 'ACCEPT');

      // Simulate confirmation
      mockWS.simulateConfirmation({
        type: 'CONFIRMATION',
        requestId: (sendSpy.mock.calls[0][0] as any).requestId,
        orderId: 'order-1',
        action: 'ACCEPT',
        success: true,
        timestamp: Date.now(),
      });

      await orderPromise;

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ACTION',
          orderId: 'order-1',
          action: 'ACCEPT',
          requestId: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should set loading state on order during dispatch', async () => {
      const order = {
        orderId: 'order-2',
        customerName: 'Test',
        items: [],
        status: 'Received' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.upsertOrder(order);

      const dispatchPromise = dispatcher.dispatch('order-2', 'ACCEPT');

      // Should have set loading immediately
      expect(store.getOrder('order-2')?.isLoading).toBe(true);

      // Get the requestId that was sent
      const sendSpy = vi.spyOn(mockWS, 'sendAction');
      const calls = sendSpy.mock.calls;
      const requestId = calls[0]?.[0]?.requestId;

      // Simulate confirmation
      if (requestId) {
        mockWS.simulateConfirmation({
          type: 'CONFIRMATION',
          requestId,
          orderId: 'order-2',
          action: 'ACCEPT',
          success: true,
          timestamp: Date.now(),
        });
      }

      await dispatchPromise;

      // Should have cleared loading
      expect(store.getOrder('order-2')?.isLoading).toBe(false);
    });

    it('should clear loading state on timeout', async () => {
      const order = {
        orderId: 'order-3',
        customerName: 'Test',
        items: [],
        status: 'Received' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.upsertOrder(order);

      const dispatchPromise = dispatcher.dispatch('order-3', 'ACCEPT');

      // Advance time past timeout (5s)
      vi.advanceTimersByTime(6000);

      // Should have cleared loading
      expect(store.getOrder('order-3')?.isLoading).toBe(false);

      // Should reject with timeout error
      await expect(dispatchPromise).rejects.toThrow('timeout');
    });

    it('should clear loading state on failed confirmation', async () => {
      const order = {
        orderId: 'order-4',
        customerName: 'Test',
        items: [],
        status: 'Received' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.upsertOrder(order);

      const dispatchPromise = dispatcher.dispatch('order-4', 'ACCEPT');

      // Get the requestId that was sent
      const sendSpy = vi.spyOn(mockWS, 'sendAction');
      const calls = sendSpy.mock.calls;
      const requestId = calls[0]?.[0]?.requestId;

      // Simulate failed confirmation
      if (requestId) {
        mockWS.simulateConfirmation({
          type: 'CONFIRMATION',
          requestId,
          orderId: 'order-4',
          action: 'ACCEPT',
          success: false,
          reason: 'Order state changed',
          timestamp: Date.now(),
        });
      }

      await expect(dispatchPromise).rejects.toThrow('Order state changed');
      expect(store.getOrder('order-4')?.isLoading).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after 5 seconds without CONFIRMATION', async () => {
      const dispatchPromise = dispatcher.dispatch('order-5', 'ACCEPT');

      // Advance past 5s
      vi.advanceTimersByTime(5100);

      await expect(dispatchPromise).rejects.toThrow('timeout');
    });

    it('should not timeout if CONFIRMATION arrives before deadline', async () => {
      const dispatchPromise = dispatcher.dispatch('order-6', 'ACCEPT');

      const sendSpy = vi.spyOn(mockWS, 'sendAction');
      const requestId = (sendSpy.mock.calls[0]?.[0] as any)?.requestId;

      // Simulate CONFIRMATION at 3s (before 5s timeout)
      vi.advanceTimersByTime(3000);

      if (requestId) {
        mockWS.simulateConfirmation({
          type: 'CONFIRMATION',
          requestId,
          orderId: 'order-6',
          action: 'ACCEPT',
          success: true,
          timestamp: Date.now(),
        });
      }

      await expect(dispatchPromise).resolves.toBeUndefined();
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent identical actions', async () => {
      const sendSpy = vi.spyOn(mockWS, 'sendAction');

      // Send same action twice rapidly
      const promise1 = dispatcher.dispatch('order-7', 'ACCEPT');
      const promise2 = dispatcher.dispatch('order-7', 'ACCEPT');

      // Only one sendAction should be called (second is deduplicated)
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Both promises should resolve to the same thing
      // (second promise returns immediately from dedup)
      await Promise.all([promise1, promise2]);
    });

    it('should not deduplicate different actions on same order', async () => {
      const sendSpy = vi.spyOn(mockWS, 'sendAction');

      const promise1 = dispatcher.dispatch('order-8', 'ACCEPT');
      const promise2 = dispatcher.dispatch('order-8', 'READY'); // Different action

      // Both should be sent (different actions)
      expect(sendSpy.mock.calls.length).toBe(2);

      // Confirm both
      const requestIds = sendSpy.mock.calls.map((call) => (call[0] as any).requestId);
      for (let i = 0; i < requestIds.length; i++) {
        mockWS.simulateConfirmation({
          type: 'CONFIRMATION',
          requestId: requestIds[i],
          orderId: 'order-8',
          action: i === 0 ? 'ACCEPT' : 'READY',
          success: true,
          timestamp: Date.now(),
        });
      }

      await Promise.all([promise1, promise2]);
    });

    it('should allow re-firing action after dedup window (500ms)', async () => {
      const sendSpy = vi.spyOn(mockWS, 'sendAction');

      dispatcher.dispatch('order-9', 'ACCEPT');
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Try again immediately (deduplicated)
      dispatcher.dispatch('order-9', 'ACCEPT');
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Wait for dedup window to expire (500ms)
      vi.advanceTimersByTime(600);

      // Now should allow re-fire
      dispatcher.dispatch('order-9', 'ACCEPT');
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Confirmation Matching', () => {
    it('should match CONFIRMATION to correct request by requestId', async () => {
      const sendSpy = vi.spyOn(mockWS, 'sendAction');

      const promise1 = dispatcher.dispatch('order-10', 'ACCEPT');
      const promise2 = dispatcher.dispatch('order-11', 'READY');

      const requestIds = sendSpy.mock.calls.map((call) => (call[0] as any).requestId);

      // Send confirmations in reverse order (to test matching)
      mockWS.simulateConfirmation({
        type: 'CONFIRMATION',
        requestId: requestIds[1],
        orderId: 'order-11',
        action: 'READY',
        success: true,
        timestamp: Date.now(),
      });

      mockWS.simulateConfirmation({
        type: 'CONFIRMATION',
        requestId: requestIds[0],
        orderId: 'order-10',
        action: 'ACCEPT',
        success: true,
        timestamp: Date.now(),
      });

      await Promise.all([promise1, promise2]);
      // Both should resolve correctly
    });

    it('should ignore CONFIRMATION for unknown requestId', async () => {
      const dispatchPromise = dispatcher.dispatch('order-12', 'ACCEPT');

      // Send confirmation with wrong requestId
      mockWS.simulateConfirmation({
        type: 'CONFIRMATION',
        requestId: 'unknown-req-id',
        orderId: 'order-12',
        action: 'ACCEPT',
        success: true,
        timestamp: Date.now(),
      });

      // Dispatch should still be pending (timeout after 5s)
      vi.advanceTimersByTime(5100);

      await expect(dispatchPromise).rejects.toThrow('timeout');
    });
  });

  describe('Cleanup', () => {
    it('should cancel pending actions on destroy', async () => {
      const promise1 = dispatcher.dispatch('order-13', 'ACCEPT');
      const promise2 = dispatcher.dispatch('order-14', 'READY');

      dispatcher.destroy();

      await expect(promise1).rejects.toThrow('cancelled');
      await expect(promise2).rejects.toThrow('cancelled');
    });

    it('should clear loading state on all orders when destroying', async () => {
      const order1 = {
        orderId: 'order-15',
        customerName: 'Test',
        items: [],
        status: 'Received' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const order2 = {
        orderId: 'order-16',
        customerName: 'Test',
        items: [],
        status: 'Received' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      store.upsertOrder(order1);
      store.upsertOrder(order2);

      dispatcher.dispatch('order-15', 'ACCEPT');
      dispatcher.dispatch('order-16', 'READY');

      dispatcher.destroy();

      expect(store.getOrder('order-15')?.isLoading).toBe(false);
      expect(store.getOrder('order-16')?.isLoading).toBe(false);
    });
  });
});
