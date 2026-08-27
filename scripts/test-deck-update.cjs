const assert = require('node:assert/strict');
const DeckUpdate = require('../deck-update.js');

const card = (id, deck, hash, media = []) => ({
  ankiCardId: String(id),
  deck,
  term: `term ${id}`,
  definition: `definition ${id}`,
  termMedia: media,
  definitionMedia: [],
  ankiContentHash: hash
});

const existing = [
  card(1, 'Anatomy', 'same', ['old-anatomy-image']),
  card(2, 'Anatomy', 'old'),
  card(3, 'Chemistry', 'chemistry', ['retained-chemistry-image'])
];
const incoming = [
  card(1, 'Anatomy', 'same', ['new-anatomy-image']),
  card(2, 'Anatomy', 'new'),
  card(4, 'Anatomy', 'added')
];

const update = DeckUpdate.plan(existing, incoming, 'update');
assert.deepEqual(update.cards.map(item => item.ankiCardId), ['3', '1', '2', '4']);
assert.deepEqual(update.stats, { added: 1, updated: 1, unchanged: 1, removed: 0, retained: 1, conflicts: 0 });
assert.equal(update.cards.find(item => item.ankiCardId === '3').deck, 'Chemistry');
assert.equal(update.cards.find(item => item.ankiCardId === '1').ankiContentHash, 'same');

const removal = DeckUpdate.plan(update.cards, [incoming[0], incoming[2]], 'update');
assert.deepEqual(removal.cards.map(item => item.ankiCardId), ['3', '1', '4']);
assert.deepEqual(removal.removedCards.map(item => item.ankiCardId), ['2']);
assert.equal(removal.stats.removed, 1);
assert.equal(removal.stats.retained, 1);

const replacement = DeckUpdate.plan(existing, incoming, 'replace');
assert.deepEqual(replacement.cards.map(item => item.ankiCardId), ['1', '2', '4']);
assert.deepEqual(replacement.removedCards.map(item => item.ankiCardId), ['3']);
assert.equal(replacement.stats.retained, 0);

const media = DeckUpdate.referencedMedia(update.cards);
assert.equal(media.has('retained-chemistry-image'), true);
assert.equal(media.has('new-anatomy-image'), true);
assert.equal(media.has('old-anatomy-image'), false);

const moved = DeckUpdate.plan(existing, [card(1, 'Biology', 'moved')], 'update');
assert.equal(moved.cards.filter(item => item.ankiCardId === '1').length, 1);
assert.equal(moved.cards.find(item => item.ankiCardId === '1').deck, 'Biology');

assert.throws(() => DeckUpdate.plan([], [card(1, 'A', 'x'), card(1, 'A', 'x')]), /duplicate card ID/i);
assert.throws(() => DeckUpdate.plan([], [{ deck: 'A' }]), /stable card ID/i);

const signatureInput = { deck: 'A', term: 'one', definition: 'two', termMedia: ['image.png'] };
assert.equal(DeckUpdate.contentHash(signatureInput), DeckUpdate.contentHash({ definition: 'two', termMedia: ['image.png'], term: 'one', deck: 'A' }));
assert.notEqual(DeckUpdate.contentHash(signatureInput), DeckUpdate.contentHash({ ...signatureInput, definition: 'changed' }));
assert.equal(DeckUpdate.hashBytes(new Uint8Array([1, 2, 3])), DeckUpdate.hashBytes(new Uint8Array([1, 2, 3])));
assert.notEqual(DeckUpdate.hashBytes(new Uint8Array([1, 2, 3])), DeckUpdate.hashBytes(new Uint8Array([1, 2, 4])));

console.log('Safe deck update checks passed.');
