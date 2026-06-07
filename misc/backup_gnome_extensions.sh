#!/bin/bash
# Backup GNOME extensions and their settings into the dotfiles repo.
# Run this after installing/updating extensions.

DOTFILES="$HOME/dotfiles"
EXT_DIR="$DOTFILES/gnome/.local/share/gnome-shell/extensions"
DCONF_DIR="$DOTFILES/gnome/.config/dconf"

echo "==> Backing up GNOME extensions..."

# Copy user-installed extensions into the repo
rm -rf "$EXT_DIR"/*
for ext in "$HOME/.local/share/gnome-shell/extensions/"*; do
    if [ -d "$ext" ]; then
        name=$(basename "$ext")
        echo "  $name"
        cp -r "$ext" "$EXT_DIR/$name"
    fi
done

# Dump extension dconf settings
echo "==> Backing up extension dconf settings..."
dconf dump /org/gnome/shell/extensions/ > "$DCONF_DIR/gnome-extensions.conf"
dconf read /org/gnome/shell/enabled-extensions > "$DCONF_DIR/enabled-extensions.txt"

echo "==> Done. Commit the changes to save your current state."
