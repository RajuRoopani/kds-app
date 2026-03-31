/**
 * Kitchen Display System — Kanban Board Component
 *
 * Renders the main kanban dashboard with 5 columns (Received, Preparing, Ready, Completed, Cancelled).
 * Handles:
 * - Responsive layout (desktop 5-column, mobile 1-column with tabs)
 * - Real-time order synchronization via order store
 * - Error banner for connection status
 * - Tab-based navigation on mobile
 *
 * Design:
 * - Desktop (>= 1024px): 5 columns side-by-side, horizontal scroll if needed
 * - Mobile (< 768px): 1 column at a time, tab navigation
 * - Auto-dismiss timers for Completed/Cancelled orders
 *
 * Integration:
 * - Subscribes to order store for real-time updates
 * - Renders CardContainer + ColumnHeader for each status
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { OrderStatus } from '../types';
import { useOrdersByStatus, useOrderMetrics } from '../hooks/useOrder';
import { ColumnHeader } from './ColumnHeader';
import { CardContainer } from './CardContainer';
import { MobileTabSelector } from './MobileTabSelector';
import '../styles/kanban.css';

export interface KanbanProps {
  isConnected: boolean;
  onOrderClick?: (orderId: string) => void;
}

const STATUS_ORDER: OrderStatus[] = [
  'Received',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
];

export const Kanban: React.FC<KanbanProps> = ({
  isConnected,
  onOrderClick,
}) => {
  // Mobile state: track active tab
  const [activeTab, setActiveTab] = useState<OrderStatus>('Received');
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  // Get orders for each status (subscribes to store)
  const receivedOrders = useOrdersByStatus('Received');
  const preparingOrders = useOrdersByStatus('Preparing');
  const readyOrders = useOrdersByStatus('Ready');
  const completedOrders = useOrdersByStatus('Completed');
  const cancelledOrders = useOrdersByStatus('Cancelled');

  // Get metrics for tab badges
  const metrics = useOrderMetrics();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map of status to orders
  const ordersByStatus: Record<OrderStatus, typeof receivedOrders> = {
    Received: receivedOrders,
    Preparing: preparingOrders,
    Ready: readyOrders,
    Completed: completedOrders,
    Cancelled: cancelledOrders,
  };

  // Render desktop layout (5 columns)
  const renderDesktopLayout = () => (
    <div className="kanban-content">
      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          className="kanban-column"
          data-status={status}
        >
          <ColumnHeader
            status={status}
            count={metrics.byStatus[status] || 0}
          />
          <CardContainer
            orders={ordersByStatus[status]}
            status={status}
            onOrderClick={onOrderClick}
          />
        </div>
      ))}
    </div>
  );

  // Render mobile layout (1 column + tabs)
  const renderMobileLayout = () => (
    <>
      <MobileTabSelector
        activeStatus={activeTab}
        onStatusChange={setActiveTab}
        statusCounts={metrics.byStatus}
      />
      <div
        className="kanban-content"
        style={{
          overflow: 'auto',
        }}
      >
        <div
          className="kanban-column"
          data-status={activeTab}
        >
          <ColumnHeader
            status={activeTab}
            count={metrics.byStatus[activeTab] || 0}
          />
          <CardContainer
            orders={ordersByStatus[activeTab]}
            status={activeTab}
            onOrderClick={onOrderClick}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="kanban-viewport">
      {/* Error banner for connection status */}
      {!isConnected && (
        <div
          id="error-banner"
          role="alert"
          aria-live="assertive"
          className="error-banner"
        >
          <span>⚠️ Connection lost — reconnecting…</span>
          <button
            id="error-banner-dismiss"
            aria-label="Dismiss connection error"
            className="error-banner-close"
          >
            ×
          </button>
        </div>
      )}

      {/* Main kanban layout */}
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
    </div>
  );
};

Kanban.displayName = 'Kanban';
