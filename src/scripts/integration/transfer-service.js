import {
  deductCurrencyWithBorrowing,
  transferCurrencyBetweenPurses,
  minimizeCurrency
} from "../domain/currency-service.js";

/**
 * Applies a currency change to a single actor.
 *
 * If `isReceiving` is true, currency is added directly.
 * Otherwise, currency is deducted using borrowing rules.
 *
 * @param {Object} params
 * @param {Actor} params.actor
 * @param {Object} params.changes
 * @param {boolean} params.isReceiving
 * @param {Object} params.currencyConfig
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function applyCurrencyChangeToActor({
  actor,
  changes,
  isReceiving,
  currencyConfig
}) {
  const current = foundry.utils.deepClone(actor.system.currency ?? {});

  if (isReceiving) {
    for (const type in changes) {
      current[type] = (current[type] ?? 0) + changes[type];
    }
  } else {
    const success = deductCurrencyWithBorrowing(
      current,
      changes,
      currencyConfig
    );

    if (!success) {
      return {
        success: false,
        reason: "notEnoughCurrencyTotal"
      };
    }
  }

  await actor.update({ "system.currency": current });

  return { success: true };
}

/**
 * Minimizes the currency of an actor by converting lower denominations
 * into higher ones where possible.
 *
 * @param {Object} params
 * @param {Actor} params.actor
 * @param {Object} params.currencyConfig
 * @returns {Promise<{ success: boolean }>}
 */
export async function minimizeActorCurrency({
  actor,
  currencyConfig
}) {
  const current = minimizeCurrency(actor.system.currency ?? {}, currencyConfig);

  await actor.update({ "system.currency": current });

  return { success: true };
}

/**
 * Transfers currency from one actor to another.
 *
 * Both actor documents are updated if the transfer succeeds.
 *
 * @param {Object} params
 * @param {Actor} params.sender
 * @param {Actor} params.recipient
 * @param {Object} params.changes
 * @param {Object} params.currencyConfig
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function sendCurrencyBetweenActors({
  sender,
  recipient,
  changes,
  currencyConfig
}) {
  const senderCurrency = foundry.utils.deepClone(sender.system.currency ?? {});
  const recipientCurrency = foundry.utils.deepClone(recipient.system.currency ?? {});

  const result = transferCurrencyBetweenPurses(
    senderCurrency,
    recipientCurrency,
    changes,
    currencyConfig
  );

  if (!result.success) return result;

  await sender.update({ "system.currency": senderCurrency });
  await recipient.update({ "system.currency": recipientCurrency });

  return { success: true };
}

/**
 * Executes a currency transfer as GM.
 *
 * This function is intended to be called remotely through socketlib,
 * so that player clients do not need direct update permissions on the recipient actor.
 *
 * @param {Object} params
 * @param {string} params.senderId
 * @param {string} params.recipientId
 * @param {Object} params.changes
 * @param {Object} params.currencyConfig
 * @returns {Promise<{success: boolean, reason?: string, recipientName?: string}>}
 */
export async function transferCurrencyAsGM({
  senderId,
  recipientId,
  changes,
  currencyConfig
}) {

  const sender = game.actors.get(senderId);
  const recipient = game.actors.get(recipientId);

  if (!sender) {
    return {
      success: false,
      reason: "invalidSender"
    };
  }

  if (!recipient) {
    return {
      success: false,
      reason: "invalidRecipient"
    };
  }

  const result = await sendCurrencyBetweenActors({
    sender,
    recipient,
    changes,
    currencyConfig
  });

  if (!result.success) return result;

  return {
    success: true,
    recipientName: recipient.name
  };
}