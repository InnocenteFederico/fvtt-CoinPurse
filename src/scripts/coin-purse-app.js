import * as Constants from "./utils/constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CoinPurseApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "coin-purse-app",
    window: {
      title: "Coin Purse",
      resizable: true
    },
    position: {
      width: 600,
      height: "auto"
    }
  };

  static PARTS = {
    body: {
      template: "modules/coin-purse/src/templates/coin-purse.hbs"
    }
  };

  async _prepareContext(_options) {
    const actor = game.user.character;

    if (!actor) {
      ui.notifications.warn(game.i18n.localize("labels.noCharacterSelected"));
      return {
        currency: {},
        disableElectrum: game.settings.get("coin-purse", "disableElectrum")
      };
    }

    const currency = foundry.utils.deepClone(actor.system.currency ?? {});
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");

    if (disableElectrum) delete currency.ep;

    return {
      actor,
      currency,
      disableElectrum
    };
  }

  _getCurrencyOrder() {
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");
    return disableElectrum
      ? Constants.CURRENCY_ORDER.filter(type => type !== "ep")
      : Constants.CURRENCY_ORDER;
  }

  _collectFormData() {
    const data = {};
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");

    const types = disableElectrum
      ? Constants.CURRENCY_ORDER.filter(type => type !== "ep")
      : [...Constants.CURRENCY_ORDER];

    for (const type of types) {
      const input = this.element.querySelector(`input[name="${type}"]`);
      const val = Number.parseInt(input?.value ?? "0", 10);
      data[type] = Number.isNaN(val) ? 0 : val;
    }

    return data;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    if (partId !== "body") return;

    const actor = game.user.character;
    if (!actor) return;

    // Handler del click sul bottone per aggiungere monete
    htmlElement.querySelector('button[name="receive"]')?.addEventListener("click", () => {
      const updates = this._collectFormData();
      this._applyCurrencyChange(actor, updates, true);
    });

    // Handler del click sul bottone per pagare
    htmlElement.querySelector('button[name="pay"]')?.addEventListener("click", () => {
      const updates = this._collectFormData();
      this._applyCurrencyChange(actor, updates, false);
    });

    // Handler del click sul bottone per convertire
    htmlElement.querySelector('button[name="convert"]')?.addEventListener("click", () => {
      this._minimizeCurrency(actor);
    });
  }

  async _applyCurrencyChange(actor, changes, isReceiving) {
    const current = foundry.utils.deepClone(actor.system.currency ?? {});

    if (isReceiving) { // Gestione del caso di aggiunta monete
      for (const type in changes) {
        current[type] += changes[type];
      }
    } else { // Gestione del caso di pagamento con borrowing
      const currencyOrder = this._getCurrencyOrder();
      for (let i = 0; i < currencyOrder.length; i++) {
        const type = currencyOrder[i];
        current[type] -= changes[type];

        // Se negativo, prendi in prestito da monete superiori
        while (current[type] < 0 && i + 1 < currencyOrder.length) {
          // Trova la prima moneta superiore con valore > 0
          let borrowIndex = i + 1;
          while (borrowIndex < currencyOrder.length && current[currencyOrder[borrowIndex]] <= 0) {
            borrowIndex++;
          }

          if (borrowIndex >= currencyOrder.length) {
            // Non ci sono monete disponibili da cui prendere in prestito
            ui.notifications.warn(game.i18n.format("notifications.notEnoughCurrencyTotal"));
            return;
          }

          // Converti a cascata da borrowIndex a i
          for (let j = borrowIndex; j > i; j--) {
            const fromType = currencyOrder[j];
            const toType = currencyOrder[j - 1];
            // Fai il borrowing da fromType a toType
            current[fromType]--;
            const conversion = Constants.CURRENCY_CONVERSION[fromType] / Constants.CURRENCY_CONVERSION[toType];
            current[toType] += conversion;
          }
        }

        if (current[type] < 0) {
          // Ancora negativo? Non abbiamo abbastanza monete in totale
          ui.notifications.warn(game.i18n.format("notifications.notEnoughCurrencyTotal"));
          return;
        }
      }
    }

    await actor.update({ "system.currency": current });

    this.element.querySelectorAll('input[type="number"]').forEach(i => {
      i.value = "";
    });

    this.render();
  }

  /*** 
   * Funzione per minimizzare la valuta a quella più alta possibile, convertendo a cascata
  */
  async _minimizeCurrency(actor) {
    const current = foundry.utils.deepClone(actor.system.currency ?? {});
    const currencyOrder = this._getCurrencyOrder();

    for (let i = 0; i < currencyOrder.length - 1; i++) {
      const fromType = currencyOrder[i];
      const toType = currencyOrder[i + 1];

      if (current[fromType] > 0) {
        const conversion = Constants.CURRENCY_CONVERSION[toType] / Constants.CURRENCY_CONVERSION[fromType];
        current[toType] += Math.floor(current[fromType] / conversion);
        current[fromType] %= conversion;
      }
    }

    await actor.update({ "system.currency": current });

    this.element.querySelectorAll('input[type="number"]').forEach(i => {
      i.value = "";
    });

    this.render();
  }
}