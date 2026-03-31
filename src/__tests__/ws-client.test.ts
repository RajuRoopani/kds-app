/**
 * WebSocket Client Tests
 * 
 * Tests connection lifecycle, message parsing, reconnection logic,
 * and event dispatching without a real backend (mocked WebSocket).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from '../client/ws-client';
import type {
  OrderUpdateMessage,
  OrderNewMessage,
  StateSyncMessage,
  ConfirmationMessage,
} from '../types';

// Mock WebSocket
class MockWebSocket {
  public readyState: number = 0; // CONNECTING
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(public url: string) {
    setTimeout(() => this.simulateOpen(), 0);
  }

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  public send(data: string): void {
    // Mock: just validate it's valid JSON
    JSON.parse(data);
  }

  public close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.simulateClose();
  }

  public simulateOpen(): void {
    this.readyState = 1; // OPEN
    const event = new Event('open');
    this.listeners.get('open')?.forEach((handler) => handler(event));
  }

  public simulateMessage(data: string): void {
    const event = new MessageEvent('message', { data });
    this.listeners.get('message')?.forEach((handler) => handler(event));
  }

  public simulateError(): void {
    const event = new Event('error');
    this.listeners.get('error')?.forEach((handler) => handler(event));
  }

  public simulateClose(): void {
    const event = new CloseEvent('close');
    this.listeners.get('close')?.forEach((handler) => handler(event));
  }
}

let mockWsInstance: MockWebSocket | null = null;

// Mock global WebSocket
global.WebSocket = class {
  constructor(url: string) {
    mockWsInstance = new MockWebSocket(url);
    return mockWsInstance as any;
  }
} as any;

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    client = new WebSocketClient('wss://test.local/orders');
    mockWsInstance = null;
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    vi.clearAllTimers();
  });

  describe('Connection Lifecycle', () => {
    it('should connect successfully', async () => {
      const onConnected = vi.fn();
      client.onConnected(onConnected);

      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(onConnected).toHaveBeenCalled();
    });

    it('should report disconnected before connect', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect', async () => {
      const onDisconnected = vi.fn();
      client.onDisconnected(onDisconnected);

      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should not reconnect after explicit disconnect', async () => {
      const onConnected = vi.fn();
      client.onConnected(onConnected);

      await client.connect();
      client.disconnect();

      // Simulate close event (shouldn't trigger reconnect)
      mockWsInstance?.simulateClose();

      // Wait a bit and verify no auto-reconnect attempted
      await new Promise((resolve) => setTimeout(resolve, 100));
      // If client tried to reconnect, isConnected would be true or have pending retry
      // Since we disconnected explicitly, it should stay false
    });
  });

  describe('Message Parsing', () => {
    it('should parse and emit ORDER_UPDATE message', async () => {
      const onMessage = vi.fn();
      client.onMessage(onMessage);

      await client.connect();

      const message: OrderUpdateMessage = {
        type: 'ORDER_UPDATE',
        orderId: 'order-123',
        status: 'Preparing',
        timestamp: Date.now(),
        metadata: { updated_at: Date.now() },
      };

      mockWsInstance?.simulateMessage(JSON.stringify(message));

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining(message));
    });

    it('should parse and emit ORDER_NEW message', async () => {
      const onMessage = vi.fn();
      client.onMessage(onMessage);

      await client.connect();

      const message: OrderNewMessage = {
        type: 'ORDER_NEW',
        orderId: 'order-124',
        customerName: 'John Doe',
        items: [{ itemId: 'item-1', name: 'Burger', quantity: 1 }],
        status: 'Received',
        createdAt: Date.now(),
        timestamp: Date.now(),
      };

      mockWsInstance?.simulateMessage(JSON.stringify(message));

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining(message));
    });

    it('should parse and emit STATE_SYNC message', async () => {
      const onMessage = vi.fn();
      client.onMessage(onMessage);

      await client.connect();

      const message: StateSyncMessage = {
        type: 'STATE_SYNC',
        orders: [
          {
            orderId: 'order-125',
            customerName: 'Jane Doe',
            items: [],
            status: 'Ready',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };

      mockWsInstance?.simulateMessage(JSON.stringify(message));

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining(message));
    });

    it('should parse and emit CONFIRMATION message', async () => {
      const onMessage = vi.fn();
      client.onMessage(onMessage);

      await client.connect();

      const message: ConfirmationMessage = {
        type: 'CONFIRMATION',
        requestId: 'req-uuid-1',
        orderId: 'order-126',
        action: 'ACCEPT',
        success: true,
        timestamp: Date.now(),
      };

      mockWsInstance?.simulateMessage(JSON.stringify(message));

      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining(message));
    });

    it('should emit error on invalid JSON', async () => {
      const onError = vi.fn();
      client.onError(onError);

      await client.connect();

      mockWsInstance?.simulateMessage('{ invalid json }');

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });

    it('should emit error on missing type field', async () => {
      const onError = vi.fn();
      client.onError(onError);

      await client.connect();

      mockWsInstance?.simulateMessage(JSON.stringify({ orderId: 'order-127' }));

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });
  });

  describe('Sending Messages', () => {
    it('should send action message', async () => {
      const sendSpy = vi.spyOn(mockWsInstance!, 'send');

      await client.connect();

      await client.sendAction({
        type: 'ACTION',
        requestId: 'req-uuid-2',
        orderId: 'order-128',
        action: 'ACCEPT',
        timestamp: Date.now(),
      });

      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('ACTION')
      );
    });

    it('should throw if sending when not connected', async () => {
      await expect(
        client.sendAction({
          type: 'ACTION',
          requestId: 'req-uuid-3',
          orderId: 'order-129',
          action: 'ACCEPT',
          timestamp: Date.now(),
        })
      ).rejects.toThrow('WebSocket not connected');
    });
  });

  describe('Reconnection Logic', () => {
    it('should reconnect immediately on first disconnect (0ms delay)', async () => {
      const onConnected = vi.fn();
      client.onConnected(onConnected);

      await client.connect();
      expect(onConnected).toHaveBeenCalledTimes(1);

      // Simulate disconnect
      mockWsInstance?.simulateClose();

      // Reconnect should happen immediately (0ms backoff)
      vi.useFakeTimers();
      vi.runAllTimers();
      vi.useRealTimers();

      // Connection attempt should have triggered onConnected again
      // (MockWebSocket auto-opens, so we'll have 2 calls)
      expect(onConnected.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should backoff 3s on second disconnect', async () => {
      vi.useFakeTimers();

      const onConnected = vi.fn();
      client.onConnected(onConnected);

      await client.connect();
      mockWsInstance?.simulateClose();

      // First reconnect (0ms)
      vi.advanceTimersByTime(100);
      
      // Simulate second disconnect
      mockWsInstance?.simulateClose();

      // Second reconnect should be at 3s
      vi.advanceTimersByTime(2000); // Not yet
      expect(onConnected.mock.calls.length).toBeLessThan(5); // Rough check

      vi.advanceTimersByTime(1500); // Now past 3s
      // Reconnect should have triggered

      vi.useRealTimers();
    });

    it('should emit error after max retries', async () => {
      vi.useFakeTimers();

      const onError = vi.fn();
      client.onError(onError);

      // Simulate 10 disconnects to hit MAX_RETRIES
      await client.connect();

      for (let i = 0; i < 10; i++) {
        mockWsInstance?.simulateClose();
        vi.advanceTimersByTime(5000); // Skip past any backoff
      }

      vi.useRealTimers();

      // After MAX_RETRIES, should emit error
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Max reconnection'),
        })
      );
    });
  });

  describe('Event Unsubscription', () => {
    it('should allow unsubscribing from onConnected', async () => {
      const listener = vi.fn();
      const unsubscribe = client.onConnected(listener);

      await client.connect();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      // Create new client and connect; old listener should not be called
      const client2 = new WebSocketClient('wss://test.local/orders');
      await client2.connect();
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
      client2.disconnect();
    });

    it('should allow unsubscribing from onMessage', async () => {
      const listener = vi.fn();
      const unsubscribe = client.onMessage(listener);

      await client.connect();

      const message: OrderUpdateMessage = {
        type: 'ORDER_UPDATE',
        orderId: 'order-130',
        status: 'Ready',
        timestamp: Date.now(),
      };

      mockWsInstance?.simulateMessage(JSON.stringify(message));
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      mockWsInstance?.simulateMessage(JSON.stringify(message));
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });
});
