#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ghively/remote-land"
BACKEND_DIR="$PROJECT_DIR/backend"
SERVICE_NAME="nas-terminal"
BACKUP_DIR="$HOME/.deploy-backup"
PREV_COMMIT=""

echo "=== Starting deployment $(date -Iseconds) ==="

# --- Pre-flight checks ---
if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "ERROR: Service $SERVICE_NAME is not active. Aborting." >&2
    exit 1
fi

if ! sudo -n true 2>/dev/null; then
    echo "ERROR: Passwordless sudo not configured. Set up /etc/sudoers.d/nas-terminal-deploy first." >&2
    exit 1
fi

# --- Save current commit for rollback ---
PREV_COMMIT=$(cd "$PROJECT_DIR" && git rev-parse HEAD)
echo "Current commit: $PREV_COMMIT"

# --- Backup production config ---
mkdir -p "$BACKUP_DIR"
if [ -f "$BACKEND_DIR/config.json" ]; then
    echo "Backing up config.json"
    cp "$BACKEND_DIR/config.json" "$BACKUP_DIR/config.json.$(date +%s)"
    cp "$BACKEND_DIR/config.json" "$BACKUP_DIR/config.json.latest"
fi

# --- Pull latest code ---
echo "Pulling latest code from origin/main"
cd "$PROJECT_DIR"
git fetch origin main
git checkout main
git reset --hard origin/main

# --- Restore config ---
if [ -f "$BACKUP_DIR/config.json.latest" ]; then
    echo "Restoring config.json"
    cp "$BACKUP_DIR/config.json.latest" "$BACKEND_DIR/config.json"
fi

# --- Install production dependencies ---
echo "Installing production dependencies"
cd "$BACKEND_DIR"
npm install --production --no-audit --no-fund

# --- Precompile JSX for the frontend ---
# The browser no longer parses Babel at runtime — JSX is built into
# frontend/dist/*.js once on deploy. No npm install required for this step.
echo "Precompiling frontend JSX"
node "$PROJECT_DIR/frontend/build.js" || {
    echo "WARNING: frontend precompile failed — UI may show a blank page" >&2
}

# --- Restart service ---
echo "Restarting $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

# --- Health check with polling ---
echo "Waiting for service to become healthy..."
HEALTHY=false
for i in $(seq 1 15); do
    if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
        HEALTHY=true
        echo "Health check passed after $((i * 2))s"
        break
    fi
    sleep 2
done

if [ "$HEALTHY" = false ]; then
    echo "ERROR: Health check failed after 30s. Rolling back..." >&2
    cd "$PROJECT_DIR"
    git reset --hard "$PREV_COMMIT"
    if [ -f "$BACKUP_DIR/config.json.latest" ]; then
        cp "$BACKUP_DIR/config.json.latest" "$BACKEND_DIR/config.json"
    fi
    cd "$BACKEND_DIR"
    if ! npm install --production --no-audit --no-fund; then
        echo "CRITICAL: Rollback npm install failed. Service state uncertain." >&2
        echo "Previous commit restored at $PREV_COMMIT but node_modules may be broken." >&2
        exit 2
    fi
    sudo systemctl restart "$SERVICE_NAME"

    # Verify rollback health
    echo "Verifying rollback health..."
    ROLLBACK_OK=false
    for i in $(seq 1 15); do
        if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
            ROLLBACK_OK=true
            echo "Rollback health check passed after $((i * 2))s"
            break
        fi
        sleep 2
    done

    if [ "$ROLLBACK_OK" = false ]; then
        echo "CRITICAL: Rollback health check ALSO failed. Service is down. Manual intervention required." >&2
        exit 42
    fi

    echo "Rollback to $PREV_COMMIT verified." >&2
    exit 1
fi

echo "=== Deployment complete ==="
