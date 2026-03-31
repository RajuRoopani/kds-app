/**
 * Tests for Kanban Component
 * 
 * Coverage:
 * - Desktop layout rendering (5 columns)
 * - Mobile layout rendering (tabs + 1 column)
 * - Responsive behavior
 * - Connection status banner
 * - Tab switching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Kanban } from '../components/Kanban';

// Mock the useOrdersByStatus and useOrderMetrics hooks
vi.mock('../hooks/useOrder', () => ({
  useOrdersByStatus: (status: string) => {
    if (status === 'Received') return [
      {
        orderId: '1',
        customerName: 'John',
        items: [],
        status: 'Received',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    return [];
  },
  useOrderMetrics: () => ({
    total: 1,
    byStatus: {
      Received: 1,
      Preparing: 0,
      Ready: 0,
      Completed: 0,
      Cancelled: 0,
    },
    avgWaitTime: 0,
  }),
}));

describe('Kanban - Desktop Layout', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    mockOnOrderClick = vi.fn();
  });

  it('should render all 5 columns on desktop', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('should not show mobile tabs on desktop', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    // Mobile tab selector should not be present
    const tablist = screen.queryByRole('tablist');
    expect(tablist).not.toBeInTheDocument();
  });

  it('should render kanban-content with desktop layout class', () => {
    const { container } = render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const content = container.querySelector('.kanban-content');
    expect(content).toBeInTheDocument();
  });
});

describe('Kanban - Mobile Layout', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    mockOnOrderClick = vi.fn();
  });

  it('should render mobile tab selector on mobile', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
  });

  it('should show 5 tabs for each status', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);
    expect(tabs[0]).toHaveAttribute('aria-label', expect.stringContaining('Received'));
    expect(tabs[1]).toHaveAttribute('aria-label', expect.stringContaining('Preparing'));
    expect(tabs[2]).toHaveAttribute('aria-label', expect.stringContaining('Ready'));
    expect(tabs[3]).toHaveAttribute('aria-label', expect.stringContaining('Completed'));
    expect(tabs[4]).toHaveAttribute('aria-label', expect.stringContaining('Cancelled'));
  });

  it('should show only one column on mobile', () => {
    const { container } = render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const columns = container.querySelectorAll('.kanban-column');
    expect(columns.length).toBe(1);
  });

  it('should switch columns when tab is clicked', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    // Initially should show Received (first tab active)
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    
    // Click Preparing tab
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  });
});

describe('Kanban - Connection Status', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    mockOnOrderClick = vi.fn();
  });

  it('should show error banner when disconnected', () => {
    render(
      <Kanban
        isConnected={false}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Connection lost/);
  });

  it('should not show error banner when connected', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const banner = screen.queryByRole('alert');
    expect(banner).not.toBeInTheDocument();
  });

  it('should have proper accessibility for error banner', () => {
    render(
      <Kanban
        isConnected={false}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('Kanban - Responsive Behavior', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOrderClick = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should switch from desktop to mobile on resize', async () => {
    // Start with desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    
    const { rerender, container } = render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    // Should show all 5 columns
    let columns = container.querySelectorAll('.kanban-column');
    expect(columns.length).toBe(5);
    
    // Simulate resize to mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    fireEvent.resize(window);
    
    rerender(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    // Should now show mobile tabs and 1 column
    const tabs = screen.getByRole('tablist');
    expect(tabs).toBeInTheDocument();
    
    columns = container.querySelectorAll('.kanban-column');
    expect(columns.length).toBe(1);
  });
});

describe('Kanban - Column Headers', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    mockOnOrderClick = vi.fn();
  });

  it('should show count badge for each column', () => {
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    // Each status should have a count badge
    const badges = screen.getAllByText('1'); // Received has 1 order
    expect(badges.length).toBeGreaterThan(0);
  });
});

describe('Kanban - Accessibility', () => {
  let mockOnOrderClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1400,
    });
    mockOnOrderClick = vi.fn();
  });

  it('should have proper viewport structure', () => {
    const { container } = render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const viewport = container.querySelector('.kanban-viewport');
    expect(viewport).toBeInTheDocument();
  });

  it('should have proper region labels in mobile', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    render(
      <Kanban
        isConnected={true}
        onOrderClick={mockOnOrderClick}
      />
    );
    
    const regions = screen.getAllByRole('region');
    expect(regions.length).toBeGreaterThan(0);
  });
});
