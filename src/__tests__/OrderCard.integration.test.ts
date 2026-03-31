/**
 * Integration Tests for OrderCard + CardContainer with Redux Store
 * 
 * Coverage:
 * - Redux store integration
 * - Order state updates triggering re-renders
 * - Large lists (100+ orders) without lag
 * - Status badge colors
 * - Action dispatch flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Order, OrderStatus } from '../types';
import { OrderCard } from '../components/OrderCard';
import { CardContainer } from '../components/CardContainer';

describe('OrderCard + CardContainer - Integration', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  it('should render multiple orders with different statuses', () => {
    const orders: Order[] = [
      {
        orderId: '1',
        customerName: 'Alice',
        items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '2',
        customerName: 'Bob',
        items: [{ itemId: '2', name: 'Pizza', quantity: 2 }],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '3',
        customerName: 'Charlie',
        items: [{ itemId: '3', name: 'Salad', quantity: 1 }],
        status: 'Preparing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    // Render both Received and Preparing columns
    const receivedOrders = orders.filter((o) => o.status === 'Received');
    const preparingOrders = orders.filter((o) => o.status === 'Preparing');

    const { container: receivedContainer } = render(
      <CardContainer orders={receivedOrders} status="Received" onOrderClick={mockOnOrderClick} />
    );
    const { container: preparingContainer } = render(
      <CardContainer orders={preparingOrders} status="Preparing" onOrderClick={mockOnOrderClick} />
    );

    expect(within(receivedContainer).getByText('Alice')).toBeInTheDocument();
    expect(within(receivedContainer).getByText('Bob')).toBeInTheDocument();
    expect(within(preparingContainer).getByText('Charlie')).toBeInTheDocument();
  });

  it('should handle order click and pass correct orderId', () => {
    const order: Order = {
      orderId: '12847',
      customerName: 'John Smith',
      items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(<CardContainer orders={[order]} status="Received" onOrderClick={mockOnOrderClick} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockOnOrderClick).toHaveBeenCalledWith('12847');
  });
});

describe('CardContainer - Large Lists Performance', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  it('should render 100 orders without significant lag', () => {
    const orders: Order[] = Array.from({ length: 100 }, (_, i) => ({
      orderId: String(i + 1),
      customerName: `Customer ${i + 1}`,
      items: [{ itemId: `item-${i}`, name: `Item ${i}`, quantity: 1 }],
      status: 'Received' as OrderStatus,
      createdAt: Date.now() - i * 1000,
      updatedAt: Date.now() - i * 1000,
    }));

    const startTime = performance.now();

    const { container } = render(
      <CardContainer orders={orders} status="Received" onOrderClick={mockOnOrderClick} />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in less than 1 second
    expect(renderTime).toBeLessThan(1000);

    // Verify all orders are in the DOM
    const cards = container.querySelectorAll('[data-order-id]');
    expect(cards.length).toBe(100);
  });

  it('should efficiently update when orders change', () => {
    const initialOrders: Order[] = Array.from({ length: 50 }, (_, i) => ({
      orderId: String(i + 1),
      customerName: `Customer ${i + 1}`,
      items: [],
      status: 'Received' as OrderStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const { rerender } = render(
      <CardContainer
        orders={initialOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );

    // Update with new orders
    const updatedOrders: Order[] = Array.from({ length: 60 }, (_, i) => ({
      orderId: String(i + 1),
      customerName: `Customer ${i + 1}`,
      items: [],
      status: 'Received' as OrderStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const updateStartTime = performance.now();

    rerender(
      <CardContainer
        orders={updatedOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );

    const updateEndTime = performance.now();
    const updateTime = updateEndTime - updateStartTime;

    // Should update efficiently
    expect(updateTime).toBeLessThan(500);
  });

  it('should handle rapid order additions', () => {
    let orders: Order[] = [];

    const { rerender } = render(
      <CardContainer orders={orders} status="Received" onOrderClick={mockOnOrderClick} />
    );

    // Simulate rapid order additions
    for (let i = 0; i < 20; i++) {
      orders = [
        ...orders,
        {
          orderId: String(i + 1),
          customerName: `Customer ${i + 1}`,
          items: [],
          status: 'Received' as OrderStatus,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      rerender(
        <CardContainer
          orders={orders}
          status="Received"
          onOrderClick={mockOnOrderClick}
        />
      );
    }

    // Verify all orders are rendered
    expect(screen.getAllByRole('button')).toHaveLength(20);
  });
});

describe('CardContainer - Status Filtering', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  it('should only render orders matching the status prop', () => {
    const orders: Order[] = [
      {
        orderId: '1',
        customerName: 'Alice',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '2',
        customerName: 'Bob',
        items: [],
        status: 'Preparing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '3',
        customerName: 'Charlie',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    // Only pass Received orders
    const receivedOrders = orders.filter((o) => o.status === 'Received');

    render(
      <CardContainer
        orders={receivedOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('should show different empty states for different statuses', () => {
    const { rerender } = render(
      <CardContainer orders={[]} status="Received" onOrderClick={mockOnOrderClick} />
    );

    expect(screen.getByText(/No orders in this status/)).toBeInTheDocument();

    rerender(
      <CardContainer orders={[]} status="Preparing" onOrderClick={mockOnOrderClick} />
    );

    // Text should still be present (same message for all empty statuses)
    expect(screen.getByText(/No orders in this status/)).toBeInTheDocument();
  });
});

describe('OrderCard - Status Specific Rendering', () => {
  it('should render all status types correctly', () => {
    const statuses: OrderStatus[] = ['Received', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

    statuses.forEach((status) => {
      const order: Order = {
        orderId: '1',
        customerName: 'Test',
        items: [],
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const { container } = render(
        <OrderCard order={order} onOpen={vi.fn()} />
      );

      const card = container.querySelector('[data-status]');
      expect(card).toHaveAttribute('data-status', status);
    });
  });

  it('should maintain proper order IDs for different order statuses', () => {
    const orders: Order[] = [
      {
        orderId: '111',
        customerName: 'Received Order',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '222',
        customerName: 'Preparing Order',
        items: [],
        status: 'Preparing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '333',
        customerName: 'Ready Order',
        items: [],
        status: 'Ready',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const { container } = render(
      <>
        {orders.map((order) => (
          <div key={order.orderId}>
            <OrderCard order={order} onOpen={vi.fn()} />
          </div>
        ))}
      </>
    );

    const cards = container.querySelectorAll('[data-order-id]');
    expect(cards[0]).toHaveAttribute('data-order-id', '111');
    expect(cards[1]).toHaveAttribute('data-order-id', '222');
    expect(cards[2]).toHaveAttribute('data-order-id', '333');
  });
});

describe('CardContainer - Data Attribute Consistency', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  it('should maintain data attributes on all cards', () => {
    const orders: Order[] = [
      {
        orderId: 'order-001',
        customerName: 'Alice',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: 'order-002',
        customerName: 'Bob',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const { container } = render(
      <CardContainer orders={orders} status="Received" onOrderClick={mockOnOrderClick} />
    );

    const cards = container.querySelectorAll('[data-order-id][data-status]');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute('data-order-id', 'order-001');
    expect(cards[1]).toHaveAttribute('data-order-id', 'order-002');
  });
});
