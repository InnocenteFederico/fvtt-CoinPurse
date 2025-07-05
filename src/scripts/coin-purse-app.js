import * as Constants from "./utils/constants.js";

export class CoinPurseApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "coin-purse-app",
      title: "Coin Purse",
      template: "modules/coin-purse/src/templates/coin-purse.hbs",
      width: 600,
      height: "auto",
      resizable: true,
      applyConversion: this._applyConversion
    });
  }

  constructor(options = {}) {
    super(options);
    this._applyConversion = true; // default iniziale
  }

  getData() {
    const actor = game.user.character;

    // Se non c'è un personaggio collegato
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("labels.noCharacterSelected"));
      return {};
    }

    const currency = actor.system.currency ?? {};

    return {
      currency: currency,
      applyConversion: this._applyConversion
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Logica applicativa
    const actor = game.user.character;
    if (!actor) return;

    html.find("#applyConversion").on("change", ev => {
      this._applyConversion = ev.currentTarget.checked;
    });


    html.find('button[name="receive"]').on("click", () => {
      const updates = this._collectFormData(html);
      this._applyCurrencyChange(actor, updates, true);
    });

    html.find('button[name="pay"]').on("click", () => {
      const updates = this._collectFormData(html);
      this._applyCurrencyChange(actor, updates, false, this._applyConversion);
    });
  }

  _collectFormData(html) {
    const data = {};
    ["cp", "sp", "ep", "gp", "pp"].forEach(type => {
      const val = parseInt(html.find(`input[name="${type}"]`).val());
      data[type] = isNaN(val) ? 0 : val;
    });
    return data;
  }

  _applyCurrencyChange(actor, changes, isReceiving, applyConversion = false) {
    const current = foundry.utils.duplicate(actor.system.currency);

    if (isReceiving) {
      for (const type in changes) {
        current[type] += changes[type];
      }
    } else {
      if (!applyConversion) {
        // Pagamento diretto, senza conversione
        for (const type in changes) {
          if (current[type] < changes[type]) {
            const label = game.i18n.localize(`currency.${type}`);
            ui.notifications.warn(game.i18n.format("notifications.notEnoughCurrency", { currency: label }));
            return;
          }
        }

        for (const type in changes) {
          current[type] -= changes[type];
        }
      } else {
        // Pagamento con conversione
        let currentValue = 0;
        let changeValue = 0;
        for (const i in Constants.CURRENCY_ORDER) {
          const type = Constants.CURRENCY_ORDER[i];
          currentValue += current[type] * Constants.CURRENCY_CONVERSION[type];
          changeValue += changes[type] * Constants.CURRENCY_CONVERSION[type];
        }
        if (changeValue > currentValue) {
          ui.notifications.warn(game.i18n.format("notifications.notEnoughCurrencyTotal"));
          return;
        }

        currentValue -= changeValue;
        for (let i = Constants.CURRENCY_ORDER.length - 1; i >= 0; i--) {
          const type = Constants.CURRENCY_ORDER[i];
          const typeValue = Math.floor(currentValue / Constants.CURRENCY_CONVERSION[type]);
          current[type] = typeValue;
          currentValue -= typeValue * Constants.CURRENCY_CONVERSION[type];
        }
      }
    }

    actor.update({ "system.currency": current }).then(() => {
      this.element.find('input[type="number"]').val('');
      this.render(false);
    });
  }
}