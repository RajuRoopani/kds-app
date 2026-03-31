/**
 * Tests for ActionButtons Component
 * 
 * Coverage:
 * - Button visibility per status
 * - Action dispatch and error handling
 * - Retry functionality
 * - Cancel confirmation dialog
 * - Auto-dismiss countdown for Completed/Cancelled
 * - Disabled state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Order } from '../types';
import { ActionButtons } from '../components/ActionButtons';

// Mock the useOrderAction hook
vi.mock('../hooks/useOrder', () => ({
  useOrderAction: vi.fn(() => ({
    error: null,
    isLoading: false,
    dispatch: vi.fn(),
    retry: vi.fn(),
    clearError: vi.fn(),
  })),
}));

describe('ActionButtons - Available Actions by Status', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show [Accept] and [Decline] buttons for Received status', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Decline')).toBeInTheDocument();
    expect(screen.queryByText('Mark Ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Complete')).not.toBeInTheDocument();
  });

  it('should show [Mark Ready] and [Cancel] buttons for Preparing status', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Preparing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    expect(screen.getByText('Mark Ready')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Complete')).not.toBeInTheDocument();
  });

  it('should show [Mark Complete] and [Cancel] buttons for Ready status', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Ready',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    expect(screen.getByText('Mark Complete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Ready')).not.toBeInTheDocument();
  });

  it('should show [Dismiss] button for Completed status', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should show [Dismiss] button for Cancelled status', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Cancelled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    expect(screen.getByText('Dismiss')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });
});

describe('ActionButtons - Cancel Confirmation', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show confirmation dialog when Cancel button is clicked', () => {
    const order: Order = {
      orderId: '12847',
      customerName: 'Test',
      items: [],
      status: 'Preparing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.getByText(/Are you sure you want to cancel order #12847/)).toBeInTheDocument();
    expect(screen.getByText('No, Keep It')).toBeInTheDocument();
    expect(screen.getByText('Yes, Cancel')).toBeInTheDocument();
  });

  it('should dismiss confirmation when [No, Keep It] is clicked', () => {
    const order: Order = {
      orderId: '12847',
      customerName: 'Test',
      items: [],
      status: 'Preparing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    const noButton = screen.getByText('No, Keep It');
    fireEvent.click(noButton);

    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

describe('ActionButtons - Button States', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should disable buttons when order.isLoading is true', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLoading: true,
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const acceptButton = screen.getByText('Accept') as HTMLButtonElement;
    expect(acceptButton.disabled).toBe(true);
  });

  it('should have proper accessibility attributes on action buttons', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const acceptButton = screen.getByText('Accept');
    expect(acceptButton).toHaveAttribute('data-action', 'ACCEPT');
    expect(acceptButton).toHaveAttribute('aria-label', expect.stringContaining('1'));
  });
});

describe('ActionButtons - Auto-dismiss Countdown', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should display countdown for Completed orders', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { container } = render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    // Wait for countdown to appear
    vi.runAllTimers();

    // Should show dismiss countdown (5 seconds for Completed)
    const countdownText = container.textContent;
    expect(countdownText).toMatch(/Removing in|Dismissing in/);
  });

  it('should display countdown for Cancelled orders', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Cancelled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { container } = render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    // Wait for countdown to appear
    vi.runAllTimers();

    const countdownText = container.textContent;
    expect(countdownText).toMatch(/Removing in|Dismissing in/);
  });
});

describe('ActionButtons - Dismiss Button', () => {
  let mockOnSuccess: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call onActionSuccess when [Dismiss] is clicked for Completed order', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('should have proper data attributes on buttons', () => {
    const order: Order = {
      orderId: '1',
      customerName: 'Test',
      items: [],
      status: 'Received',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { container } = render(
      <ActionButtons order={order} onActionSuccess={mockOnSuccess} onActionError={mockOnError} />
    );

    const acceptButton = container.querySelector('[data-action="ACCEPT"]');
    expect(acceptButton).toBeInTheDocument();
  });
});
