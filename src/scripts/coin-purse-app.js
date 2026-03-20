import * as Constants from "./utils/constants.js";

export class CoinPurseApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "coin-purse-app",
      title: "Coin Purse",
      template: "modules/coin-purse/src/templates/coin-purse.hbs",
      width: 600,
      height: "auto",
      resizable: true
    });
  }

  constructor(options = {}) {
    super(options);
  }

  getData() {
    const actor = game.user.character;

    // Se non c'è un personaggio collegato
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("labels.noCharacterSelected"));
      return {};
    }

    const currency = actor.system.currency ?? {};
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");

    // Filtra la valuta se electrum è disabilitato
    const filteredCurrency = { ...currency };
    if (disableElectrum) {
      delete filteredCurrency.ep;
    }

    return {
      currency: filteredCurrency,
      disableElectrum: disableElectrum
    };
  }

  _getCurrencyOrder() {
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");
    return disableElectrum
      ? Constants.CURRENCY_ORDER.filter(type => type !== "ep")
      : Constants.CURRENCY_ORDER;
  }

  _collectFormData(html) {
    const data = {};
    const disableElectrum = game.settings.get("coin-purse", "disableElectrum");
    const types = Constants.CURRENCY_ORDER;
    if (disableElectrum) {
      const index = types.indexOf("ep");
      if (index >= 0) {
        types.splice(index, 1);
      }
    }

    types.forEach(type => {
      const val = parseInt(html.find(`input[name="${type}"]`).val());
      data[type] = isNaN(val) ? 0 : val;
    });
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Logica applicativa
    const actor = game.user.character;
    if (!actor) return;

    // Handler del click sul bottone per aggiungere monete
    html.find('button[name="receive"]').on("click", () => {
      const updates = this._collectFormData(html);
      this._applyCurrencyChange(actor, updates, true);
    });

    // Handler del click sul bottone per pagare
    html.find('button[name="pay"]').on("click", () => {
      const updates = this._collectFormData(html);
      this._applyCurrencyChange(actor, updates, false);
    });

    // Handler del click sul bottone per convertire
    html.find('button[name="convert"]').on("click", () => {
      this._minimizeCurrency(actor);
    });
  }

  _applyCurrencyChange(actor, changes, isReceiving) {
    const current = foundry.utils.duplicate(actor.system.currency);

    // Gestione del caso di aggiunta monete
    if (isReceiving) {
      for (const type in changes) {
        current[type] += changes[type];
      }

      // Gestione del caso di pagamento con borrowing
    } else {
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

    actor.update({ "system.currency": current }).then(() => {
      this.element.find('input[type="number"]').val('');
      this.render(false);
    });
  }

  /*** 
   * Funzione per minimizzare la valuta a quella più alta possibile, convertendo a cascata
  */
  _minimizeCurrency(actor) {
    const current = foundry.utils.duplicate(actor.system.currency);
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

    actor.update({ "system.currency": current }).then(() => {
      this.element.find('input[type="number"]').val('');
      this.render(false);
    });
  }
}