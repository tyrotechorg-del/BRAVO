#!/usr/bin/env bash
#
# apply-deletes.sh — safely delete the dead files manifested in
# DELETE_LIST.md.
#
# Usage:
#   cd <repo root>
#   bash <path-to-batch-15>/apply-deletes.sh [--yes]
#
# Options:
#   --yes    Skip the interactive confirmation prompt
#
# Behavior:
#   1. Verifies you're at the repo root (looks for backend/ + frontend/)
#   2. Re-runs the audit grep — refuses to delete anything with consumers
#   3. Stashes everything to .batch-15-deleted/<timestamp>/ first
#   4. Prints a summary
#   5. Asks for confirmation (unless --yes)
#   6. Removes the files
#
# Recovery: copies are at .batch-15-deleted/<timestamp>/ — restore with:
#   cp -r .batch-15-deleted/<timestamp>/* ./

set -euo pipefail

AUTO_YES=0
for arg in "$@"; do
    case "$arg" in
        --yes|-y) AUTO_YES=1 ;;
        *) echo "Unknown arg: $arg" >&2; exit 2 ;;
    esac
done

# Sanity check repo root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "ERROR: Run this from the repo root (must contain backend/ and frontend/)" >&2
    exit 1
fi

# The files we plan to delete
FRONTEND_DEAD_FILES=(
    "frontend/public/js/pages/ForgotPassword.js"
    "frontend/public/js/pages/ResetPassword.js"
    "frontend/public/js/services/playerService.js"
)

BACKEND_DEAD_FILES=(
    "backend/src/controllers/dashboardController.js"
    "backend/src/services/advancedAnalyticsService.js"
    "backend/src/services/analyticsService.js"
    "backend/src/services/audioProcessorService.js"
    "backend/src/services/cacheService.js"
    "backend/src/services/mobileMoneyService.js"
    "backend/src/services/moderationService.js"
    "backend/src/services/recommendationEngine.js"
    "backend/src/services/recommendationService.js"
    "backend/src/services/reportingService.js"
    "backend/src/services/royaltyService.js"
    "backend/src/services/searchService.js"
    "backend/src/services/waveformService.js"
)

# Names to grep for (basename minus extension) — refuse to delete if found
verify_dead() {
    local file="$1"
    local name
    name=$(basename "$file" .js)

    # Grep for any consumer outside this exact file
    local hits
    hits=$(grep -r --include='*.js' -l "$name" backend/src/ frontend/public/ 2>/dev/null | grep -v "^$file$" | grep -v "^$file:" || true)

    # For very generic names like "AudioPlayer" we'd get false positives, but
    # all the names below are unique enough that any hit means a real consumer.
    # Filter out hits in dead files themselves (they may import other dead files)
    local real_hits=""
    while read -r hit; do
        [ -z "$hit" ] && continue
        local is_dead=0
        for dead in "${FRONTEND_DEAD_FILES[@]}" "${BACKEND_DEAD_FILES[@]}"; do
            if [ "$hit" = "$dead" ]; then
                is_dead=1
                break
            fi
        done
        if [ "$is_dead" = "0" ]; then
            real_hits="${real_hits}${hit}\n"
        fi
    done <<< "$hits"

    if [ -n "${real_hits}" ] && [ "${real_hits}" != "\n" ]; then
        echo "REFUSING TO DELETE $file — found consumers:" >&2
        echo -e "$real_hits" >&2
        return 1
    fi
    return 0
}

# Collect all files that exist and pass the audit
TO_DELETE=()
SKIPPED_MISSING=()
REFUSED=()

echo "=== Auditing files ==="
for f in "${FRONTEND_DEAD_FILES[@]}" "${BACKEND_DEAD_FILES[@]}"; do
    if [ ! -e "$f" ]; then
        SKIPPED_MISSING+=("$f")
        continue
    fi
    if verify_dead "$f"; then
        TO_DELETE+=("$f")
    else
        REFUSED+=("$f")
    fi
done

# Force tree — directory delete, no per-file grep needed (whole tree dead)
FORCE_DIR_DELETE=0
if [ -d "frontend/force" ]; then
    FORCE_DIR_DELETE=1
fi

echo ""
echo "=== Summary ==="
echo "Files to delete:    ${#TO_DELETE[@]}"
echo "Skipped (missing):  ${#SKIPPED_MISSING[@]}"
echo "Refused (live):     ${#REFUSED[@]}"
echo "frontend/force/:    $( [ "$FORCE_DIR_DELETE" = 1 ] && echo "EXISTS — will delete" || echo "absent" )"
echo ""

if [ ${#REFUSED[@]} -gt 0 ]; then
    echo "REFUSED files (will not delete — fix consumers first or remove from manifest):"
    for f in "${REFUSED[@]}"; do
        echo "  - $f"
    done
    echo ""
fi

if [ ${#TO_DELETE[@]} -eq 0 ] && [ "$FORCE_DIR_DELETE" = "0" ]; then
    echo "Nothing to delete. Exiting."
    exit 0
fi

if [ "$AUTO_YES" -ne 1 ]; then
    echo "Files that WILL be deleted:"
    for f in "${TO_DELETE[@]}"; do
        echo "  - $f"
    done
    [ "$FORCE_DIR_DELETE" = "1" ] && echo "  - frontend/force/ (entire directory, 16 files)"
    echo ""
    read -rp "Proceed with delete? [y/N] " ans
    if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Stash backup
STAMP=$(date +%Y%m%d-%H%M%S)
STASH_DIR=".batch-15-deleted/$STAMP"
mkdir -p "$STASH_DIR"
echo "=== Stashing backups to $STASH_DIR ==="
for f in "${TO_DELETE[@]}"; do
    dir="$STASH_DIR/$(dirname "$f")"
    mkdir -p "$dir"
    cp "$f" "$STASH_DIR/$f"
done
if [ "$FORCE_DIR_DELETE" = "1" ]; then
    cp -r frontend/force "$STASH_DIR/frontend/" 2>/dev/null
fi

# Delete
echo "=== Deleting ==="
for f in "${TO_DELETE[@]}"; do
    rm "$f"
    echo "  removed $f"
done
if [ "$FORCE_DIR_DELETE" = "1" ]; then
    rm -rf frontend/force
    echo "  removed frontend/force/"
fi

echo ""
echo "Done. Restore with:"
echo "  cp -r $STASH_DIR/* ./"
