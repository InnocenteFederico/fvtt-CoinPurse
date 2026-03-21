/**
 * Creates a chat message describing a successful currency transfer.
 *
 * The message is authored by the current user and uses the sender actor as speaker.
 *
 * @param {Actor} sender
 * @param {Actor} recipient
 * @param {Object} changes
 * @returns {Promise<void>}
 */
export async function createTransferChatMessage(
  sender,
  recipient,
  changes
) {

  if (!sender || !recipient)
    return;

  const entries = Object.entries(changes)
    .filter(([, value]) => value > 0)
    .map(([type, value]) => `${value} ${game.i18n.localize(`currency.${type}`)}`);

  if (!entries.length) return;

  const amounts = entries.join(", ");

  const content = game.i18n.format("functions.send.messages.transferMessage", {
    sender: sender.name,
    recipient: recipient.name,
    amounts
  });

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: sender }),
    content
  });
}