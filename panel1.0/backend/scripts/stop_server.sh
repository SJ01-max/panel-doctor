#!/bin/bash
echo "[ApplicationStop] 🛑 Stopping Flask server..."
pkill -f "python3 main.py" || true
echo "[ApplicationStop] ✅ Flask server stopped."
