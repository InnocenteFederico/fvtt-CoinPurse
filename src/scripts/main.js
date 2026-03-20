import { CoinPurseApp } from "./coin-purse-app.js";

Hooks.once("init", () => {
  console.log("Coin Purse | Module initialized");
});

Hooks.on("getSceneControlButtons", controls => {
  if (controls.tokens) {
    const tool = {
      name: "coin-purse",
      title: "Coin Purse",
      icon: "fas fa-coins",
      visible: true,
      onClick: () => {
        console.log("Coin Purse | Button clicked");
        new CoinPurseApp().render(true);
      }
    };
    if (Array.isArray(controls.tokens.tools)) {
      controls.tokens.tools.push(tool);
    } else if (controls.tokens.tools.set) {
      controls.tokens.tools.set("coin-purse", tool);
    } else if (typeof controls.tokens.tools === 'object') {
      controls.tokens.tools['coin-purse'] = tool;
    } else {
      console.error("Coin Purse | Unknown structure, cannot add tool");
    }
  } else {
    console.error("Coin Purse | controls.tokens does not exist");
  }
});