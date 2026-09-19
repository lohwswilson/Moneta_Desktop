#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Ensure Vite dev server is running
if ! curl -s http://127.0.0.1:5173 > /dev/null; then
  echo "Starting Moneta background server..."
  npm run dev -- --host 127.0.0.1 --port 5173 &
  sleep 2
fi

echo "Launching Moneta Wealth Application..."

# Check if native Tauri binary exists
if [ -f "src-tauri/target/release/moneta_wealth" ]; then
  ./src-tauri/target/release/moneta_wealth
elif [ -f "src-tauri/target/release/moneta_desktop" ]; then
  ./src-tauri/target/release/moneta_desktop
elif [ -d "/Applications/Google Chrome.app" ]; then
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="http://localhost:5173" --window-size=1200,800 &
else
  open "http://localhost:5173"
fi
