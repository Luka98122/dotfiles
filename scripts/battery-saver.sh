#!/usr/bin/env bash
# battery-saver.sh — maximize battery life on the Legion Pro 7
#   - power-saver platform/CPU profile
#   - fans to quiet + CPU turbo OFF
#   - turns OFF the Hanabi live wallpaper (biggest single drain)
#   - dims screen (mini-LED backlight is a huge lever)
# Run:  ~/battery-saver.sh   (no sudo needed, after one-time ~/setup-power-perms.sh)
set -euo pipefail

HANABI="hanabi-extension@jeffshee.github.io"
DIM_PERCENT="${1:-40}"   # optional arg: brightness %, default 40

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

echo "🔋 Battery-saver mode"

# 1) Power profile
if command -v powerprofilesctl >/dev/null; then
  powerprofilesctl set power-saver && say "power profile → power-saver"
fi

# 1b) Quiet fans + turbo off. Mirrors performance.sh so the two are symmetric.
poke "$FAN" 0 "fan mode → quiet"
poke "$NOTURBO" 1 "CPU turbo → OFF"

# 2) Kill the live wallpaper
if gnome-extensions info "$HANABI" >/dev/null 2>&1; then
  if gnome-extensions info "$HANABI" | grep -q "State: ACTIVE"; then
    gnome-extensions disable "$HANABI" && say "live wallpaper → OFF (Hanabi disabled)"
  else
    say "live wallpaper already off"
  fi
fi

# 3) Dim the screen via GNOME (no sudo)
gdbus call --session --dest org.gnome.SettingsDaemon.Power \
  --object-path /org/gnome/SettingsDaemon/Power \
  --method org.freedesktop.DBus.Properties.Set \
  org.gnome.SettingsDaemon.Power.Screen Brightness "<int32 $DIM_PERCENT>" >/dev/null \
  && say "brightness → ${DIM_PERCENT}%"

# 4) Report current draw + estimate
B=/sys/class/power_supply/BAT0
if [ -r "$B/power_now" ]; then
  pw=$(( $(cat "$B/power_now") / 1000000 ))
  en=$(( $(cat "$B/energy_now") / 1000000 ))
  [ "$pw" -gt 0 ] && say "draw now: ${pw} W  →  ~$(awk "BEGIN{printf \"%.1f\", $en/$pw}") h remaining"
fi

echo "✅ Done.  Tip: on battery, also drop refresh to 60 Hz in Settings ▸ Displays."
