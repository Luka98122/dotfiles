#!/bin/bash
# Re-capture GNOME state that can't be symlinked (dconf is a binary DB).
# Run this after changing extensions/settings, then commit.
set -e
DCONF_DIR="$(cd "$(dirname "$0")" && pwd)/.config/dconf"
mkdir -p "$DCONF_DIR"

echo "Dumping extension settings -> gnome-extensions.conf"
dconf dump /org/gnome/shell/extensions/ > "$DCONF_DIR/gnome-extensions.conf"

echo "Dumping enabled-extensions list -> enabled-extensions.txt"
dconf read /org/gnome/shell/enabled-extensions > "$DCONF_DIR/enabled-extensions.txt"

echo "Dumping Hanabi settings -> hanabi.conf (stores under its own dconf path)"
dconf dump /io/github/jeffshee/hanabi-extension/ > "$DCONF_DIR/hanabi.conf"

# Warn about enabled extensions that aren't vendored or system-provided.
EXT_DIR="$(cd "$(dirname "$0")" && pwd)/.local/share/gnome-shell/extensions"
echo
echo "Checking for enabled extensions not vendored in dotfiles..."
enabled=$(dconf read /org/gnome/shell/enabled-extensions | tr -d "[]' " | tr ',' '\n')
for uuid in $enabled; do
    [ -z "$uuid" ] && continue
    # skip system extensions shipped via apt
    if [ -d "/usr/share/gnome-shell/extensions/$uuid" ]; then continue; fi
    if [ ! -e "$EXT_DIR/$uuid" ]; then
        echo "  ! $uuid is enabled but not in dotfiles (and not a system extension)"
    fi
done
echo "Done."
