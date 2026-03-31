/**
 * Kitchen Display System — Order Card Component
 *
 * Displays a single order in the kanban column.
 * Shows order ID, customer name, items, elapsed time, and optional status badge.
 * Clickable to open the detail modal.
 *
 * Props:
 * - order: Order — The order to display
 * - onOpen?: () => void — Callback when card is clicked (to open detail modal)
 *
 * Styling:
 * - Responsive card with hover effects
 * - Disabled state when order is loading (isLoading = true)
 * - Touch-friendly sizing
 */

import React from 'react';
import type { Order } from '../types';
import styles from './OrderCard.module.css';

export interface OrderCardProps {
  order: Order;
  onOpen?: () => void;
}

/**
 * Format timestamp as HH:MM
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format elapsed time from creation to now in human-readable format
 */
function formatElapsedTime(createdAt: number): string {
  const now = Date.now();
  const elapsedMs = now - createdAt;
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format items list as comma-separated string (truncated if long)
 */
function formatItems(items: Array<{ name: string; quantity: number }>): string {
  return items.map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.name}` : i.name)).join(', ');
}

/**
 * OrderCard: Displays a single order
 */
export const OrderCard: React.FC<OrderCardProps> = ({ order, onOpen }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };

  return (
    <article
      className={`${styles.card} ${order.isLoading ? styles.loading : ''}`}
      data-order-id={order.orderId}
      data-status={order.status}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Order ${order.orderId} for ${order.customerName}`}
    >
      {/* Order ID */}
      <div className={styles.orderId}>
        #{order.orderId}
      </div>

      {/* Customer name */}
      <div className={styles.customerName}>
        {order.customerName}
      </div>

      {/* Items */}
      <div className={styles.items} title={formatItems(order.items)}>
        {formatItems(order.items)}
      </div>

      {/* Footer: elapsed time */}
      <div className={styles.footer}>
        <div className={styles.elapsedTime}>
          Placed {formatElapsedTime(order.createdAt)} ago
        </div>
      </div>

      {/* Loading overlay if isLoading */}
      {order.isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
        </div>
      )}
    </article>
  );
};

OrderCard.displayName = 'OrderCard';
