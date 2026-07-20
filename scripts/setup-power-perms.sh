#!/usr/bin/env bash
# setup-power-perms.sh — ONE-TIME, needs sudo.
# Grants the 'sudo' group write access to the sysfs knob that
# performance.sh / battery-saver.sh need, so those two stay sudo-free.
#
#   no_turbo  — intel_pstate turbo gate (0=turbo on, 1=turbo off)
#
# fan_mode is deliberately NOT included: the VPC2004 ideapad_laptop node on this
# machine is a stub that only accepts 0, so granting write access to it would
# just enable a silent no-op. Real fan control needs the legion-laptop module.
#
# Run:  sudo ~/dotfiles/scripts/setup-power-perms.sh
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run with sudo: sudo $0" >&2; exit 1; }

NOTURBO=/sys/devices/system/cpu/intel_pstate/no_turbo
[ -e "$NOTURBO" ] || { echo "no_turbo not found — intel_pstate inactive?" >&2; exit 1; }

# sysfs perms reset every boot, so persist via tmpfiles rather than a bare chmod.
cat > /etc/tmpfiles.d/legion-power.conf <<EOF
# Let the sudo group drive CPU turbo without a password prompt.
z $NOTURBO 0664 root sudo -
EOF

systemd-tmpfiles --create /etc/tmpfiles.d/legion-power.conf

echo "wrote /etc/tmpfiles.d/legion-power.conf and applied it:"
ls -l "$NOTURBO"
echo
echo "Done. ~/performance.sh and ~/battery-saver.sh can now set these without sudo."
