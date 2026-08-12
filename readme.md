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