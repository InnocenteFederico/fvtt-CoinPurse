import { getCurrencyOrder } from "./domain/currency-service.js";
import {
  applyCurrencyChangeToActor,
  minimizeActorCurrency
} from "./integration/transfer-service.js";
import { getCoinPurseSocket } from "./integration/socket.js";
import { createTransferChatMessage } from "./integration/chat-service.js";

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

  constructor(options = {}) {
    super(options);
    this.mode = "manage"; // Modalità iniziale, può essere "manage" o "send"
    this.selectedRecipientId = null;

    // Il bind mi serve per poter chiudere il dropdown quando clicco fuori, altrimenti rimarrebbe aperto
    this._onDocumentClick = this._onDocumentClick.bind(this);
  }

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

    const recipients = game.actors
      .filter(a => a.type === "character" && a.id !== actor.id)
      .map(a => ({
        id: a.id,
        name: a.name,
        img: a.prototypeToken?.texture?.src || a.img
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const selectedRecipient = recipients.find(r => r.id === this.selectedRecipientId) ?? null;

    return {
      actor,
      currency,
      disableElectrum,
      mode: this.mode,
      recipients,
      selectedRecipient
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    if (partId !== "body") return;

    const actor = game.user.character;
    if (!actor) return;

    // Handler per il toggle tra modalità "manage" e "send"
    htmlElement.querySelectorAll("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.mode = btn.dataset.mode;
        this.render();
      });
    });

    // Se siamo in modalità "manage", mostriamo i controlli per gestire la valuta
    if (this.mode === "manage") {
      // Handler del click sul bottone per aggiungere monete
      htmlElement.querySelector('button[name="receive"]')?.addEventListener("click", () => {
        const updates = this._getCurrencyChangesFromInputs();
        this._applyCurrencyChange(actor, updates, true);
      });

      // Handler del click sul bottone per pagare
      htmlElement.querySelector('button[name="pay"]')?.addEventListener("click", () => {
        const updates = this._getCurrencyChangesFromInputs();
        this._applyCurrencyChange(actor, updates, false);
      });

      // Handler del click sul bottone per convertire
      htmlElement.querySelector('button[name="convert"]')?.addEventListener("click", () => {
        this._minimizeCurrency(actor);
      });
    }

    // Se siamo in modalità "send", mostriamo i controlli per inviare monete ad altri personaggi
    if (this.mode === "send") {
      document.removeEventListener("click", this._onDocumentClick);
      document.addEventListener("click", this._onDocumentClick);

      const container = htmlElement.querySelector(".coin-recipient-select");
      const selected = container?.querySelector(".recipient-selected");
      const dropdown = container?.querySelector(".recipient-options");

      selected?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropdown?.classList.toggle("hidden");
      });

      htmlElement.querySelectorAll(".recipient-option").forEach(el => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          this.selectedRecipientId = el.dataset.id;

          const recipientName =
            el.querySelector(".recipient-name")?.textContent?.trim() ?? "";
          const recipientImg =
            el.querySelector(".recipient-avatar")?.getAttribute("src") ?? "";

          if (selected) {
            selected.innerHTML = `
        <img src="${recipientImg}" class="recipient-avatar" alt="${recipientName}">
        <span class="recipient-name">${recipientName}</span>
        <i class="fas fa-chevron-down"></i>
      `;
          }

          dropdown?.classList.add("hidden");

          htmlElement.querySelectorAll(".recipient-option").forEach(option => {
            option.classList.toggle("selected", option === el);
          });

          this._updateSendButtonState(htmlElement);
        });
      });

      // Gestisce il disable del bottone di invio se non è stato selezionato un destinatario o se non sono state inserite quantità
      htmlElement.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener("input", () => {
          this._updateSendButtonState(htmlElement);
        });
      });
      this._updateSendButtonState(htmlElement);

      htmlElement.querySelector('button[name="send"]')?.addEventListener("click", () => {
        this._sendCurrency(actor);
      });
    } else {
      document.removeEventListener("click", this._onDocumentClick);
    }
  }

  /**
 * Reads numeric inputs from the form and returns them as a currency change object.
 *
 * Invalid or empty values are treated as 0.
 *
 * @returns {Object}
 */
  _getCurrencyChangesFromInputs() {
    const data = {};
    const types = getCurrencyOrder(this._getCurrencyConfig());

    for (const type of types) {
      const input = this.element.querySelector(`input[name="${type}"]`);
      const val = Number.parseInt(input?.value ?? "0", 10);
      data[type] = Number.isNaN(val) ? 0 : val;
    }

    return data;
  }

  /**
  * Builds the configuration object used by currency domain services.
  *
  * Keeping configuration centralized avoids changing every function signature
  * when new module settings are added in the future.
  *
  * @returns {{ disableElectrum: boolean }}
  */
  _getCurrencyConfig() {
    return {
      disableElectrum: game.settings.get("coin-purse", "disableElectrum")
    };
  }

  // ==== Gestione della modalità manage (ricevere, pagare, convertire) ====

  /**
 * Applies a currency modification to the current actor.
 *
 * Supports both receiving (addition) and paying (deduction with borrowing).
 *
 * @param {Actor} actor
 * @param {Object} changes
 * @param {boolean} isReceiving
 */
  async _applyCurrencyChange(actor, changes, isReceiving) {
    const result = await applyCurrencyChangeToActor({
      actor,
      changes,
      isReceiving,
      currencyConfig: this._getCurrencyConfig()
    });

    if (!result.success) {
      ui.notifications.warn(
        game.i18n.localize("notifications.notEnoughCurrencyTotal")
      );
      return;
    }

    this.element.querySelectorAll('input[type="number"]').forEach(i => {
      i.value = "";
    });

    this.render();
  }

  /**
 * Minimizes the actor currency by converting lower denominations into higher ones.
 *
 * @param {Actor} actor
 */
  async _minimizeCurrency(actor) {
    await minimizeActorCurrency({
      actor,
      currencyConfig: this._getCurrencyConfig()
    });

    this.element.querySelectorAll('input[type="number"]').forEach(i => {
      i.value = "";
    });

    this.render();
  }

  // ==== Gestione della modalità send ====

  /**
 * Sends currency from the current actor to the selected recipient actor.
 *
 * The actual transfer is executed on a GM client via socketlib so that
 * players do not need direct ownership of the recipient actor.
 *
 * @param {Actor} sender
 */
  async _sendCurrency(sender) {
    const recipientId = this.selectedRecipientId;

    if (!recipientId) {
      ui.notifications.warn(
        game.i18n.localize("notifications.noRecipientSelected")
      );
      return;
    }

    const recipient = game.actors.get(recipientId);
    if (!recipient) {
      ui.notifications.warn(
        game.i18n.localize("notifications.invalidRecipient")
      );
      return;
    }

    const changes = this._getCurrencyChangesFromInputs();
    const hasAnyValue = Object.values(changes).some(v => v > 0);

    if (!hasAnyValue) {
      ui.notifications.warn(
        game.i18n.localize("notifications.noCurrencyEntered")
      );
      return;
    }

    const socket = getCoinPurseSocket();
    if (!socket) {
      ui.notifications.error(
        game.i18n.localize("notifications.transferSystemNotReady")
      );
      return;
    }

    let result;
    try {
      result = await socket.executeAsGM("transferCurrencyAsGM", {
        senderId: sender.id,
        recipientId,
        changes,
        currencyConfig: this._getCurrencyConfig()
      });
    } catch (error) {
      ui.notifications.error(
        game.i18n.localize("notifications.transferFailed")
      );

      return;
    }

    if (!result?.success) {
      const reason = result?.reason ?? "transferFailed";
      ui.notifications.warn(game.i18n.localize(`notifications.${reason}`));
      return;
    }

    this.element.querySelectorAll('input[type="number"]').forEach(i => {
      i.value = "";
    });

    if (game.settings.get("coin-purse", "postTransferChatMessage")) {
      await createTransferChatMessage(
        sender,
        recipient,
        changes
      );
    }

    this.render();
  }

  _updateSendButtonState(htmlElement) {
    const sendButton = htmlElement.querySelector('button[name="send"]');
    if (!sendButton) return;

    const hasRecipient = !!this.selectedRecipientId;

    const changes = this._getCurrencyChangesFromInputs();
    const hasValues = Object.values(changes).some(v => v > 0);

    sendButton.disabled = !(hasRecipient && hasValues);
  }

  _onDocumentClick(event) {
    if (this.mode !== "send") return;
    if (!this.element) return;

    const container = this.element.querySelector(".coin-recipient-select");
    const dropdown = this.element.querySelector(".recipient-options");

    if (!container || !dropdown) return;

    if (!container.contains(event.target)) {
      dropdown.classList.add("hidden");
    }
  }

}
