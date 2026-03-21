import * as Constants from "../utils/constants.js";

/**
 * Returns the ordered list of currency types used by the module.
 *
 * The order is important for borrowing and minimization logic.
 * Electrum can be excluded depending on configuration.
 *
 * @param {{ disableElectrum: boolean }} currencyConfig
 * @returns {string[]} Ordered currency keys
 */
export function getCurrencyOrder(currencyConfig) {
  return currencyConfig.disableElectrum
    ? Constants.CURRENCY_ORDER.filter(type => type !== "ep")
    : [...Constants.CURRENCY_ORDER];
}

/**
 * Deducts currency from a purse, borrowing from higher denominations if needed.
 *
 * This function mutates the provided `current` currency object.
 *
 * @param {Object} current - Current currency values, mutated in place
 * @param {Object} changes - Currency amounts to subtract
 * @param {{ disableElectrum: boolean }} currencyConfig
 * @returns {boolean} True if deduction succeeds, false if total funds are insufficient
 */
export function deductCurrencyWithBorrowing(current, changes, currencyConfig) {
  const currencyOrder = getCurrencyOrder(currencyConfig);

  for (let i = 0; i < currencyOrder.length; i++) {
    const type = currencyOrder[i];
    current[type] = (current[type] ?? 0) - (changes[type] ?? 0);

    while (current[type] < 0 && i + 1 < currencyOrder.length) {
      let borrowIndex = i + 1;

      while (
        borrowIndex < currencyOrder.length &&
        (current[currencyOrder[borrowIndex]] ?? 0) <= 0
      ) {
        borrowIndex++;
      }

      if (borrowIndex >= currencyOrder.length) return false;

      for (let j = borrowIndex; j > i; j--) {
        const fromType = currencyOrder[j];
        const toType = currencyOrder[j - 1];

        current[fromType]--;
        const conversion =
          Constants.CURRENCY_CONVERSION[fromType] /
          Constants.CURRENCY_CONVERSION[toType];

        current[toType] = (current[toType] ?? 0) + conversion;
      }
    }

    if (current[type] < 0) return false;
  }

  return true;
}

/**
 * Transfers currency from one purse to another.
 *
 * This function mutates both currency objects.
 *
 * @param {Object} senderCurrency - Source currency, mutated in place
 * @param {Object} recipientCurrency - Destination currency, mutated in place
 * @param {Object} changes - Currency amounts to transfer
 * @param {{ disableElectrum: boolean }} currencyConfig
 * @returns {{ success: boolean, reason?: string }}
 */
export function transferCurrencyBetweenPurses(
  senderCurrency,
  recipientCurrency,
  changes,
  currencyConfig
) {
  const success = deductCurrencyWithBorrowing(
    senderCurrency,
    changes,
    currencyConfig
  );

  if (!success) {
    return {
      success: false,
      reason: "notEnoughCurrencyTotal"
    };
  }

  for (const type in changes) {
    recipientCurrency[type] =
      (recipientCurrency[type] ?? 0) + (changes[type] ?? 0);
  }

  return { success: true };
}

/**
 * Converts lower denominations into higher ones to minimize the total number of coins.
 *
 * Returns a new currency object.
 *
 * @param {Object} currency
 * @param {{ disableElectrum: boolean }} currencyConfig
 * @returns {Object}
 */
export function minimizeCurrency(currency, currencyConfig) {
  const current = foundry.utils.deepClone(currency ?? {});
  const currencyOrder = getCurrencyOrder(currencyConfig);

  for (let i = 0; i < currencyOrder.length - 1; i++) {
    const fromType = currencyOrder[i];
    const toType = currencyOrder[i + 1];

    if ((current[fromType] ?? 0) > 0) {
      const conversion =
        Constants.CURRENCY_CONVERSION[toType] /
        Constants.CURRENCY_CONVERSION[fromType];

      current[toType] =
        (current[toType] ?? 0) + Math.floor(current[fromType] / conversion);

      current[fromType] %= conversion;
    }
  }

  return current;
}