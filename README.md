# 🪙 Coin Purse

A lightweight module for managing player currency in Foundry VTT (D&D 5e).

## ✨ Features

- View current coins (CP, SP, EP, GP, PP)
- Add or remove coins using an easy interface
- Send coins to other player characters
- Minimize the wallet by converting coins to higher denominations
- Optional support for disabling EP (electrum)
- Accessible through a button in the scene controls (`tokens` toolbar)

## ⚙️ Requirements

- Foundry VTT 13+
- System: Dungeons & Dragons 5th Edition (`dnd5e`)
- Module dependency: socketlib

## ▶️ Usage

### Manage mode

- Receive: add coins to the active character
- Pay: deduct coins (automatically borrows from higher denominations if needed)
- Convert: convert coins to minimize lower denominations

### Send mode

Select a recipient from the dropdown, enter the amount of coins to send, and click Send to transfer currency to another player character.

## 📦 Installation

1. Go to **Setup** → **Add-on Modules** → **Install Module**.
2. Use this module manifest URL:
   - `https://github.com/InnocenteFederico/fvtt-CoinPurse/releases/latest/download/module.json`
3. Install and enable the module.

## 🛠️ Module settings

- `Disable Electrum`: when enabled, EP is hidden and excluded from conversions.
- `Post transfer message to chat`: when enabled, sending currency creates a chat message describing the transfer

## 🌐 Localization

- Supported languages: English, Italian.

## 📝 License

This project is licensed under the MIT License.

## 🐞 Issues

Report bugs at: https://github.com/InnocenteFederico/fvtt-CoinPurse/issues