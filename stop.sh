#!/usr/bin/env bash
# ==============================================================================
# DeepInterview — Unified Stop Script
# Stops:
#   1. Host background services (Agent API, Voice Worker, Next.js Web)
#   2. Docker containers (livekit-server, kokoro-tts, whisper-stt)
# ==============================================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$REPO_ROOT/.logs/pids"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}=====================================================${NC}"
echo -e "${BOLD}${BLUE}   Stopping E2E-InterviewByte Stack                 ${NC}"
echo -e "${BOLD}${BLUE}=====================================================${NC}"

# Stop background host processes
if [ -f "$PID_FILE" ]; then
  echo -e "Stopping host processes recorded in PID file..."
  while read -r pid; do
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# Extra cleanup for ports 8000, 8002, 8003, and 3000
echo -e "Freeing ports 8000, 8002, 8003, and 3000..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :8002 | xargs kill -9 2>/dev/null || true
lsof -ti :8003 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Stop Docker containers
echo -e "Stopping Docker containers (livekit-server, kokoro-tts, whisper-stt)..."
docker stop livekit-server kokoro-tts whisper-stt 2>/dev/null || true

echo -e "\n${BOLD}${GREEN}✓ All E2E-InterviewByte services and containers are stopped.${NC}\n"
