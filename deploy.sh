#!/usr/bin/env bash
# Deployment script for the Pocket Dev Guild frontend
# Rebuilds the frontend Docker image and (re)starts the docker-compose stack.
#
# Usage:
#     ./deploy.sh              # Normal deploy
#     ./deploy.sh --dry-run    # Dry-run mode (show what would happen)
#     ./deploy.sh --no-cache   # Rebuild frontend image without docker cache

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
MAIN_BRANCH="main"
COMPOSE_SERVICE="frontend"
DRY_RUN=false
NO_CACHE=false

# Pick docker compose command (v2 plugin preferred, v1 fallback).
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
else
    echo "❌ ERROR: neither 'docker compose' nor 'docker-compose' is available" >&2
    exit 1
fi

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --dry-run)
            DRY_RUN=true
            ;;
        --no-cache)
            NO_CACHE=true
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: $0 [--dry-run] [--no-cache]"
            exit 1
            ;;
    esac
done

if [[ "$DRY_RUN" == "true" ]]; then
    echo "🔍 DRY-RUN MODE - No changes will be made"
    echo ""
fi

# Helper functions
log() {
    echo "📋 $*"
}

error() {
    echo "❌ ERROR: $*" >&2
}

dry_run_exec() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "   [DRY-RUN] Would execute: $*"
    else
        eval "$@"
    fi
}

# Check git branch and freshness against origin
check_git_state() {
    local current_branch
    current_branch=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    if [[ -z "$current_branch" ]]; then
        log "⚠️  Not a git repository or no current branch - skipping git checks"
        return
    fi

    if [[ "$current_branch" != "$MAIN_BRANCH" ]]; then
        log "⚠️  WARNING: Current branch is '$current_branch', not '$MAIN_BRANCH'"
    else
        log "On branch '$current_branch'"
    fi

    log "Fetching from origin..."
    if ! git -C "$SCRIPT_DIR" fetch origin "$MAIN_BRANCH" 2>/dev/null; then
        log "⚠️  WARNING: git fetch failed - cannot verify remote state"
        return
    fi

    local local_sha remote_sha
    local_sha=$(git -C "$SCRIPT_DIR" rev-parse "$MAIN_BRANCH" 2>/dev/null || echo "")
    remote_sha=$(git -C "$SCRIPT_DIR" rev-parse "origin/$MAIN_BRANCH" 2>/dev/null || echo "")

    if [[ -z "$local_sha" ]] || [[ -z "$remote_sha" ]]; then
        log "⚠️  WARNING: Could not resolve '$MAIN_BRANCH' or 'origin/$MAIN_BRANCH'"
        return
    fi

    if [[ "$local_sha" != "$remote_sha" ]]; then
        local behind ahead
        behind=$(git -C "$SCRIPT_DIR" rev-list --count "$MAIN_BRANCH..origin/$MAIN_BRANCH" 2>/dev/null || echo "?")
        ahead=$(git -C "$SCRIPT_DIR" rev-list --count "origin/$MAIN_BRANCH..$MAIN_BRANCH" 2>/dev/null || echo "?")
        log "⚠️  WARNING: '$MAIN_BRANCH' is not in sync with 'origin/$MAIN_BRANCH' (behind: $behind, ahead: $ahead)"
    else
        log "'$MAIN_BRANCH' is up to date with 'origin/$MAIN_BRANCH'"
    fi
}

# Rebuild the frontend image via docker compose
build_frontend() {
    local build_cmd="${COMPOSE[*]} build"
    if [[ "$NO_CACHE" == "true" ]]; then
        build_cmd+=" --no-cache"
    fi
    build_cmd+=" $COMPOSE_SERVICE"

    log "Rebuilding '$COMPOSE_SERVICE' image..."
    dry_run_exec "cd \"$SCRIPT_DIR\" && $build_cmd"
}

# Bring the stack up (recreating containers whose image changed)
compose_up() {
    log "Starting compose stack (docker compose up -d)..."
    dry_run_exec "cd \"$SCRIPT_DIR\" && ${COMPOSE[*]} up -d"
}

# Show resulting service status
show_status() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return
    fi
    log "Service status:"
    (cd "$SCRIPT_DIR" && "${COMPOSE[@]}" ps)
}

# Main deployment logic
main() {
    check_git_state
    build_frontend
    compose_up
    show_status
    log "✅ Deployment complete!"
}

main
