/**
 * Tests for CardContainer Component
 * 
 * Coverage:
 * - Rendering multiple order cards
 * - Empty state display
 * - Order click handling
 * - Accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Order } from '../types';
import { CardContainer } from '../components/CardContainer';

describe('CardContainer - Rendering Orders', () => {
  let mockOrders: Order[];
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '2',
        customerName: 'Jane',
        items: [{ itemId: '2', name: 'Pizza', quantity: 1 }],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    mockOnOrderClick = vi.fn();
  });

  it('should render all orders', () => {
    render(
      <CardContainer
        orders={mockOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('should render in correct order (newest first)', () => {
    const oldOrder = { ...mockOrders[0], createdAt: Date.now() - 10000 };
    const newOrder = { ...mockOrders[1], createdAt: Date.now() };
    const orders = [oldOrder, newOrder];
    
    const { container } = render(
      <CardContainer
        orders={orders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const cards = container.querySelectorAll('[data-order-id]');
    expect(cards[0]).toHaveAttribute('data-order-id', '2'); // newest first
    expect(cards[1]).toHaveAttribute('data-order-id', '1');
  });
});

describe('CardContainer - Empty State', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  it('should show empty state message when no orders', () => {
    render(
      <CardContainer
        orders={[]}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    expect(screen.getByText(/No orders in this status/)).toBeInTheDocument();
    expect(screen.getByText(/New orders will appear here/)).toBeInTheDocument();
  });

  it('should not show empty state when orders exist', () => {
    const orders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    render(
      <CardContainer
        orders={orders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    expect(screen.queryByText(/No orders in this status/)).not.toBeInTheDocument();
  });
});

describe('CardContainer - Order Click Handling', () => {
  let mockOrders: Order[];
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    mockOnOrderClick = vi.fn();
  });

  it('should call onOrderClick with order ID when card is clicked', () => {
    render(
      <CardContainer
        orders={mockOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockOnOrderClick).toHaveBeenCalledWith('1');
  });

  it('should call onOrderClick for each card click', () => {
    const orders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        orderId: '2',
        customerName: 'Jane',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    render(
      <CardContainer
        orders={orders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    expect(mockOnOrderClick).toHaveBeenCalledTimes(2);
    expect(mockOnOrderClick).toHaveBeenNthCalledWith(1, '1');
    expect(mockOnOrderClick).toHaveBeenNthCalledWith(2, '2');
  });
});

describe('CardContainer - Accessibility', () => {
  let mockOrders: Order[];
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    mockOnOrderClick = vi.fn();
  });

  it('should have proper ARIA role and label', () => {
    render(
      <CardContainer
        orders={mockOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('aria-label', 'Received orders');
  });

  it('should have data-status attribute', () => {
    const { container } = render(
      <CardContainer
        orders={mockOrders}
        status="Preparing"
        onOrderClick={mockOnOrderClick}
      />
    );
    const cardContainer = container.querySelector('[data-status]');
    expect(cardContainer).toHaveAttribute('data-status', 'Preparing');
  });
});

describe('CardContainer - Memoization', () => {
  let mockOrders: Order[];
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrders = [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    mockOnOrderClick = vi.fn();
  });

  it('should update when orders change', () => {
    const { rerender } = render(
      <CardContainer
        orders={mockOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    expect(screen.getByText('#1')).toBeInTheDocument();
    
    const newOrders = [
      ...mockOrders,
      {
        orderId: '2',
        customerName: 'Jane',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    
    rerender(
      <CardContainer
        orders={newOrders}
        status="Received"
        onOrderClick={mockOnOrderClick}
      />
    );
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
