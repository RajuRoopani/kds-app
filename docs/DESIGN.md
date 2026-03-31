# Kitchen Display System (KDS) — UX Design

## User Story
As a kitchen staff member, I want to see incoming orders in real-time across a kanban-style display grouped by status, with one-click actions to transition orders through their lifecycle, so that I can efficiently manage order flow and fulfill orders without missing or duplicating work.

---

## User Flow

```
User opens KDS
    ↓
[WebSocket connects]
    ↓
5-column kanban appears (Received | Preparing | Ready | Completed | Cancelled)
    ↓
Orders stream in via WS (prepended to Received column)
    ↓
[User clicks order card] → Detail modal opens
    ↓
[User clicks action button: Accept] → Order transitions to Preparing
                          Ready  → Order transitions to Ready
                          Complete → Order transitions to Completed
                          Cancel → Order transitions to Cancelled (with confirmation)
    ↓
Modal closes → Column updates in real-time
    ↓
[Connection lost] → Error banner appears (Connection lost—reconnecting…)
                  → Orders still visible (cached)
                  → User can still click cards but actions disabled
    ↓
[Connection restored] → Error banner dismisses
                      → List syncs with backend
```

---

## Screens & Wireframes

### Screen: Kanban Dashboard (Desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Kitchen Display System                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [⚠️  Connection lost—reconnecting…]  [← dismiss]                              │
├──────────────────────────────────────────────────────────────────────────────┤
│
│  Received (4)         │  Preparing (2)     │  Ready (5)        │  Completed   │ Cancelled
│  ─────────────────────┼────────────────────┼──────────────────┼──────────────┼─────────────
│                       │                    │                  │              │
│ ┌───────────────────┐ │ ┌────────────────┐ │ ┌──────────────┐  │ ┌──────────┐ │ ┌────────┐
│ │ #12847            │ │ │ #12835         │ │ │ #12822       │  │ │ #12810   │ │ #12798  │
│ │ John Smith        │ │ │ Emily Davis    │ │ │ Mike Brown   │  │ │ Sarah J. │ │ (none)  │
│ │ Burger, Fries     │ │ │ Pizza, Salad   │ │ │ Wings, Fries │  │ │ Pasta    │ │         │
│ │ 14:32             │ │ │ 14:29          │ │ │ 14:15        │  │ │ 14:08    │ │         │
│ │                   │ │ │                │ │ │              │  │ │          │ │         │
│ │ [Accept]          │ │ │ [Ready] [Cancel]│ │ │ [Complete]   │  │ [Reopen]  │ │         │
│ └───────────────────┘ │ └────────────────┘ │ └──────────────┘  │ └──────────┘ │         │
│                       │                    │                  │              │
│ ┌───────────────────┐ │                    │ ┌──────────────┐  │              │         │
│ │ #12846            │ │                    │ │ #12821       │  │              │         │
│ │ David Lee         │ │                    │ │ Lisa Wong    │  │              │         │
│ │ Chicken, Rice     │ │                    │ │ Fish, Chips  │  │              │         │
│ │ 14:30             │ │                    │ │ 14:14        │  │              │         │
│ │                   │ │                    │ │              │  │              │         │
│ │ [Accept]          │ │                    │ │ [Complete]   │  │              │         │
│ └───────────────────┘ │                    │ └──────────────┘  │              │         │
│                       │                    │                  │              │         │
│ [more cards scroll]   │ [more cards]       │ [more cards]      │ [full]       │ [empty] │
│                       │                    │                  │              │         │
└───────────────────────┴────────────────────┴──────────────────┴──────────────┴─────────────┘

Legend:
- 5 columns side-by-side, fixed width each
- Column headers show status + order count
- Cards are clickable to open detail modal
- Cards auto-update on WS message (status change, new order)
- Columns scroll independently if content overflows (default: none expected in MVP)
```

### Screen: Order Detail Modal (Triggered by Card Click)

```
┌─────────────────────────────────────────────────────────────────┐
│ Order #12847                                                  [✕] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Customer: John Smith                                             │
│                                                                  │
│ Items:                                                           │
│   • Burger (medium)                                              │
│   • Fries (regular)                                              │
│   • Coke (large)                                                 │
│                                                                  │
│ Status: Received                                                 │
│ Received at: 14:32:15                                            │
│                                                                  │
│ ─────────────────────────────────────────────────────────────────│
│                                                                  │
│ [Accept]       [Ready]        [Complete]      [Cancel]          │
│ (enabled)      (disabled)     (disabled)      (enabled)          │
│                                                                  │
│ [Note: Only available actions per status shown]                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Behavior:
- Modal is centered, max-width 500px (approx 1/4 of 1920px desktop)
- Appears with fade-in (200ms) + slight scale (98→100%)
- Buttons change enabled/disabled per order status (see Component Specs)
- Clicking outside modal or [✕] closes without saving
- Actions submit immediately to backend (no "Save" button)
```

### Screen: Mobile/Tablet Portrait (<1024px — Vertical Stack)

```
┌──────────────────────────────────┐
│ Kitchen Display System            │
├──────────────────────────────────┤
│ [⚠️  Connection lost—reconnecting]│
├──────────────────────────────────┤
│
│ Received (4)
│ ──────────────────────────────────
│ ┌────────────────────────────────┐
│ │ #12847 | John Smith            │
│ │ Burger, Fries | 14:32          │
│ │ [Action Menu ▼]                │
│ └────────────────────────────────┘
│ ┌────────────────────────────────┐
│ │ #12846 | David Lee             │
│ │ Chicken, Rice | 14:30          │
│ │ [Action Menu ▼]                │
│ └────────────────────────────────┘
│
│ Preparing (2)
│ ──────────────────────────────────
│ ┌────────────────────────────────┐
│ │ #12835 | Emily Davis           │
│ │ Pizza, Salad | 14:29           │
│ │ [Action Menu ▼]                │
│ └────────────────────────────────┘
│ [more...]
│
│ Ready (5)
│ ──────────────────────────────────
│ [scrollable list]
│
│ Completed
│ ──────────────────────────────────
│ [scrollable list]
│
│ Cancelled
│ ──────────────────────────────────
│ (No orders)
│
└──────────────────────────────────┘

Behavior:
- Vertical sections (collapsible or not TBD with EM)
- Each card shows order ID, customer, items, time on one line (truncated with …)
- Click card to open modal (same as desktop)
- Tap [Action Menu ▼] to show quick-action buttons inline (Accept, Ready, Complete, Cancel)
```

### Screen: Empty State

```
Column with no orders:
┌──────────────────┐
│  Ready           │
│  (0 orders)      │
├──────────────────┤
│                  │
│  No orders yet.  │
│                  │
│  New orders will │
│  appear here.    │
│                  │
└──────────────────┘
```

### Screen: Error Banner (Connection Lost)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠️  Connection lost—reconnecting…   [← Dismiss]                      │
└──────────────────────────────────────────────────────────────────────┘

Position: Fixed top of viewport (below any app header)
Background: #fff3cd (yellow/warning)
Text color: #856404 (dark brown)
Height: 44px
Padding: 12px 16px
Border-bottom: 1px solid #ffeaa7

Dismiss button:
- Right-aligned
- Text: "← Dismiss" or icon: ✕
- Clicking removes banner from DOM
- Banner auto-reappears if connection is still lost after 3 seconds

Animation:
- Slide in from top (200ms, ease-out)
- Slide out on dismiss (150ms, ease-in)
```

---

## Component Specs

### Order Card (Kanban Column)

| Property | Value |
|----------|-------|
| **Dimensions** | Variable width per column (see Responsive section); min-height 140px |
| **Background** | #ffffff |
| **Border** | 1px solid #e0e0e0 |
| **Border-radius** | 8px |
| **Padding** | 16px |
| **Box-shadow** | 0 2px 8px rgba(0,0,0,0.1) (default); 0 4px 12px rgba(0,0,0,0.15) (hover) |
| **Font** | 14px / 1.4 (body); 16px bold (order ID); 13px muted (timestamp) |
| **Cursor** | pointer |

**States:**
- **Default:** Background #fff, shadow light, text #333
- **Hover:** Slight shadow elevation, background #fafafa, cursor pointer
- **Active (just clicked):** Border color #2196f3, shadow elevated 0 6px 16px rgba(0,0,0,0.15)
- **Loading (action in progress):** Opacity 0.6, cursor not-allowed

**Content Layout:**
```
┌─────────────────────────────────┐
│ #12847 (16px bold, #1a1a1a)     │
│                                 │
│ John Smith (14px, #555)         │
│ Burger, Fries (13px, #999)      │
│                                 │
│ 14:32 (11px, muted, right-align)│
└─────────────────────────────────┘
```

---

### Detail Modal

| Property | Value |
|----------|-------|
| **Trigger** | Click on order card |
| **Width** | max-width 500px on desktop; 90vw on mobile |
| **Position** | Center of viewport (fixed overlay) |
| **Background** | #ffffff |
| **Border-radius** | 12px |
| **Box-shadow** | 0 10px 40px rgba(0,0,0,0.2) |
| **Z-index** | 1000 |
| **Overlay** | Darkened background (rgba(0,0,0,0.5)) |

**Animation:**
- Fade-in overlay: 200ms ease-out
- Modal slide-up: 200ms ease-out (from bottom 20px → final position)

**Close:**
- Click [✕] button (top-right)
- Click overlay (outside modal)
- Press Escape key
- Action submitted → auto-close after 500ms

**Content:**
- Order ID (16px bold)
- Customer name (14px)
- Items list (13px, bullet points)
- Current status (14px bold, color-coded per status)
- Timestamp (12px muted)
- Action buttons (see below)

---

### Action Buttons (in Modal)

| Button | Enabled States | Disabled States | Action |
|--------|---|---|---|
| **Accept** | Received | Preparing, Ready, Completed, Cancelled | Move order to Preparing |
| **Ready** | Preparing | Received, Ready, Completed, Cancelled | Move order to Ready |
| **Complete** | Ready | Received, Preparing, Completed, Cancelled | Move order to Completed |
| **Cancel** | Received, Preparing, Ready | Completed, Cancelled | Move order to Cancelled (with confirmation) |

**Button Style:**
- 44px height (touch-friendly)
- 16px padding horizontal
- 14px font bold
- Border-radius 6px
- Transition: 150ms ease

**States:**
- **Enabled:** Background #2196f3, text white, cursor pointer, hover: bg #1976d2, shadow elevation
- **Disabled:** Background #e0e0e0, text #999, cursor not-allowed, opacity 0.6
- **Loading:** Background #1976d2, text white + spinner icon (animated)
- **Error:** Background #f44336, text white (shown if action fails)

**Layout:**
- Flex row, space-around, margin-top 24px
- On mobile (<600px): stack vertically, full-width buttons

---

### Column Header

```
Received (4)
───────────────

Text: 16px bold, #1a1a1a
Badge: 12px, background #f5f5f5, padding 2px 8px, border-radius 4px
Count: 14px regular, #666
```

**Behavior:**
- Header is sticky (stays at top when column scrolls vertically)
- Count updates in real-time as orders move between columns
- No interaction (non-clickable header)

---

### Error Banner

| Property | Value |
|----------|-------|
| **Position** | Fixed top of page (below app header if exists) |
| **Width** | 100vw |
| **Height** | 44px |
| **Background** | #fff3cd |
| **Border-bottom** | 1px solid #ffeaa7 |
| **Text** | #856404, 14px |
| **Icon** | ⚠️ (unicode) |
| **Z-index** | 999 |

**Animation:**
- Slide in from top: 200ms cubic-bezier(0.4, 0, 0.2, 1)
- Slide out: 150ms ease-in

**Dismiss Button:**
- Text-only: "← Dismiss" or icon [✕]
- Float right, 12px padding
- Cursor: pointer
- Hover: opacity 0.8
- Click: removes banner, does NOT reload data

**Auto-reappear:**
- If connection is still lost 3 seconds after dismiss, banner reappears

---

## Responsive Breakpoints & Layout

### Desktop (≥1024px)
- **Layout:** 5-column kanban, side-by-side
- **Column width:** calc((100vw - 32px) / 5) = ~376px per column on 1920px screen
- **Gap:** 16px between columns
- **Card dimensions:** Full column width - padding
- **Modal width:** max-width 500px
- **Overflow:** If a column exceeds viewport height, internal scroll appears (overflow-y: auto, max-height: calc(100vh - 200px))

### Tablet (768px – 1023px)
- **Layout:** 5 columns still side-by-side (may require horizontal scroll if screen <768px width)
- **Column width:** calc((100vw - 32px) / 5)
- **Card dimensions:** Slightly smaller fonts (13px body, 14px IDs)
- **Modal:** max-width 90vw
- **Gap:** 12px

### Mobile/Tablet Portrait (<768px)
- **Layout:** Vertical stack (1 column per section)
- **Column width:** 100% - 16px padding
- **Card style:** Horizontal layout (ID | Customer on one line, Items | Time on second line, Action Menu)
- **Card height:** ~70px each
- **Modal:** 90vw width, 95vh max-height
- **Action buttons:** Stack vertically, full-width (44px height each)

---

## Interaction Notes

### Loading States
- **When modal opens:** Show skeleton loader for 200ms (optional—WS should have data cached)
- **When action button clicked:** Button shows spinner icon, text dims to 0.7 opacity, all buttons disabled
- **When action completes:** Button returns to normal (1-2 second animation)
- **If action fails:** Error message in red toast appears for 4 seconds

### Hover & Focus
- **Card hover:** Slight shadow elevation, background #fafafa
- **Button hover:** Darker background, shadow elevation
- **Button focus (keyboard):** Outline 2px solid #2196f3, offset 2px (accessibility)
- **Modal overlay focus:** None (overlay is not interactive)

### Empty State
- **Column with no orders:** Centered "No orders yet." text, 14px, #999
- **Entire dashboard empty:** Show all 5 empty columns, banner "Waiting for orders..."

### Success Feedback
- **After action succeeds:** Toast notification (top-right, 3 seconds, green #4caf50) with message: "Order #12847 moved to Preparing"
- **Modal auto-closes:** 500ms after action success
- **Card animates:** Slight fade-out (150ms) before moving to new column in real-time

### Connection Restored Feedback
- **Error banner dismisses** automatically when WS reconnects
- **No explicit notification** (disappearance of warning is the signal)
- **Data syncs silently** (orders may reorder if backend state changed)

### Cancel Action Confirmation
- **User clicks [Cancel] button** → Modal shows inline confirmation:
  ```
  Are you sure you want to cancel order #12847?
  [No, keep it]  [Yes, cancel]
  ```
- **User clicks [Yes, cancel]** → Order moves to Cancelled column
- **User clicks [No, keep it]** → Confirmation dismissed, modal returns to normal

---

## Color & Typography

### Color Palette
- **Primary action:** #2196f3 (blue) — used for [Accept], [Ready], [Complete] buttons
- **Destructive action:** #f44336 (red) — used for error states and [Cancel] confirmation
- **Success:** #4caf50 (green) — used for success toast
- **Warning:** #fff3cd (light yellow) + #856404 (dark brown) — used for connection error banner
- **Neutral text:** #1a1a1a (dark gray) — headings, order IDs
- **Muted text:** #999 (medium gray) — secondary info (customer name, items, timestamp)
- **Borders:** #e0e0e0 (light gray) — card borders
- **Backgrounds:** #ffffff (white), #fafafa (light gray hover)

### Typography
- **Font family:** -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Heading (Order ID):** 16px bold, #1a1a1a
- **Body (customer, items):** 14px regular, #555
- **Label (status, time):** 13px regular, #999
- **Small (count badge):** 12px regular, #666
- **Button text:** 14px bold, white on colored bg

### Spacing Unit
- **Base:** 8px (used for all padding/margin calculations)
- **Card padding:** 16px (2 units)
- **Column gap:** 16px (2 units)
- **Modal padding:** 24px (3 units)
- **Button height:** 44px (min touch target)

---

## DOM ID Reference (for JS Binding)

Frontend developers will use these IDs for state management and event binding:

```
#kds-dashboard               (root container)
#error-banner                (connection error banner)
#error-banner-dismiss        (dismiss button)
.kanban-column[data-status]  (5 columns: data-status="received|preparing|ready|completed|cancelled")
.order-card[data-order-id]   (individual cards)
#detail-modal                (modal overlay)
#modal-content               (modal body)
#modal-close                 (✕ button)
#order-details               (order info section)
.modal-action-btn[data-action] (buttons: data-action="accept|ready|complete|cancel")
#cancel-confirmation         (inline confirmation for cancel action)
#cancel-confirm-yes          (confirm cancel button)
#cancel-confirm-no           (reject cancel button)
```

---

## Open Questions
- [ ] **Auto-scroll behavior:** When a new order arrives in Received column, should the column auto-scroll to show it, or stay in place? → Product Owner decision
- [ ] **Column collapsing:** On mobile, should Completed/Cancelled columns be collapsible by default? → Product Owner decision
- [ ] **Sound/visual cue:** Should a new order trigger a chime/animation? (out of MVP scope but noted for future) → Product Owner decision
- [ ] **Order count badge:** Should the count include only visible orders or all (including off-screen)? → Product Owner decision (assume all for MVP)
- [ ] **Dark mode:** Desktop-first for MVP; dark mode out of scope but design should use semantic colors for future support → Architect decision

---

## Accessibility (WCAG 2.1 AA)

- **Color contrast:** All text meets 4.5:1 ratio (body), 3:1 (UI components)
- **Touch targets:** All buttons and cards ≥44x44px
- **Keyboard navigation:** Tab through cards and buttons; Enter/Space to activate; Escape to close modal
- **ARIA labels:** Buttons have aria-label; modal has role="dialog" aria-modal="true"; card has role="button" tabindex="0"
- **Focus indicators:** 2px solid outline on all interactive elements
- **Semantic HTML:** Use `<button>` for actions, `<section>` for columns, `<article>` for cards

---

## Notes for Developers

1. **WebSocket integration:** Expect WS messages in format:
   ```json
   { "type": "order_update", "order_id": "12847", "status": "Preparing", "timestamp": "2024-01-15T14:32:15Z" }
   { "type": "order_created", "order": { "id": "12847", "customer": "John Smith", "items": ["Burger", "Fries"], "status": "Received", ... } }
   ```

2. **State management:** Keep orders in memory by status (5 arrays). On WS update, move order between arrays and trigger re-render.

3. **Responsive:** Use CSS media queries or JS to detect viewport and switch between kanban (desktop) and vertical stack (mobile) layouts.

4. **Error handling:** If action fails (e.g., "Order no longer exists"), show inline error in modal and keep button enabled for retry.

5. **Offline resilience:** If WS disconnects, keep last known state visible. On reconnect, fetch full state from backend to reconcile any changes.

6. **Performance:** Virtualize long lists on mobile (consider if >100 orders per column). Kanban desktop should handle 50 orders per column without lag.

---

## Design Decisions (Why These Choices)

1. **Kanban layout over list:** Kitchen staff need to glance at all statuses at once. Kanban provides visual separation and prevents missed orders. Status grouping is more scannable than a timeline.

2. **Real-time card updates:** WebSocket push ensures sub-second latency. Order appears immediately when accepted, reducing cognitive load on staff ("Did my action work?").

3. **Modal for details over inline expansion:** Prevents dashboard clutter. Staff can review full details (items list, timing) without expanding the entire card.

4. **3-foot readability:** Large text (16px IDs, 14px body) ensures legibility from kitchen distance. High contrast (dark text on white) reduces eye strain under fluorescent lights.

5. **One-click status transitions:** No multi-step workflows. Staff move through Accept → Ready → Complete in seconds. Cancel has confirmation (higher consequence).

6. **Non-dismissing error banner:** Connection loss is critical. Banner stays visible (non-intrusive at top) until fixed. Auto-reappear prevents staff from forgetting about it.

7. **Mobile vertical stack:** Kitchen tablets in portrait mode benefit from vertical scrolling (familiar pattern) over horizontal scrolling. Action menu keeps workflow consistent.

---

**Design Doc Version:** 1.0  
**Last Updated:** [Current Date]  
**Owned by:** UX Engineer (Team Claw)  
**Status:** Ready for Development
