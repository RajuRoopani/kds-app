/**
 * Tests for ColumnHeader component
 *
 * ColumnHeader displays the status name and order count badge at the top of each kanban column.
 * It is sticky (stays at top when column scrolls vertically).
 *
 * Spec from DESIGN.md:
 * - Text: 16px bold, #1a1a1a
 * - Badge: 12px, background #f5f5f5, padding 2px 8px, border-radius 4px
 * - Sticky positioning
 * - Non-interactive (no buttons or click handlers)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { OrderStatus } from '../types';
import { ColumnHeader } from '../components/ColumnHeader';

describe('ColumnHeader', () => {
  let mockStatus: OrderStatus;
  let mockCount: number;

  beforeEach(() => {
    mockStatus = 'Received';
    mockCount = 4;
  });

  it('should render the status name', () => {
    render(React.createElement(ColumnHeader, { status: mockStatus, count: mockCount }));
    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('should render the order count', () => {
    render(React.createElement(ColumnHeader, { status: mockStatus, count: mockCount }));
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should render with data-status attribute', () => {
    const { container } = render(
      React.createElement(ColumnHeader, { status: mockStatus, count: mockCount })
    );
    const header = container.querySelector('[data-status="Received"]');
    expect(header).toBeInTheDocument();
  });

  it('should render with correct CSS classes', () => {
    const { container } = render(
      React.createElement(ColumnHeader, { status: mockStatus, count: mockCount })
    );
    const header = container.querySelector('.column-header');
    expect(header).toBeInTheDocument();
    const badge = container.querySelector('.count-badge');
    expect(badge).toBeInTheDocument();
  });

  it('should display count badge with correct content', () => {
    const { container } = render(
      React.createElement(ColumnHeader, { status: mockStatus, count: mockCount })
    );
    const badge = container.querySelector('.count-badge');
    expect(badge?.textContent).toBe('4');
  });

  it('should handle zero count', () => {
    render(React.createElement(ColumnHeader, { status: mockStatus, count: 0 }));
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle different statuses', () => {
    const statuses: OrderStatus[] = ['Received', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
    statuses.forEach((status) => {
      const { unmount } = render(
        React.createElement(ColumnHeader, { status, count: 5 })
      );
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle large count numbers', () => {
    render(React.createElement(ColumnHeader, { status: mockStatus, count: 999 }));
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('should have displayName for debugging', () => {
    expect(ColumnHeader.displayName).toBe('ColumnHeader');
  });

  it('should not be interactive (no onClick handlers)', () => {
    const { container } = render(
      React.createElement(ColumnHeader, { status: mockStatus, count: mockCount })
    );
    const header = container.querySelector('.column-header');
    expect(header?.querySelector('button')).not.toBeInTheDocument();
  });
});
