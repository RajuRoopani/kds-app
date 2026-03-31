/**
 * Kitchen Display System — Card Container Component
 *
 * Wrapper component that displays a list of OrderCard components for a given status.
 * Handles empty state display when no orders are present.
 *
 * Props:
 * - orders: Order[] — List of orders to render
 * - status: OrderStatus — The order status this container represents
 * - onOrderClick?: (orderId: string) => void — Callback when order is clicked
 *
 * Behavior:
 * - Maps each order to an <OrderCard> component
 * - Handles empty state with centered message
 * - Uses 8px gap between cards (vertical stack)
 * - Responsive: supports both desktop (wide cards) and mobile (full-width)
 */

import React, { useMemo } from 'react';
import type { Order, OrderStatus } from '../types';
import { OrderCard } from './OrderCard';

export interface CardContainerProps {
  orders: Order[];
  status: OrderStatus;
  onOrderClick?: (orderId: string) => void;
}

/**
 * CardContainer: Maps orders to OrderCard components with empty state handling
 */
export const CardContainer: React.FC<CardContainerProps> = ({
  orders,
  status,
  onOrderClick,
}) => {
  // Memoize card elements to avoid unnecessary re-renders
  const cardElements = useMemo(
    () =>
      orders.map((order) => (
        <OrderCard
          key={order.orderId}
          order={order}
          onOpen={() => onOrderClick?.(order.orderId)}
        />
      )),
    [orders, onOrderClick]
  );

  return (
    <div
      className="card-container"
      data-status={status}
      role="region"
      aria-label={`${status} orders`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '200px',
        padding: '0 12px 12px 12px',
        overflowY: 'auto',
        flex: 1,
      }}
    >
      {orders.length > 0 ? (
        cardElements
      ) : (
        <div
          className="empty-state"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            color: '#999',
            fontSize: '14px',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div>
            <p style={{ margin: '0 0 8px 0' }}>No orders in this status</p>
            <p style={{ margin: '0', fontSize: '12px', color: '#bbb' }}>
              New orders will appear here
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

CardContainer.displayName = 'CardContainer';
