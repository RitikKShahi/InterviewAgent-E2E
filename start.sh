#!/usr/bin/env bash
# ==============================================================================
# DeepInterview — Unified Start Script
# Starts:
#   1. Local LiveKit WebRTC Server (Docker, port 7880)
#   2. Local Kokoro TTS Server (Docker, port 8880)
#   3. Local Whisper STT Server (Docker, port 8001)
#   4. Python Agent API (port 8000)
#   5. LiveKit Voice Agent Worker (deepinterview-interviewer)
#   6. Next.js Web Frontend (port 3000)
# ==============================================================================

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Ensure environment variables are loaded and shared with Next.js web app
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
  ln -sf ../../.env "$REPO_ROOT/apps/web/.env.local" 2>/dev/null || cp "$REPO_ROOT/.env" "$REPO_ROOT/apps/web/.env.local"
fi

# Ensure common binary paths are available
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

LOGS_DIR="$REPO_ROOT/.logs"
mkdir -p "$LOGS_DIR"
PID_FILE="$LOGS_DIR/pids"

# Color formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=====================================================${NC}"
echo -e "${BOLD}${BLUE}   Starting InterviewByte All-In-One Stack          ${NC}"
echo -e "${BOLD}${BLUE}=====================================================${NC}"

# Check Docker
echo -e "\n${BLUE}1. Checking Docker Engine...${NC}"
if ! docker info >/dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not running. Launching Docker Desktop...${NC}"
  open -a Docker || true
  for i in {1..30}; do
    if docker info >/dev/null 2>&1; then
      echo -e "${GREEN}✓ Docker is ready!${NC}"
      break
    fi
    echo -n "."
    sleep 2
  done
  if ! docker info >/dev/null 2>&1; then
    echo -e "\n${RED}Error: Docker daemon could not be reached. Please ensure Docker Desktop is running.${NC}"
    exit 1
  fi
  echo ""
else
  echo -e "${GREEN}✓ Docker is running.${NC}"
fi

# Function to start or run a docker container
start_or_run_container() {
  local name="$1"
  local run_cmd="$2"
  
  if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
    echo -e "${GREEN}✓ Container '${name}' is already running.${NC}"
  elif docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    echo -e "${YELLOW}Starting existing '${name}' container...${NC}"
    docker start "$name" >/dev/null
    echo -e "${GREEN}✓ Started container '${name}'.${NC}"
  else
    echo -e "${YELLOW}Creating and running '${name}' container...${NC}"
    eval "$run_cmd" >/dev/null
    echo -e "${GREEN}✓ Created and started container '${name}'.${NC}"
  fi
}

# Start Docker services
echo -e "\n${BLUE}2. Starting Docker Services...${NC}"

# 1. LiveKit Server
start_or_run_container "livekit-server" \
  "docker run -d --name livekit-server --restart unless-stopped -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server:latest --dev --bind 0.0.0.0"

# 2. Kokoro TTS (Accelerated CPU thread execution)
start_or_run_container "kokoro-tts" \
  "docker run -d --name kokoro-tts --restart unless-stopped -p 8880:8880 --cpus=4 -e OMP_NUM_THREADS=4 -e MKL_NUM_THREADS=4 -e NUMEXPR_NUM_THREADS=4 ghcr.io/remsky/kokoro-fastapi-cpu:latest"

# 3. Whisper STT (Multi-core Speaches execution)
start_or_run_container "whisper-stt" \
  "docker run -d --name whisper-stt --restart unless-stopped -p 8001:8000 --cpus=4 -e UVICORN_WORKERS=2 ghcr.io/speaches-ai/speaches:latest-cpu"

# Ensure Whisper has its model downloaded
echo -e "Checking Whisper speech model..."
if ! curl -s http://localhost:8001/v1/models | grep -q "faster-whisper-base"; then
  echo -e "${YELLOW}Downloading Systran/faster-whisper-base model into Speaches container...${NC}"
  curl -s -X POST http://localhost:8001/v1/models/Systran/faster-whisper-base >/dev/null || true
fi
echo -e "${GREEN}✓ Speech models ready.${NC}"

# Clean up any old host processes on ports 8000, 8002, 8003, or 3000
echo -e "\n${BLUE}3. Preparing Application Services...${NC}"
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :8002 | xargs kill -9 2>/dev/null || true
lsof -ti :8003 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
> "$PID_FILE"

# Start Agent API (port 8000)
echo -e "Starting Python Agent API (port 8000)..."
cd "$REPO_ROOT/apps/agent"
nohup uv run uvicorn deepinterview_agent.app:app --host 127.0.0.1 --port 8000 </dev/null > "$LOGS_DIR/agent-api.log" 2>&1 &
AGENT_API_PID=$!
echo "$AGENT_API_PID" >> "$PID_FILE"

# Start Recruiter Backend Service (port 8002)
echo -e "Starting Recruiter Backend Service (port 8002)..."
cd "$REPO_ROOT"
nohup env PYTHONPATH=. uv run --project apps/agent uvicorn services.recruiter_service.main:app --host 127.0.0.1 --port 8002 </dev/null > "$LOGS_DIR/recruiter-service.log" 2>&1 &
RECRUITER_PID=$!
echo "$RECRUITER_PID" >> "$PID_FILE"

# Start Candidate Backend Service (port 8003)
echo -e "Starting Candidate Backend Service (port 8003)..."
nohup env PYTHONPATH=. uv run --project apps/agent uvicorn services.candidate_service.main:app --host 127.0.0.1 --port 8003 </dev/null > "$LOGS_DIR/candidate-service.log" 2>&1 &
CANDIDATE_PID=$!
echo "$CANDIDATE_PID" >> "$PID_FILE"

# Start LiveKit Voice Worker
echo -e "Starting LiveKit Voice Agent Worker..."
cd "$REPO_ROOT/apps/agent"
nohup uv run python -m deepinterview_agent.worker dev </dev/null > "$LOGS_DIR/agent-worker.log" 2>&1 &
WORKER_PID=$!
echo "$WORKER_PID" >> "$PID_FILE"

# Start Web UI (port 3000)
echo -e "Starting Next.js Web Frontend (port 3000)..."
cd "$REPO_ROOT"
nohup pnpm --filter @deepinterview/web dev -p 3000 </dev/null > "$LOGS_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >> "$PID_FILE"

# Wait for readiness
echo -e "\n${BLUE}4. Waiting for services to become healthy...${NC}"

wait_for_url() {
  local url="$1"
  local name="$2"
  local max_attempts="${3:-30}"
  local count=0
  until curl -s -f -o /dev/null "$url" 2>/dev/null; do
    count=$((count+1))
    if [ "$count" -ge "$max_attempts" ]; then
      echo -e "${RED}✗ Timed out waiting for $name at $url${NC}"
      return 1
    fi
    sleep 1
  done
  echo -e "${GREEN}✓ $name is up!${NC}"
}

wait_for_url "http://127.0.0.1:8000/health" "Agent API" 20
wait_for_url "http://127.0.0.1:8002/health" "Recruiter Service" 20
wait_for_url "http://127.0.0.1:8003/health" "Candidate Service" 20
wait_for_url "http://localhost:3000" "Next.js Web UI" 25
wait_for_url "http://localhost:8880/health" "Kokoro TTS" 20
wait_for_url "http://localhost:8001/health" "Whisper STT" 20

echo -e "\n${BOLD}${GREEN}=====================================================${NC}"
echo -e "${BOLD}${GREEN}   All AI Recruitment & Interview Services Are Live!${NC}"
echo -e "${BOLD}${GREEN}=====================================================${NC}"
echo -e "  • Web Frontend:       ${BOLD}http://localhost:3000${NC}"
echo -e "  • Recruiter Hub:      ${BOLD}http://localhost:3000/recruiter/dashboard${NC}"
echo -e "  • Candidate Portal:   ${BOLD}http://localhost:3000/candidate/jobs${NC}"
echo -e "  • Recruiter API:      ${BOLD}http://127.0.0.1:8002/docs${NC}"
echo -e "  • Candidate API:      ${BOLD}http://127.0.0.1:8003/docs${NC}"
echo -e "  • Agent API:          ${BOLD}http://127.0.0.1:8000${NC}"
echo -e "  • LiveKit Server:     ${BOLD}ws://127.0.0.1:7880${NC}"
echo -e "  • Kokoro TTS:         ${BOLD}http://localhost:8880${NC}"
echo -e "  • Whisper STT:        ${BOLD}http://localhost:8001${NC}"
echo -e "  • Logs Directory:     ${BOLD}$LOGS_DIR${NC}"
echo -e "${BOLD}${GREEN}=====================================================${NC}"

cleanup() {
  echo -e "\n${YELLOW}Stopping host services (PIDs: $AGENT_API_PID, $RECRUITER_PID, $CANDIDATE_PID, $WORKER_PID, $WEB_PID)...${NC}"
  kill "$AGENT_API_PID" "$RECRUITER_PID" "$CANDIDATE_PID" "$WORKER_PID" "$WEB_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo -e "${GREEN}Host services stopped. (Docker containers are left running. Run ./stop.sh to stop everything).${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

if [ "${1:-}" = "-d" ] || [ "${1:-}" = "--detach" ]; then
  echo -e "\nRunning in detached/background mode."
  echo -e "To stop all services and containers anytime, run: ${BOLD}./stop.sh${NC}"
  disown -a 2>/dev/null || true
  exit 0
fi

echo -e "\n${YELLOW}Press Ctrl+C to stop the application services.${NC}"
echo -e "(To stop containers as well, run: ${BOLD}./stop.sh${NC})"
echo -e "Streaming web & worker logs below (tail -f):\n"

tail -n 20 -f "$LOGS_DIR/web.log" "$LOGS_DIR/agent-worker.log"
