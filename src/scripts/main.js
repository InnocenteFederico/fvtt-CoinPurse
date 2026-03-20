import { CoinPurseApp } from "./coin-purse-app.js";

Hooks.once("init", () => {
  console.log("Coin Purse | Module initialized");

  // Registra l'impostazione per disabilitare l'electrum
  game.settings.register("coin-purse", "disableElectrum", {
    name: game.i18n.localize("settings.disableElectrum.name"),
    hint: game.i18n.localize("settings.disableElectrum.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

});

Hooks.on("getSceneControlButtons", controls => {
  console.log("Coin Purse | controls: ", controls);
  if (controls.tokens) {
    const tool = {
      name: "coin-purse",
      title: "Coin Purse",
      icon: "fas fa-coins",
      button: true,
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