#!/bin/bash
set -e
echo "[ApplicationStop] 🛑 Stopping running frontend server..."

pkill -f "node server.js" || true
pkill -f "vite" || true

echo "[ApplicationStop] ✅ Frontend server stopped successfully."
