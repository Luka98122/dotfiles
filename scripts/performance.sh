#!/usr/bin/env bash
# performance.sh — full performance / plugged-in mode on the Legion Pro 7
#   - performance platform/CPU profile
#   - fans to performance + CPU turbo ON  (see note below)
#   - turns the Hanabi live wallpaper back ON
#   - full brightness
# Run:  ~/performance.sh   (no sudo needed, after one-time ~/setup-power-perms.sh)
#
# Why fans matter here: with the EC fan profile on Quiet the package sits ~80 °C,
# and power-profiles-daemon then silently degrades the performance profile
# ("Degraded: high-operating-temperature") and disables turbo — pinning the
# 13900HX to its 2.2 GHz base clock. Selecting Performance in GNOME alone does
# NOT fix this; the fan profile is a separate knob.
set -euo pipefail

HANABI="hanabi-extension@jeffshee.github.io"
BRIGHT="${1:-100}"   # optional arg: brightness %, default 100

FAN=$(find /sys/devices -maxdepth 6 -name fan_mode 2>/dev/null | head -1)
NOTURBO=/sys/devices/system/cpu/intel_pstate/no_turbo

say() { printf '  %s\n' "$*"; }

# Writes $2 to $1, or explains why it can't.
poke() {
  local path="$1" val="$2" label="$3"
  if [ -z "$path" ] || [ ! -e "$path" ]; then say "⚠️  $label: not available on this machine"; return; fi
  if [ -w "$path" ]; then
    echo "$val" > "$path" && say "$label"
  else
    say "⚠️  $label: no write access — run 'sudo ~/setup-power-perms.sh' once"
  fi
}

echo "🚀 Performance mode"

# Warn if on battery — performance profile drains fast unplugged
if [ "$(cat /sys/class/power_supply/BAT0/status 2>/dev/null)" = "Discharging" ]; then
  say "⚠️  you're on BATTERY — this will drain quickly; plug in for real perf."
fi

# 1) Power profile (falls back to balanced if performance is unavailable)
if command -v powerprofilesctl >/dev/null; then
  if powerprofilesctl set performance 2>/dev/null; then
    say "power profile → performance"
  else
    powerprofilesctl set balanced && say "power profile → balanced (performance unavailable)"
  fi
fi

# 1b) Fans first (cools the package), then lift the turbo gate.
#     Order matters: PPD re-degrades and re-disables turbo while the CPU is hot.
poke "$FAN" 2 "fan mode → performance"
sleep 1
poke "$NOTURBO" 0 "CPU turbo → ON"

# Report what actually stuck — PPD may have overridden us.
if [ -r "$NOTURBO" ] && [ "$(cat "$NOTURBO")" = "1" ]; then
  say "⚠️  turbo still gated off — CPU is capped at base clock."
  say "    check: powerprofilesctl list | grep -A1 performance"
fi
if command -v powerprofilesctl >/dev/null && powerprofilesctl list 2>/dev/null | grep -q "Degraded:.*yes"; then
  say "⚠️  power profile is DEGRADED (usually heat). Let it cool, then re-run."
fi

# 2) Re-enable the live wallpaper
if gnome-extensions info "$HANABI" >/dev/null 2>&1; then
  if gnome-extensions info "$HANABI" | grep -q "State: ACTIVE"; then
    say "live wallpaper already on"
  else
    gnome-extensions enable "$HANABI" && say "live wallpaper → ON (Hanabi enabled)"
  fi
fi

# 3) Full brightness
gdbus call --session --dest org.gnome.SettingsDaemon.Power \
  --object-path /org/gnome/SettingsDaemon/Power \
  --method org.freedesktop.DBus.Properties.Set \
  org.gnome.SettingsDaemon.Power.Screen Brightness "<int32 $BRIGHT>" >/dev/null \
  && say "brightness → ${BRIGHT}%"

echo "✅ Done."
