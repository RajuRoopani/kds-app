# Mock Backend Quick Start

> **For Phase 2 frontend development — use this to get your local environment running in 2 minutes.**

---

## TL;DR

```bash
# Terminal 1: Start mock backend
cd kds-mock-backend
npm install
npm start

# Terminal 2: Start React app
cd kds_app
npm start

# Done. Orders stream in. Click buttons to transition them.
```

---

## What You'll See

✅ New orders appear in **Received** column every 3–5 seconds  
✅ Click [Accept] → order moves to **Preparing**  
✅ Auto-transitions: Preparing (8s) → Ready (6s) → Completed (5s)  
✅ Completed orders auto-dismiss after 5 seconds  

---

## One-Liner Setup (Mac/Linux)

```bash
# Inside /workspace
(cd kds-mock-backend && npm install && npm start &) && (cd kds_app && npm start)
```

---

## Debugging

**See all WebSocket messages:**
```bash
VERBOSE=true npm start  # in kds-mock-backend/
```

**Browser DevTools:**
1. Open DevTools → Network tab
2. Filter type: "WS"
3. Click `wss://localhost:5000/orders`
4. View "Messages" tab

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `EADDRINUSE` (port 5000 taken) | Kill process: `lsof -i :5000 \| tail -1 \| awk '{print $2}' \| xargs kill -9` |
| `Cannot find module 'ws'` | Run `npm install` in `kds-mock-backend/` |
| Frontend says "connection refused" | Make sure mock backend is running first |
| Orders not appearing | Check browser console for errors; enable `VERBOSE=true` |

---

## For More Info

See `/kds-mock-backend/README.md` (full documentation)  
See `/kds_app/docs/adr/ADR-004-mock-websocket-backend.md` (why we chose this)

