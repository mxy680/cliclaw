#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.dev-pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PORTS=(3000 3001 3002)

log() { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }
err() { echo -e "${RED}[dev]${NC} $*" >&2; }

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Killing processes on port $port: $pids"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    # Check if still alive, force kill if needed
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      warn "Force killing stubborn processes on port $port"
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

kill_all_ports() {
  for port in "${PORTS[@]}"; do
    kill_port "$port"
  done
}

stop() {
  log "Stopping dev services..."
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  kill_all_ports
  log "All services stopped."
}

status() {
  local running=false
  for port in 3002 3000 3001; do
    local name
    case $port in
      3002) name="agent-server" ;;
      3000) name="dashboard" ;;
      3001) name="portal" ;;
    esac
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo -e "${GREEN}●${NC} $name (port $port) — running (PID: $pids)"
      running=true
    else
      echo -e "${RED}●${NC} $name (port $port) — stopped"
    fi
  done
  if [[ "$running" == false ]]; then
    echo ""
    warn "No services running."
  fi
}

cleanup() {
  log "Shutting down all services..."
  # Kill child processes
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  # Also kill any process groups we spawned
  kill 0 2>/dev/null || true
  exit 0
}

wait_for_port() {
  local port=$1
  local name=$2
  local max_wait=${3:-30}
  local waited=0
  while ! lsof -ti:"$port" &>/dev/null; do
    if (( waited >= max_wait )); then
      err "$name did not start within ${max_wait}s"
      return 1
    fi
    sleep 1
    ((waited++))
  done
  log "$name is listening on port $port (${waited}s)"
}

start() {
  log "Starting cliclaw dev environment..."

  # Kill stale processes
  kill_all_ports

  # Increase file descriptor limit to prevent EMFILE
  ulimit -n 65536 2>/dev/null || warn "Could not set ulimit -n 65536 (current: $(ulimit -n))"
  log "File descriptor limit: $(ulimit -n)"

  # Clean PID file
  rm -f "$PID_FILE"

  # Trap for cleanup on exit
  trap cleanup SIGINT SIGTERM EXIT

  # Start agent-server (port 3002) first
  log "Starting agent-server on port 3002..."
  (cd "$ROOT/apps/agent-server" && pnpm dev 2>&1 | sed -u "s/^/$(printf "${CYAN}[api]${NC}     ")/" ) &
  echo $! >> "$PID_FILE"

  # Wait for agent-server to be ready
  wait_for_port 3002 "agent-server" 30

  # Start dashboard (port 3000) and portal (port 3001) in parallel
  log "Starting dashboard on port 3000..."
  (cd "$ROOT/apps/dashboard" && pnpm dev 2>&1 | sed -u "s/^/$(printf "${MAGENTA}[dash]${NC}    ")/" ) &
  echo $! >> "$PID_FILE"

  log "Starting portal on port 3001..."
  (cd "$ROOT/apps/portal" && pnpm dev 2>&1 | sed -u "s/^/$(printf "${BLUE}[portal]${NC}  ")/" ) &
  echo $! >> "$PID_FILE"

  wait_for_port 3000 "dashboard" 30
  wait_for_port 3001 "portal" 30

  echo ""
  log "All services running:"
  echo -e "  ${CYAN}agent-server${NC}  → http://localhost:3002"
  echo -e "  ${MAGENTA}dashboard${NC}     → http://localhost:3000"
  echo -e "  ${BLUE}portal${NC}        → http://localhost:3001"
  echo ""
  log "Press Ctrl+C to stop all services."
  echo ""

  # Wait for all background jobs
  wait
}

# Main
case "${1:-start}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
