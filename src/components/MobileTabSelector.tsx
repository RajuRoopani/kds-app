/**
 * Kitchen Display System — Mobile Tab Selector Component
 *
 * Renders 5 tabs for switching between order statuses on mobile/tablet (<768px breakpoint).
 * Each tab shows the status name and order count badge.
 * The active tab has bold text, dark color, and a blue border-bottom indicator.
 *
 * Props:
 * - activeStatus: OrderStatus — Currently selected tab
 * - onStatusChange: (status: OrderStatus) => void — Callback when tab is clicked
 * - statusCounts: Record<OrderStatus, number> — Order count for each status (for badges)
 *
 * Design (from DESIGN.md + kanban.css):
 * - 5 tabs: Received | Preparing | Ready | Completed | Cancelled
 * - Active tab: bold text, #1a1a1a, border-bottom #2196f3 (3px)
 * - Inactive: #999 text, no border
 * - Hover: background #f5f5f5
 * - Each tab shows count badge (12px font)
 * - Flex layout, scrollable if needed (overflow-x: auto)
 * - Sticky positioning at top on mobile
 */

import React, { useCallback } from 'react';
import type { OrderStatus } from '../types';

export interface MobileTabSelectorProps {
  activeStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  statusCounts: Record<OrderStatus, number>;
}

const TAB_STATUSES: OrderStatus[] = [
  'Received',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
];

export const MobileTabSelector: React.FC<MobileTabSelectorProps> = ({
  activeStatus,
  onStatusChange,
  statusCounts,
}) => {
  const handleTabClick = useCallback(
    (status: OrderStatus) => {
      onStatusChange(status);
    },
    [onStatusChange]
  );

  return (
    <div className="mobile-tab-selector" role="tablist" aria-label="Order status tabs">
      {TAB_STATUSES.map((status) => (
        <button
          key={status}
          role="tab"
          aria-selected={status === activeStatus}
          aria-label={`${status} (${statusCounts[status] || 0} orders)`}
          className={`mobile-tab ${status === activeStatus ? 'active' : ''}`}
          onClick={() => handleTabClick(status)}
          data-status={status}
          type="button"
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: status === activeStatus ? 'bold' : 'normal',
              color: status === activeStatus ? '#1a1a1a' : '#999',
              transition: 'all 150ms ease',
            }}
          >
            {status}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: status === activeStatus ? '#1a1a1a' : '#999',
              transition: 'all 150ms ease',
              marginLeft: '4px',
            }}
          >
            ({statusCounts[status] || 0})
          </span>
        </button>
      ))}
    </div>
  );
};

MobileTabSelector.displayName = 'MobileTabSelector';
