import { CoinPurseApp } from "./coin-purse-app.js";

Hooks.once("init", () => {
  console.log("Coin Purse | Module initialized");
});

Hooks.on("getSceneControlButtons", controls => {
  controls[0].tools.push({
    name: "coin-purse",
    title: "Coin Purse",
    icon: "fas fa-coins",
    visible: game.user.character,
    onClick: () => {
      new CoinPurseApp().render(true);
    },
    button: true
  });
});