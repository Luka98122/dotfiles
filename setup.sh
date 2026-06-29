#!/bin/bash

# --- 1. Update & Install Basic Dependencies ---
echo "Installing core packages..."
sudo add-apt-repository ppa:zhangsongcui3371/fastfetch
sudo apt update
sudo apt install -y zsh stow fastfetch alacritty dconf-cli wget unzip git curl eza \
    gnome-shell-extensions libglib2.0-bin \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

# --- 2. Install Oh My Zsh (if not present) ---
if [ ! -d "$HOME/.oh-my-zsh" ]; then
    echo "Installing Oh My Zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

# --- 3. Install Zsh Plugins & Themes ---
ZSH_CUSTOM=${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}

echo "Installing Zsh plugins and P10k theme..."
# Powerlevel10k
[ ! -d "$ZSH_CUSTOM/themes/powerlevel10k" ] && git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$ZSH_CUSTOM/themes/powerlevel10k"
# Autosuggestions
[ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ] && git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
# Syntax Highlighting
[ ! -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ] && git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"

# --- 4. Install JetBrains Mono Nerd Font ---
if ! fc-list | grep -i "JetBrainsMono" > /dev/null; then
    echo "Installing JetBrains Mono Nerd Font..."
    mkdir -p ~/.local/share/fonts
    cd /tmp
    wget https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip
    unzip -o JetBrainsMono.zip -d ~/.local/share/fonts
    fc-cache -fv
    cd ~/dotfiles
fi

# --- 5. Symlink Dotfiles with Stow ---
echo "Symlinking configuration files..."
cd ~/dotfiles

# Remove default .zshrc if it exists as a file (so stow can link it)
[ -f "$HOME/.zshrc" ] && [ ! -L "$HOME/.zshrc" ] && rm "$HOME/.zshrc"

# Create necessary .config subdirectories so stow doesn't link the whole folder
mkdir -p ~/.config/alacritty
mkdir -p ~/.config/fastfetch
mkdir -p ~/.config/dconf
# GNOME only loads extensions from a REAL extensions/ dir. If we don't pre-create
# it, stow folds the whole dir into a single symlink and GNOME ignores it.
# Remove any such folded symlink from a previous run so stow links per-extension.
[ -L "$HOME/.local/share/gnome-shell/extensions" ] && rm "$HOME/.local/share/gnome-shell/extensions"
mkdir -p ~/.local/share/gnome-shell/extensions
# Hanabi ships its GSettings schema here (outside the extension dir); pre-create
# so stow links the .xml per-file instead of folding the whole dir.
mkdir -p ~/.local/share/glib-2.0/schemas

stow zsh
stow alacritty
stow fastfetch
stow gnome

# Compile GSettings schemas (e.g. Hanabi) so extension settings resolve.
glib-compile-schemas ~/.local/share/glib-2.0/schemas/ 2>/dev/null || true

# --- 6. Restore GNOME Extension Settings ---
echo "Restoring GNOME extension dconf settings..."
if [ -f "$HOME/dotfiles/gnome/.config/dconf/gnome-extensions.conf" ]; then
    dconf load /org/gnome/shell/extensions/ < "$HOME/dotfiles/gnome/.config/dconf/gnome-extensions.conf"
fi
if [ -f "$HOME/dotfiles/gnome/.config/dconf/enabled-extensions.txt" ]; then
    enabled=$(cat "$HOME/dotfiles/gnome/.config/dconf/enabled-extensions.txt")
    dconf write /org/gnome/shell/enabled-extensions "$enabled"
fi

# --- 7. Set Default Shell to Zsh ---
if [ "$SHELL" != "$(which zsh)" ]; then
    echo "Changing default shell to zsh..."
    chsh -s $(which zsh)
fi

echo "-----------------------------------------------"
echo "Setup Complete!"
echo "1. Restart Alacritty."
echo "2. If prompted, run 'p10k configure' to reset icons."
echo "3. Log out and back in to finalize the shell change."
echo "-----------------------------------------------"
