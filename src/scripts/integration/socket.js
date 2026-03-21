let coinPurseSocket = null;
let transferHandler = null;

/**
 * Registers the module socket and remote handlers.
 *
 * @param {Function} transferCurrencyAsGMHandler
 */
export function registerCoinPurseSocket(transferCurrencyAsGMHandler) {
  transferHandler = transferCurrencyAsGMHandler;
  initializeSocket();
}

/**
 * Creates the socket instance if possible.
 */
function initializeSocket() {
  if (coinPurseSocket) return;
  if (!game.modules.get("socketlib")?.active) return;
  if (!transferHandler) return;

  coinPurseSocket = socketlib.registerModule("coin-purse");
  coinPurseSocket.register("transferCurrencyAsGM", transferHandler);
}

/**
 * Returns the socket instance for this module.
 *
 * @returns {object | null}
 */
export function getCoinPurseSocket() {
  initializeSocket();
  return coinPurseSocket;
}