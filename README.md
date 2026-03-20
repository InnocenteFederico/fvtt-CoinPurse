# 🪙 Coin Purse

A lightweight module for managing player currency in Foundry VTT (D&D 5e).

## ✨ Features

- View current coins (CP, SP, EP, GP, PP)
- Add or remove coins using an easy interface
- Optional automatic coin conversion (e.g. 1 GP → 10 SP)
- Minimize the wallet by converting coins to higher denominations
- Optional support for disabling EP (electrum)
- Accessible through a button in the scene controls (`tokens` toolbar)

## ⚙️ Requirements

- Foundry VTT 13+
- System: Dungeons & Dragons 5th Edition (`dnd5e`)

## ▶️ Usage

1. Make sure your user has an assigned character.
2. From the scene controls, click the `coin-purse` tool button.
3. In the Coin Purse window:
   - `Receive`: add coins to the active character
   - `Pay`: deduct coins and automatically borrow/convert from higher denominations if needed
   - `Convert`: convert coins to minimize lower denominations

## 📦 Installation

1. Go to **Setup** → **Add-on Modules** → **Install Module**.
2. Use this module manifest URL:
   - `https://github.com/InnocenteFederico/fvtt-CoinPurse/releases/latest/download/module.json`
3. Install and enable the module.

## 🛠️ Module settings

- `Disable Electrum`: when enabled, EP is hidden and excluded from conversions.

## 🌐 Localization

- Supported languages: English, Italian.

## 📝 License

This project is licensed under the MIT License.

## 🐞 Issues

Report bugs at: https://github.com/InnocenteFederico/fvtt-CoinPurse/issues