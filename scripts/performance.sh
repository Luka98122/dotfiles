#!/usr/bin/env bash
# performance.sh — full performance / plugged-in mode on the Legion Pro 7
#   - performance platform/CPU profile
#   - CPU turbo ON
#   - turns the Hanabi live wallpaper back ON
#   - full brightness
# Run:  ~/dotfiles/scripts/performance.sh   (no sudo needed, after one-time ~/dotfiles/scripts/setup-power-perms.sh)
#
# Why turbo needs forcing: when the package runs hot, power-profiles-daemon
# silently degrades the performance profile ("Degraded: high-operating-
# temperature") and sets no_turbo=1 — pinning the 13900HX to its 2.2 GHz base
# clock. Selecting Performance in GNOME alone does NOT undo that.
#
# NOTE ON FANS: this script used to also write .../VPC2004:00/fan_mode. That
# knob is a dead stub from the generic ideapad_laptop driver on this machine —
# it accepts only 0 and silently reverts anything else. Real Legion fan control
# needs the out-of-tree legion-laptop module (LenovoLegionLinux), which is not
# installed. Without it there is NO fan control from Linux, so turbo-on runs
# near Tjmax. See the temperature check at the end.
set -euo pipefail

HANABI="hanabi-extension@jeffshee.github.io"
BRIGHT="${1:-100}"   # optional arg: brightness %, default 100

NOTURBO=/sys/devices/system/cpu/intel_pstate/no_turbo

say() { printf '  %s\n' "$*"; }

# Writes $2 to $1 and VERIFIES it stuck — firmware can accept a write and then
# silently revert, which is exactly what fan_mode did.
poke() {
  local path="$1" val="$2" label="$3"
  if [ -z "$path" ] || [ ! -e "$path" ]; then say "⚠️  $label: not available on this machine"; return; fi
  if [ ! -w "$path" ]; then
    say "⚠️  $label: no write access — run 'sudo ~/dotfiles/scripts/setup-power-perms.sh' once"; return
  fi
  echo "$val" > "$path" 2>/dev/null || { say "⚠️  $label: write rejected by firmware"; return; }
  if [ "$(cat "$path")" = "$val" ]; then
    say "$label"
  else
    say "⚠️  $label: write did not stick (firmware reverted it)"
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

# 1b) Lift the turbo gate.
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

# 4) Thermal reality check. With no fan control (see header), turbo can park the
#    package at Tjmax (100 °C on the 13900HX) and throttle — which is slower AND
#    hotter than leaving turbo off.
TZ_PKG=$(for z in /sys/class/thermal/thermal_zone*; do
           [ "$(cat "$z/type" 2>/dev/null)" = "x86_pkg_temp" ] && echo "$z/temp" && break
         done)
if [ -n "$TZ_PKG" ]; then
  t=$(( $(cat "$TZ_PKG") / 1000 ))
  say "package temp: ${t}°C"
  if [ "$t" -ge 95 ]; then
    say "🔥 running at/near Tjmax — you are probably thermal throttling."
    say "   check: cat /sys/devices/system/cpu/cpu0/thermal_throttle/package_throttle_count"
    say "   fix:   install legion-laptop (LenovoLegionLinux) for real fan control,"
    say "          or run ~/dotfiles/scripts/battery-saver.sh to back off."
  fi
fi

echo "✅ Done."
