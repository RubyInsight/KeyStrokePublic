const assert = require('node:assert/strict');
const dropImport = require('../drop-import.js');

for (const name of ['biology.apkg', 'all-decks.colpkg', 'COLLECTION.COLPKG', 'notes.TXT', 'cards.tsv', 'deck.CSV']) {
  assert.equal(dropImport.supports(name), true, `${name} should be supported`);
}

for (const name of ['deck.apkg.zip', 'notes.pdf', '', 'cards.json']) {
  assert.equal(dropImport.supports(name), false, `${name || 'blank name'} should be rejected`);
}

assert.equal(dropImport.hasFiles(['text/plain', 'Files']), true);
assert.equal(dropImport.hasFiles(['text/plain']), false);

const cardFile = { name: 'class.apkg' };
assert.deepEqual(dropImport.selectFiles([]), { file: null, error: '' });
assert.equal(dropImport.selectFiles([cardFile]).file, cardFile);
assert.equal(dropImport.selectFiles([{ name: 'class.colpkg' }]).file.name, 'class.colpkg');
assert.match(dropImport.selectFiles([{ name: 'one.apkg' }, { name: 'two.apkg' }]).error, /one .* at a time/i);
assert.match(dropImport.selectFiles([{ name: 'unsafe.pdf' }]).error, /\.apkg.*\.colpkg.*\.txt.*\.tsv.*\.csv/i);

console.log('Drag-and-drop import checks passed.');
