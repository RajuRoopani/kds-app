/**
 * Kitchen Display System — Action Buttons Component
 *
 * Displays context-aware action buttons based on order status.
 * Handles:
 * - Button visibility per status (Accept/Ready/Complete/Cancel/Dismiss)
 * - Disabled state during action dispatch
 * - Error handling with retry
 * - Auto-dismiss countdown (Completed 5s, Cancelled 10s)
 *
 * Design:
 * - 44px height (touch-friendly)
 * - Primary blue (#2196f3) for main actions
 * - Red (#f44336) for destructive actions
 * - Disabled gray (#e0e0e0)
 * - Spinner + "Sending..." during dispatch
 * - Error state shows [Retry] button
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Order, OrderStatus } from '../types';
import { useOrderAction } from '../hooks/useOrder';
import styles from './ActionButtons.module.css';

interface ActionButtonsProps {
  order: Order;
  onActionSuccess?: () => void; // Called after successful action
  onActionError?: (error: string) => void; // Called on error
}

/**
 * Determine which buttons should be visible for a given status
 */
function getAvailableActions(status: OrderStatus): Array<{
  action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL' | 'DISMISS';
  label: string;
  variant: 'primary' | 'secondary' | 'destructive';
}> {
  switch (status) {
    case 'Received':
      return [
        { action: 'ACCEPT', label: 'Accept', variant: 'primary' },
        { action: 'CANCEL', label: 'Decline', variant: 'secondary' },
      ];
    case 'Preparing':
      return [
        { action: 'READY', label: 'Mark Ready', variant: 'primary' },
        { action: 'CANCEL', label: 'Cancel', variant: 'destructive' },
      ];
    case 'Ready':
      return [
        { action: 'COMPLETE', label: 'Mark Complete', variant: 'primary' },
        { action: 'CANCEL', label: 'Cancel', variant: 'destructive' },
      ];
    case 'Completed':
      return [
        { action: 'DISMISS', label: 'Dismiss', variant: 'secondary' },
      ];
    case 'Cancelled':
      return [
        { action: 'DISMISS', label: 'Dismiss', variant: 'secondary' },
      ];
    default:
      return [];
  }
}

/**
 * Action Buttons Component
 */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
  order,
  onActionSuccess,
  onActionError,
}) => {
  const { error, isLoading, dispatch, retry, clearError } = useOrderAction();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [dismissCountdown, setDismissCountdown] = useState<number | null>(null);

  // Auto-dismiss countdown for Completed/Cancelled orders
  useEffect(() => {
    if (order.status === 'Completed' || order.status === 'Cancelled') {
      const delayMs = order.status === 'Completed' ? 5000 : 10000;
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, delayMs - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        setDismissCountdown(seconds);

        if (seconds <= 0) {
          clearInterval(interval);
          setDismissCountdown(null);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [order.status]);

  // Handle action button click
  const handleActionClick = useCallback(
    async (
      action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL' | 'DISMISS'
    ) => {
      // Handle DISMISS specially (just closes modal, doesn't dispatch)
      if (action === 'DISMISS') {
        onActionSuccess?.();
        return;
      }

      // Handle CANCEL with confirmation
      if (action === 'CANCEL' && !cancelConfirm) {
        setCancelConfirm(true);
        return;
      }

      // Dispatch action
      clearError();
      const result = await dispatch(order.orderId, action);

      if (result.success) {
        onActionSuccess?.();
      } else {
        onActionError?.(result.error || 'Action failed');
      }
    },
    [order.orderId, dispatch, clearError, cancelConfirm, onActionSuccess, onActionError]
  );

  // Handle retry button
  const handleRetry = useCallback(
    async (action: 'ACCEPT' | 'READY' | 'COMPLETE' | 'CANCEL') => {
      clearError();
      const result = await retry(order.orderId, action);

      if (result.success) {
        onActionSuccess?.();
      } else {
        onActionError?.(result.error || 'Action failed');
      }
    },
    [order.orderId, retry, clearError, onActionSuccess, onActionError]
  );

  // If cancel confirmation is shown, render confirmation dialog
  if (cancelConfirm) {
    return (
      <div className={styles.confirmationDialog} id="cancel-confirmation">
        <p>Are you sure you want to cancel order #{order.orderId}?</p>
        <div className={styles.confirmationButtons}>
          <button
            className={`${styles.button} ${styles.secondary}`}
            onClick={() => setCancelConfirm(false)}
            id="cancel-confirm-no"
          >
            No, Keep It
          </button>
          <button
            className={`${styles.button} ${styles.destructive}`}
            onClick={() => handleActionClick('CANCEL')}
            id="cancel-confirm-yes"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    );
  }

  // If error is shown and waiting for 5s timeout, render error + retry
  if (error) {
    const availableActions = getAvailableActions(order.status);
    const failedAction = availableActions.find(
      (a) => a.action !== 'DISMISS'
    )?.action;

    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          <span>❌ {error}</span>
        </div>
        {failedAction && (
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={() => handleRetry(failedAction)}
            disabled={isLoading}
          >
            {isLoading ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    );
  }

  const availableActions = getAvailableActions(order.status);

  // Render action buttons
  return (
    <div className={styles.buttonGroup}>
      {availableActions.map(({ action, label, variant }) => (
        <button
          key={action}
          className={`${styles.button} ${styles[variant]}`}
          disabled={isLoading || order.isLoading}
          onClick={() => handleActionClick(action)}
          data-action={action}
          aria-label={`${label} for order ${order.orderId}`}
        >
          {isLoading || order.isLoading ? (
            <>
              <span className={styles.spinner}></span>
              {action === 'DISMISS' && dismissCountdown && dismissCountdown > 0
                ? `Dismissing in ${dismissCountdown}s`
                : 'Sending...'}
            </>
          ) : (
            label
          )}
        </button>
      ))}

      {/* Auto-dismiss countdown display */}
      {(order.status === 'Completed' || order.status === 'Cancelled') &&
        dismissCountdown &&
        dismissCountdown > 0 && (
          <div className={styles.dismissCountdown}>
            Removing in {dismissCountdown}s…
          </div>
        )}
    </div>
  );
};

ActionButtons.displayName = 'ActionButtons';
