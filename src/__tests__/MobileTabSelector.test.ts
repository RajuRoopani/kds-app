/**
 * Tests for MobileTabSelector component
 *
 * MobileTabSelector renders 5 tabs for switching between order statuses on mobile/tablet (<768px).
 * Each tab shows status name and order count badge.
 * Active tab has bold text, dark color, and blue border-bottom indicator.
 *
 * Spec from DESIGN.md:
 * - 5 tabs: Received | Preparing | Ready | Completed | Cancelled
 * - Active tab: bold text, #1a1a1a, border-bottom #2196f3 (3px)
 * - Inactive: #999 text, no border
 * - Hover: background #f5f5f5
 * - Each tab shows count badge (12px font)
 * - Flex layout, scrollable if needed (overflow-x: auto)
 * - Sticky positioning at top on mobile
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { OrderStatus } from '../types';
import { MobileTabSelector } from '../components/MobileTabSelector';

describe('MobileTabSelector', () => {
  let mockActiveStatus: OrderStatus;
  let mockOnStatusChange: ReturnType<typeof vi.fn>;
  let mockStatusCounts: Record<OrderStatus, number>;

  beforeEach(() => {
    mockActiveStatus = 'Received';
    mockOnStatusChange = vi.fn();
    mockStatusCounts = {
      Received: 4,
      Preparing: 2,
      Ready: 5,
      Completed: 10,
      Cancelled: 0,
    };
  });

  it('should render all 5 tabs', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('should render with correct CSS classes', () => {
    const { container } = render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const selector = container.querySelector('.mobile-tab-selector');
    expect(selector).toBeInTheDocument();
    const tabs = container.querySelectorAll('.mobile-tab');
    expect(tabs.length).toBe(5);
  });

  it('should mark active tab with "active" class', () => {
    const { container } = render(
      React.createElement(MobileTabSelector, {
        activeStatus: 'Preparing',
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const preparingTab = container.querySelector('[data-status="Preparing"]');
    expect(preparingTab).toHaveClass('active');
  });

  it('should not mark inactive tabs with "active" class', () => {
    const { container } = render(
      React.createElement(MobileTabSelector, {
        activeStatus: 'Preparing',
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const receivedTab = container.querySelector('[data-status="Received"]');
    expect(receivedTab).not.toHaveClass('active');
  });

  it('should call onStatusChange when tab is clicked', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const readyTab = screen.getByRole('tab', { name: /Ready/ });
    fireEvent.click(readyTab);
    expect(mockOnStatusChange).toHaveBeenCalledWith('Ready');
  });

  it('should display order counts for each tab', () => {
    const { container } = render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });

  it('should handle zero count gracefully', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: {
          Received: 0,
          Preparing: 0,
          Ready: 0,
          Completed: 0,
          Cancelled: 0,
        },
      })
    );
    expect(screen.getAllByText('(0)').length).toBeGreaterThan(0);
  });

  it('should handle switching between multiple tabs', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const receivedTab = screen.getByRole('tab', { name: /Received/ });
    const readyTab = screen.getByRole('tab', { name: /Ready/ });

    fireEvent.click(readyTab);
    expect(mockOnStatusChange).toHaveBeenCalledWith('Ready');

    fireEvent.click(receivedTab);
    expect(mockOnStatusChange).toHaveBeenCalledWith('Received');
  });

  it('should have aria-selected attribute on active tab', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: 'Ready',
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const readyTab = screen.getByRole('tab', { name: /Ready/ });
    expect(readyTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should have aria-selected="false" on inactive tabs', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: 'Ready',
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const receivedTab = screen.getByRole('tab', { name: /Received/ });
    expect(receivedTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should have descriptive aria-labels', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const receivedTab = screen.getByRole('tab', { name: /Received.*4 orders/ });
    expect(receivedTab).toBeInTheDocument();
  });

  it('should support keyboard navigation (Enter key)', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const readyTab = screen.getByRole('tab', { name: /Ready/ });
    fireEvent.keyDown(readyTab, { key: 'Enter' });
    expect(mockOnStatusChange).toHaveBeenCalledWith('Ready');
  });

  it('should use button elements for accessibility', () => {
    const { container } = render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const buttons = container.querySelectorAll('button.mobile-tab');
    expect(buttons.length).toBe(5);
    buttons.forEach((btn) => {
      expect(btn.getAttribute('role')).toBe('tab');
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  it('should use tablist role for the container', () => {
    render(
      React.createElement(MobileTabSelector, {
        activeStatus: mockActiveStatus,
        onStatusChange: mockOnStatusChange,
        statusCounts: mockStatusCounts,
      })
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveClass('mobile-tab-selector');
  });

  it('should have displayName for debugging', () => {
    expect(MobileTabSelector.displayName).toBe('MobileTabSelector');
  });
});
