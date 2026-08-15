#!/usr/bin/env bash
# setup-study-timer-block.sh — ONE-TIME, needs sudo.
# Installs the root side of the Study Timer website blocker:
#
#   /usr/local/libexec/study-timer-hosts                                 (root helper)
#   /usr/share/polkit-1/actions/org.gnome.shell.extensions.study-timer.policy
#
# The polkit action lets the local active session run the helper without a
# password, so starting a study session blocks the sites in
# ~/.config/study-timer/blocklist.txt silently. The helper itself only ever
# points validated domain names at 127.0.0.1 inside its own marked-off block
# in /etc/hosts — it takes no paths or addresses from whoever calls it.
#
# Run:        sudo ~/dotfiles/scripts/setup-study-timer-block.sh
# Undo:       sudo ~/dotfiles/scripts/setup-study-timer-block.sh uninstall
set -euo pipefail

EXT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../gnome/.local/share/gnome-shell/extensions/study-timer@luka.markovic" && pwd)
HELPER_SRC="$EXT_DIR/helper/study-timer-hosts"
POLICY_SRC="$EXT_DIR/helper/org.gnome.shell.extensions.study-timer.policy"

HELPER_DEST=/usr/local/libexec/study-timer-hosts
POLICY_DEST=/usr/share/polkit-1/actions/org.gnome.shell.extensions.study-timer.policy

[ "$(id -u)" -eq 0 ] || { echo "run with sudo: sudo $0 $*" >&2; exit 1; }

if [ "${1:-install}" = uninstall ]; then
    # Drop any live block before the helper that knows how to disappears.
    [ -x "$HELPER_DEST" ] && "$HELPER_DEST" clear || true
    rm -f "$HELPER_DEST" "$POLICY_DEST"
    echo "Removed $HELPER_DEST and $POLICY_DEST."
    exit 0
fi

[ -f "$HELPER_SRC" ] || { echo "helper not found at $HELPER_SRC" >&2; exit 1; }
[ -f "$POLICY_SRC" ] || { echo "policy not found at $POLICY_SRC" >&2; exit 1; }

# Root-owned and not writable by the user: the polkit action trusts this path.
install -d -o root -g root -m 755 /usr/local/libexec
install -o root -g root -m 755 "$HELPER_SRC" "$HELPER_DEST"
install -o root -g root -m 644 "$POLICY_SRC" "$POLICY_DEST"

echo "Installed:"
echo "  $HELPER_DEST"
echo "  $POLICY_DEST"
echo
echo "Done. The Study Timer menu's 'Block distracting sites' switch and the"
echo "automatic per-session block now work without a password prompt."
echo "Edit the site list in the extension's preferences, or directly in"
echo "~/.config/study-timer/blocklist.txt."
