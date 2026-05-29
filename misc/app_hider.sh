#!/bin/bash

LOCAL_DIR="$HOME/.local/share/applications"
mkdir -p "$LOCAL_DIR"

# Standard Ubuntu app directories (System, Snaps, and Flatpaks)
SCAN_DIRS=("/usr/share/applications" "/var/lib/snapd/desktop/applications" "/var/lib/flatpak/exports/share/applications")

echo "============================================="
echo "   Interactive App Hider for GNOME/Ubuntu   "
echo "============================================="
echo "For each app, type 'y' to hide it, or press Enter to skip."
echo "---------------------------------------------"

# Use find with null delimiters to perfectly handle app names with spaces
find "${SCAN_DIRS[@]}" -maxdepth 1 -name "*.desktop" 2>/dev/null -print0 | while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    
    # Extract the clean application name
    app_name=$(grep -m 1 "^Name=" "$file" | cut -d'=' -f2-)
    [ -z "$app_name" ] && continue

    # Skip files that you have already hidden locally
    if [ -f "$LOCAL_DIR/$filename" ] && grep -q "^NoDisplay=true" "$LOCAL_DIR/$filename"; then
        continue
    fi

    # Read choice directly from terminal tty to prevent the pipe from consuming stdin
    read -p "Hide '$app_name'? [y/N]: " choice < /dev/tty
    
    case "$choice" in
        [yY]*)
            cp "$file" "$LOCAL_DIR/$filename"
            # Strip any existing NoDisplay lines to prevent duplicates, then append true
            sed -i '/^NoDisplay=/d' "$LOCAL_DIR/$filename"
            echo "NoDisplay=true" >> "$LOCAL_DIR/$filename"
            echo "   [✓] Hidden: $app_name"
            ;;
        *)
            # Just skip if anything else or empty
            ;;
    esac
done

echo "---------------------------------------------"
echo "Processing complete!"
echo "If your app drawer doesn't update immediately, just log out"
echo "and log back in to force GNOME to rebuild its cache."
echo "============================================="
