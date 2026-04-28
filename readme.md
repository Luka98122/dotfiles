# luka98122 / dotfiles

My personal development environment configuration for **Ubuntu 24.04 LTS (Noble Numbat)**. This setup is optimized for performance, minimalism, and a translucent aesthetic.

## Tech Stack
- **Terminal:** [Alacritty](https://github.com/alacritty/alacritty) (GPU-accelerated, configured with `0.8` opacity)
- **Shell:** [Zsh](https://www.zsh.org/) managed with [Oh My Zsh](https://ohmyz.sh/)
- **Theme:** [Powerlevel10k](https://github.com/romkatv/powerlevel10k) (Lean style)
- **Font:** [JetBrainsMono Nerd Font](https://www.nerdfonts.com/)
- **System Info:** [Fastfetch](https://github.com/fastfetch-cli/fastfetch)
- **Dotfile Management:** [GNU Stow](https://www.gnu.org/software/stow/)

## Key Features
- **Translucent Aesthetic:** Tokyo Night color palette with 80% background opacity.
- **Developer Productivity:** Includes `zsh-autosuggestions` and `zsh-syntax-highlighting`.
- **Portable Setup:** Automated `setup.sh` script to bootstrap a fresh OS in one command.

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