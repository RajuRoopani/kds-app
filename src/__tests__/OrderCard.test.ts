/**
 * Tests for OrderCard Component
 * 
 * Coverage:
 * - Rendering order details (ID, customer name, items, elapsed time)
 * - Click handler and keyboard activation
 * - Loading state
 * - Responsive design
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Order } from '../types';
import { OrderCard } from '../components/OrderCard';

describe('OrderCard - Rendering', () => {
  let mockOrder: Order;
  let mockOnOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const createdAt = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    mockOrder = {
      orderId: '12847',
      customerName: 'John Smith',
      items: [
        { itemId: '1', name: 'Burger', quantity: 1 },
        { itemId: '2', name: 'Fries', quantity: 2 },
        { itemId: '3', name: 'Coke', quantity: 1 },
      ],
      status: 'Received',
      createdAt,
      updatedAt: createdAt,
    };
    mockOnOpen = vi.fn();
  });

  it('should display order ID', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText('#12847')).toBeInTheDocument();
  });

  it('should display customer name', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('should display items in order', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const itemsText = screen.getByText(/Burger, 2x Fries, Coke/);
    expect(itemsText).toBeInTheDocument();
  });

  it('should display elapsed time', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const elapsedText = screen.getByText(/Placed.*ago/);
    expect(elapsedText).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('data-order-id', '12847');
    expect(card).toHaveAttribute('data-status', 'Received');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('should have appropriate aria-label', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('12847'));
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('John Smith'));
  });
});

describe('OrderCard - Interactions', () => {
  let mockOrder: Order;
  let mockOnOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrder = {
      orderId: '12847',
      customerName: 'John Smith',
      items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockOnOpen = vi.fn();
  });

  it('should call onOpen when card is clicked', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('should call onOpen on Enter key', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('should call onOpen on Space key', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('should not call onOpen for other keys', () => {
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'a' });
    expect(mockOnOpen).not.toHaveBeenCalled();
  });
});

describe('OrderCard - Loading State', () => {
  let mockOrder: Order;
  let mockOnOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOrder = {
      orderId: '12847',
      customerName: 'John Smith',
      items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLoading: false,
    };
    mockOnOpen = vi.fn();
  });

  it('should show spinner overlay when isLoading is true', () => {
    mockOrder.isLoading = true;
    const { container } = render(
      <OrderCard order={mockOrder} onOpen={mockOnOpen} />
    );
    const spinner = container.querySelector('[class*="spinner"]');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show spinner overlay when isLoading is false', () => {
    const { container } = render(
      <OrderCard order={mockOrder} onOpen={mockOnOpen} />
    );
    const spinner = container.querySelector('[class*="loadingOverlay"]');
    expect(spinner).not.toBeInTheDocument();
  });
});

describe('OrderCard - Time Formatting', () => {
  let mockOnOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOpen = vi.fn();
  });

  it('should format seconds correctly', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now() - 15 * 1000, // 15 seconds ago
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/15s ago/)).toBeInTheDocument();
  });

  it('should format minutes correctly', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/5m/)).toBeInTheDocument();
  });

  it('should format hours correctly', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });
});

describe('OrderCard - Item Formatting', () => {
  let mockOnOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOpen = vi.fn();
  });

  it('should format items without quantity', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [{ itemId: '1', name: 'Burger', quantity: 1 }],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
  });

  it('should format items with quantity > 1', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [{ itemId: '1', name: 'Burger', quantity: 3 }],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/3x Burger/)).toBeInTheDocument();
  });

  it('should format multiple items separated by commas', () => {
    const mockOrder: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [
        { itemId: '1', name: 'Burger', quantity: 1 },
        { itemId: '2', name: 'Fries', quantity: 2 },
      ],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(<OrderCard order={mockOrder} onOpen={mockOnOpen} />);
    expect(screen.getByText(/Burger, 2x Fries/)).toBeInTheDocument();
  });
});
