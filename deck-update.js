(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeystrokeDeckUpdate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cardId(card) {
    return card?.ankiCardId == null ? '' : String(card.ankiCardId);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    }
    return value;
  }

  function hash(value) {
    const source = JSON.stringify(stableValue(value));
    let result = 2166136261;
    for (let index = 0; index < source.length; index++) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function hashBytes(bytes) {
    let result = 2166136261;
    for (const byte of bytes || []) {
      result ^= byte;
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function contentHash(card) {
    return hash({
      deck: card.deck || '',
      term: card.term || '',
      definition: card.definition || '',
      answerExtra: card.answerExtra || '',
      termMedia: card.termMedia || [],
      definitionMedia: card.definitionMedia || [],
      termOcclusions: card.termOcclusions || [],
      definitionOcclusions: card.definitionOcclusions || [],
      manual: Boolean(card.manual),
      ankiKind: card.ankiKind || '',
      ankiCardOrdinal: Number(card.ankiCardOrdinal) || 0
    });
  }

  function referencedMedia(cards) {
    return new Set((cards || []).flatMap(card => [
      ...(card.termMedia || []),
      ...(card.definitionMedia || [])
    ]).filter(Boolean));
  }

  function plan(existingCards, incomingCards, strategy = 'update') {
    const existing = Array.isArray(existingCards) ? existingCards : [];
    const incoming = Array.isArray(incomingCards) ? incomingCards : [];
    if (!['update', 'replace'].includes(strategy)) throw new Error('Unknown deck import strategy.');
    if (!incoming.length) throw new Error('An updated deck must contain at least one card.');

    const incomingIds = new Set();
    const duplicateIds = new Set();
    for (const card of incoming) {
      const id = cardId(card);
      if (!id) throw new Error('An imported Anki card is missing its stable card ID.');
      if (incomingIds.has(id)) duplicateIds.add(id);
      incomingIds.add(id);
    }
    if (duplicateIds.size) throw new Error(`The Anki package contains ${duplicateIds.size} duplicate card ID${duplicateIds.size === 1 ? '' : 's'}.`);

    const existingById = new Map(existing.map(card => [cardId(card), card]).filter(([id]) => id));
    const targetDecks = new Set(incoming.map(card => card.deck || 'Unfiled'));
    const retained = strategy === 'replace'
      ? []
      : existing.filter(card => !incomingIds.has(cardId(card)) && !targetDecks.has(card.deck || 'Unfiled'));

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    for (const card of incoming) {
      const previous = existingById.get(cardId(card));
      if (!previous) added++;
      else if (previous.ankiContentHash && previous.ankiContentHash === card.ankiContentHash) unchanged++;
      else updated++;
    }

    const removedCards = existing.filter(card => {
      const id = cardId(card);
      if (id && incomingIds.has(id)) return false;
      return strategy === 'replace' || targetDecks.has(card.deck || 'Unfiled');
    });
    const cards = [...retained, ...incoming];
    const outputIds = cards.map(cardId).filter(Boolean);
    if (new Set(outputIds).size !== outputIds.length) throw new Error('The deck update would create duplicate Anki cards, so nothing was changed.');

    return {
      cards,
      removedCards,
      targetDecks: [...targetDecks],
      stats: {
        added,
        updated,
        unchanged,
        removed: removedCards.length,
        retained: retained.length,
        conflicts: 0
      }
    };
  }

  return { cardId, contentHash, hashBytes, plan, referencedMedia };
});
