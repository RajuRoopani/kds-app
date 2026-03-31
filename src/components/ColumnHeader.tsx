/**
 * Kitchen Display System — Column Header Component
 *
 * Displays the status name and order count badge at the top of each kanban column.
 * The header is sticky (stays at top when column scrolls vertically).
 *
 * Props:
 * - status: OrderStatus — The column's status (Received, Preparing, Ready, Completed, Cancelled)
 * - count: number — The current number of orders in this status
 *
 * Design:
 * - Text: 16px bold, #1a1a1a
 * - Badge: 12px, background #f5f5f5, padding 2px 8px, border-radius 4px
 * - Sticky positioning
 * - Non-interactive (no buttons or click handlers)
 */

import React from 'react';
import type { OrderStatus } from '../types';

export interface ColumnHeaderProps {
  status: OrderStatus;
  count: number;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  status,
  count,
}) => {
  return (
    <div className="column-header" data-status={status}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
        }}
      >
        <span
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#1a1a1a',
          }}
        >
          {status}
        </span>
        <span
          className="count-badge"
          style={{
            fontSize: '12px',
            background: '#f5f5f5',
            padding: '2px 8px',
            borderRadius: '4px',
            color: '#666',
            minWidth: '24px',
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      </div>
    </div>
  );
};

ColumnHeader.displayName = 'ColumnHeader';
