# luka98122 / dotfiles

My personal development environment configuration for **Ubuntu 24.04 LTS (Noble Numbat)**. This setup is optimized for performance, minimalism, and a translucent aesthetic.

## Tech Stack
- **Terminal:** [Alacritty](https://github.com/alacritty/alacritty) (GPU-accelerated, configured with `0.8` opacity)
- **Shell:** [Zsh](https://www.zsh.org/) managed with [Oh My Zsh](https://ohmyz.sh/)
- **Theme:** [Powerlevel10k](https://github.com/romkatv/powerlevel10k) (Lean style)
- **Font:** [JetBrainsMono Nerd Font](https://www.nerdfonts.com/)
- **System Info:** [Fastfetch](https://github.com/fastfetch-cli/fastfetch)
- **Dotfile Management:** [GNU Stow](https://www.gnu.org/software/stow/)
- **Curl:** Repository also installs [curl](https://curl.se/)

## Key Features
- **Translucent Aesthetic:** Tokyo Night color palette with 80% background opacity.
- **Developer Productivity:** Includes `zsh-autosuggestions` and `zsh-syntax-highlighting`.
- **Portable Setup:** Automated `setup.sh` script to bootstrap a fresh OS in one command.
- **Patched Hanabi Live Wallpaper:** Includes a modified [Hanabi Extension](https://github.com/jeffshee/gnome-ext-hanabi) that fixes a severe VRAM memory leak (~300-600 MB per wallpaper switch). The fix is in `renderer/renderer.js` — it restarts the renderer subprocess on each wallpaper change rather than reusing the GStreamer pipeline, which retains decoded GL textures from previous videos.

## GNOME Extensions
GNOME only picks up a *newly added* extension on shell startup, and the shell cannot be restarted on Wayland — so after a fresh `stow gnome`, log out and back in before it appears.

## Study Timer
A self-written extension (`gnome/.local/share/gnome-shell/extensions/study-timer@luka.markovic`): a top bar countdown with one-click 45 min / 1:30 h sessions, +5 / +15 min top-ups, pause and stop.

**Website blocking.** The preferences window (panel menu → *Preferences*, or `gnome-extensions prefs study-timer@luka.markovic`) holds an editable blocklist, stored as plain text in `~/.config/study-timer/blocklist.txt` — one domain per line, `#` starts a comment, each entry also covers its `www.` form. It ships with `x.com`, `youtube.com`, `instagram.com` and `reddit.com`.

Sites are blocked while a session is counting down (including overtime; pausing lifts the block), and any time the *Block distracting sites* switch in the panel menu is on. Both behaviours are switchable in preferences.

Blocking needs a one-time install, since editing `/etc/hosts` needs root:

```bash
sudo ~/dotfiles/scripts/setup-study-timer-block.sh     # uninstall: ... setup-study-timer-block.sh uninstall
```

That drops a root helper in `/usr/local/libexec/study-timer-hosts` and a polkit action allowing the local active session to run it without a password. The helper only ever points *validated domain names* at `127.0.0.1` inside its own marked-off block in `/etc/hosts`, and takes no paths or addresses from its caller — the same "grant the narrow thing once, stay password-free after" idea as `setup-power-perms.sh`.

Caveats: a browser tab that already resolved a blocked domain may keep working until its DNS cache expires, and a browser using DNS-over-HTTPS in strict mode ignores `/etc/hosts` entirely.

## Updating Hanabi
When updating the upstream Hanabi extension, the memory-leak patch in `renderer/renderer.js` must be re-applied. The two modified functions are `setFilePath()` and `setAutoWallpaper()`. Diff the local copy against upstream to port the changes.

## Quick Setup
To replicate this environment on a fresh Ubuntu installation:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/luka98122/dotfiles.git](https://github.com/luka98122/dotfiles.git) ~/dotfiles
   cd ~/dotfiles
   ```
2. **Run the bootstrap script**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Finalize**

   1. Restart your terminal.

   2. Run ```p10k configure``` if the prompt wizard doesn't start automatically.

   3. Log out and back in to finalize the default shell change.