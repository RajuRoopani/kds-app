/**
 * Kitchen Display System — Order State Store
 * 
 * Maintains normalized order state (Map<orderId, Order>) and provides:
 * - Selectors for derived state (e.g., getOrdersByStatus)
 * - Auto-dismiss timers for Completed/Cancelled orders
 * - Pub/sub for React component subscription
 * 
 * Design: Normalized state + derived selectors
 * - Single source of truth in orders Map
 * - No denormalization (prevents sync bugs)
 * - Components subscribe and react to changes
 */

import type { Order, OrderStatus, OrderData, IOrderStore } from '../types';

type StoreListener = (store: IOrderStore) => void;

/**
 * In-memory order state store with pub/sub
 */
export class OrderStore implements IOrderStore {
  // Normalized state: orderId → Order
  public orders: Map<string, Order> = new Map();

  // Subscribers to store changes
  private listeners: Set<StoreListener> = new Set();

  /**
   * Add or update an order
   */
  public upsertOrder(order: Order): void {
    this.orders.set(order.orderId, order);
    this.notifyListeners();
  }

  /**
   * Remove an order from the store
   */
  public removeOrder(orderId: string): void {
    const order = this.orders.get(orderId);
    if (order && order.dismissTimer) {
      clearTimeout(order.dismissTimer);
    }
    this.orders.delete(orderId);
    this.notifyListeners();
  }

  /**
   * Update an order's status
   * Does not trigger dismiss timer logic (caller should do that)
   */
  public updateOrderStatus(orderId: string, newStatus: OrderStatus): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = newStatus;
      order.updatedAt = Date.now();
      this.notifyListeners();
    }
  }

  /**
   * Replace entire order map (called on STATE_SYNC)
   * Cancels all existing timers and replaces with new state
   */
  public replaceAllOrders(orders: Order[]): void {
    // Cancel all existing dismiss timers
    this.cancelAllDismissTimers();

    // Clear and rebuild state
    this.orders.clear();
    for (const order of orders) {
      this.orders.set(order.orderId, order);
    }

    this.notifyListeners();
  }

  /**
   * Set loading state for an order
   */
  public setIsLoading(orderId: string, loading: boolean): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.isLoading = loading;
      this.notifyListeners();
    }
  }

  /**
   * Get all orders with a specific status
   * Selector: computed on every call (not cached)
   */
  public getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(this.orders.values())
      .filter((order) => order.status === status)
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first
  }

  /**
   * Get a single order by ID
   */
  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders (unfiltered)
   */
  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get metrics about the order state
   */
  public getMetrics(): {
    total: number;
    byStatus: Record<OrderStatus, number>;
    avgWaitTime: number;
  } {
    const now = Date.now();
    let totalWaitTime = 0;
    let countActive = 0;

    const byStatus: Record<OrderStatus, number> = {
      Received: 0,
      Preparing: 0,
      Ready: 0,
      Completed: 0,
      Cancelled: 0,
    };

    for (const order of this.orders.values()) {
      byStatus[order.status]++;

      // Calculate wait time for active orders
      if (order.status !== 'Completed' && order.status !== 'Cancelled') {
        totalWaitTime += now - order.createdAt;
        countActive++;
      }
    }

    return {
      total: this.orders.size,
      byStatus,
      avgWaitTime: countActive > 0 ? Math.round(totalWaitTime / countActive) : 0,
    };
  }

  /**
   * Start auto-dismiss timer for Completed/Cancelled orders
   * Timer removes the order from state after delayMs
   */
  public startDismissTimer(orderId: string, delayMs: number): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    // Cancel existing timer if any
    if (order.dismissTimer) {
      clearTimeout(order.dismissTimer);
    }

    // Create new timer
    const timer = setTimeout(() => {
      this.removeOrder(orderId);
    }, delayMs);

    order.dismissTimer = timer;
  }

  /**
   * Cancel dismiss timer for a single order
   */
  public cancelDismissTimer(orderId: string): void {
    const order = this.orders.get(orderId);
    if (order && order.dismissTimer) {
      clearTimeout(order.dismissTimer);
      order.dismissTimer = undefined;
    }
  }

  /**
   * Cancel all dismiss timers (called on STATE_SYNC)
   */
  public cancelAllDismissTimers(): void {
    for (const order of this.orders.values()) {
      if (order.dismissTimer) {
        clearTimeout(order.dismissTimer);
        order.dismissTimer = undefined;
      }
    }
  }

  /**
   * Subscribe to store changes
   * Returns unsubscribe function
   */
  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this));
  }
}

/**
 * Create a singleton store instance
 */
export function createOrderStore(): OrderStore {
  return new OrderStore();
}
