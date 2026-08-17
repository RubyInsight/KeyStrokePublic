(function () {
  const DB_NAME = 'keystroke.library.v1';
  const DB_VERSION = 1;
  const MAX_PACKAGE_BYTES = 500 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
  const IMAGE_TYPES = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp'
  };

  let databasePromise;
  let sqlPromise;
  const AnkiCards = window.KeystrokeAnkiCards;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Browser storage failed.'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Browser storage failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Browser storage was cancelled.'));
    });
  }

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support persistent deck storage.'));
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open persistent deck storage.'));
      });
    }
    return databasePromise;
  }

  async function replaceLibrary(cards, media, name) {
    const db = await openDatabase();
    const transaction = db.transaction(['library', 'media'], 'readwrite');
    const libraryStore = transaction.objectStore('library');
    const mediaStore = transaction.objectStore('media');
    libraryStore.clear();
    mediaStore.clear();
    libraryStore.put({ key: 'current', cards, name, savedAt: new Date().toISOString() });
    for (const item of media.values()) mediaStore.put(item);
    await transactionDone(transaction);
  }

  async function loadLibrary() {
    const db = await openDatabase();
    return requestResult(db.transaction('library', 'readonly').objectStore('library').get('current'));
  }

  async function getMedia(key) {
    if (!key) return null;
    const db = await openDatabase();
    return requestResult(db.transaction('media', 'readonly').objectStore('media').get(key));
  }

  async function clearLibrary() {
    const db = await openDatabase();
    const transaction = db.transaction(['library', 'media'], 'readwrite');
    transaction.objectStore('library').clear();
    transaction.objectStore('media').clear();
    await transactionDone(transaction);
  }

  async function deleteDeck(deck = null) {
    const library = await loadLibrary();
    const originalCards = Array.isArray(library?.cards) ? library.cards : [];
    const cards = deck == null ? [] : originalCards.filter(card => card.deck !== deck);
    const removed = originalCards.length - cards.length;
    if (!removed) return { cards: originalCards, removed: 0 };

    const retainedMedia = new Set(cards.flatMap(card => [
      ...(card.termMedia || []),
      ...(card.definitionMedia || [])
    ]));
    const db = await openDatabase();
    const transaction = db.transaction(['library', 'media'], 'readwrite');
    const libraryStore = transaction.objectStore('library');
    const mediaStore = transaction.objectStore('media');

    if (cards.length) {
      libraryStore.put({
        key: 'current',
        cards,
        name: library.name,
        savedAt: new Date().toISOString()
      });
      const cursorRequest = mediaStore.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (!retainedMedia.has(cursor.key)) cursor.delete();
        cursor.continue();
      };
    } else {
      libraryStore.clear();
      mediaStore.clear();
    }

    await transactionDone(transaction);
    return { cards, removed };
  }

  function sqlRows(db, statement) {
    const result = db.exec(statement)[0];
    if (!result) return [];
    return result.values.map(values => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])));
  }

  function tableExists(db, name) {
    const escaped = String(name).replace(/'/g, "''");
    return sqlRows(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${escaped}'`).length > 0;
  }

  function cleanDeckName(name) {
    return String(name || 'Unfiled').replace(/\x1f/g, '::').trim() || 'Unfiled';
  }

  function deckNames(db) {
    const names = new Map();
    if (tableExists(db, 'decks')) {
      for (const row of sqlRows(db, 'SELECT id, name FROM decks')) names.set(String(row.id), cleanDeckName(row.name));
      return names;
    }
    const legacy = sqlRows(db, 'SELECT decks FROM col LIMIT 1')[0]?.decks;
    if (!legacy) return names;
    const parsed = JSON.parse(legacy);
    for (const [id, deck] of Object.entries(parsed)) names.set(String(id), cleanDeckName(deck.name));
    return names;
  }

  function noteTypeDetails(db) {
    const details = new Map();
    if (tableExists(db, 'notetypes')) {
      for (const row of sqlRows(db, 'SELECT id, name FROM notetypes')) {
        details.set(String(row.id), { name: row.name, fields: [], templates: [] });
      }
      for (const row of sqlRows(db, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) {
        const detail = details.get(String(row.ntid));
        if (detail) detail.fields[Number(row.ord)] = row.name;
      }
      for (const row of sqlRows(db, 'SELECT ntid, ord, name FROM templates ORDER BY ntid, ord')) {
        const detail = details.get(String(row.ntid));
        if (detail) detail.templates[Number(row.ord)] = row.name;
      }
      return details;
    }
    const legacy = sqlRows(db, 'SELECT models FROM col LIMIT 1')[0]?.models;
    if (!legacy) return details;
    const models = JSON.parse(legacy);
    for (const [id, model] of Object.entries(models)) {
      details.set(String(id), {
        name: model.name || '',
        type: model.type,
        fields: (model.flds || []).map(field => field.name),
        templates: (model.tmpls || []).map(template => template.name)
      });
    }
    return details;
  }

  function documentFor(html) {
    return new DOMParser().parseFromString(String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• '), 'text/html');
  }

  function normalizedMediaName(value) {
    let name = String(value || '').split(/[?#]/)[0].split(/[\\/]/).pop() || '';
    try { name = decodeURIComponent(name); } catch {}
    return name.normalize('NFC');
  }

  function imageNames(html) {
    const doc = documentFor(html);
    return [...doc.querySelectorAll('img[src]')]
      .map(image => normalizedMediaName(image.getAttribute('src')))
      .filter(Boolean);
  }

  function fieldText(html) {
    const doc = documentFor(html);
    for (const image of doc.querySelectorAll('img')) {
      image.replaceWith(doc.createTextNode(image.getAttribute('alt')?.trim() || ' [image] '));
    }
    return (doc.body.textContent || '')
      .replace(/\[sound:[^\]]+]/gi, ' [audio] ')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function mimeType(name) {
    const extension = normalizedMediaName(name).split('.').pop().toLowerCase();
    return IMAGE_TYPES[extension] || '';
  }

  function decompressZstd(bytes, label) {
    if (!window.fzstd?.decompress) throw new Error('The current Anki package reader did not load.');
    try { return window.fzstd.decompress(bytes); }
    catch { throw new Error(`${label} could not be decompressed. The Anki package may be damaged.`); }
  }

  function readVarint(bytes, cursor) {
    let value = 0;
    let factor = 1;
    for (let count = 0; count < 10 && cursor.offset < bytes.length; count++) {
      const byte = bytes[cursor.offset++];
      value += (byte & 127) * factor;
      if (!(byte & 128)) return value;
      factor *= 128;
    }
    throw new Error('The Anki media list is invalid.');
  }

  function readBytes(bytes, cursor) {
    const length = readVarint(bytes, cursor);
    const end = cursor.offset + length;
    if (end > bytes.length) throw new Error('The Anki media list is incomplete.');
    const value = bytes.subarray(cursor.offset, end);
    cursor.offset = end;
    return value;
  }

  function skipProtobufField(bytes, cursor, wire) {
    if (wire === 0) readVarint(bytes, cursor);
    else if (wire === 1) cursor.offset += 8;
    else if (wire === 2) readBytes(bytes, cursor);
    else if (wire === 5) cursor.offset += 4;
    else throw new Error('The Anki media list uses an unsupported field type.');
    if (cursor.offset > bytes.length) throw new Error('The Anki media list is incomplete.');
  }

  function parseMediaEntry(bytes) {
    const cursor = { offset: 0 };
    let name = '';
    let size = 0;
    while (cursor.offset < bytes.length) {
      const tag = readVarint(bytes, cursor);
      const field = Math.floor(tag / 8);
      const wire = tag & 7;
      if (field === 1 && wire === 2) name = new TextDecoder().decode(readBytes(bytes, cursor));
      else if (field === 2 && wire === 0) size = readVarint(bytes, cursor);
      else skipProtobufField(bytes, cursor, wire);
    }
    return { name: normalizedMediaName(name), size };
  }

  function parseMediaEntries(bytes) {
    const cursor = { offset: 0 };
    const entries = [];
    while (cursor.offset < bytes.length) {
      const tag = readVarint(bytes, cursor);
      const field = Math.floor(tag / 8);
      const wire = tag & 7;
      if (field === 1 && wire === 2) entries.push(parseMediaEntry(readBytes(bytes, cursor)));
      else skipProtobufField(bytes, cursor, wire);
    }
    return entries;
  }

  async function mediaLookup(zip, modern) {
    const file = zip.file('media');
    if (!file) return new Map();
    if (!modern) {
      let manifest;
      try { manifest = JSON.parse(await file.async('text')); }
      catch { throw new Error('The package media map is invalid.'); }
      return new Map(Object.entries(manifest).map(([key, name]) => [normalizedMediaName(name), { zipKey: key, compressed: false, size: 0 }]));
    }
    const decoded = decompressZstd(await file.async('uint8array'), 'The Anki media list');
    return new Map(parseMediaEntries(decoded).map((entry, index) => [entry.name, { zipKey: String(index), compressed: true, size: entry.size }]));
  }

  function runtime() {
    if (!window.initSqlJs) return Promise.reject(new Error('The offline Anki database reader did not load.'));
    if (!sqlPromise) {
      const encoded = window.KEYSTROKE_SQL_WASM_BASE64;
      if (!encoded) return Promise.reject(new Error('The offline Anki database reader is incomplete.'));
      const raw = atob(encoded);
      const wasmBinary = new Uint8Array(raw.length);
      for (let index = 0; index < raw.length; index++) wasmBinary[index] = raw.charCodeAt(index);
      window.KEYSTROKE_SQL_WASM_BASE64 = '';
      sqlPromise = window.initSqlJs({ wasmBinary });
    }
    return sqlPromise;
  }

  async function importApkg(file, onProgress = () => {}) {
    if (!window.JSZip) throw new Error('The offline Anki package reader did not load.');
    if (!AnkiCards) throw new Error('The Anki card converter did not load.');
    if (!file || file.size > MAX_PACKAGE_BYTES) throw new Error('That Anki package is larger than the 500 MB safety limit.');
    onProgress('Opening the Anki package…');
    const zip = await window.JSZip.loadAsync(file);
    const modern = Boolean(zip.file('collection.anki21b'));
    const collectionName = modern ? 'collection.anki21b' : ['collection.anki21', 'collection.anki2'].find(name => zip.file(name));
    if (!collectionName) throw new Error('This file does not contain a readable Anki collection.');

    const [SQL, archivedCollectionBytes] = await Promise.all([runtime(),zip.file(collectionName).async('uint8array')]);
    const collectionBytes = modern ? decompressZstd(archivedCollectionBytes, 'The Anki collection') : archivedCollectionBytes;
    onProgress('Reading cards and deck names…');
    const db = new SQL.Database(collectionBytes);
    let rows;
    let decks;
    let noteTypes;
    try {
      decks = deckNames(db);
      noteTypes = noteTypeDetails(db);
      rows = sqlRows(db, `
        SELECT c.id AS cid, n.id AS nid, n.mid AS mid, c.did AS did, c.ord AS ord, n.flds AS flds
        FROM notes n
        JOIN cards c ON c.nid = n.id
        ORDER BY c.id
      `);
    } finally {
      db.close();
    }

    const mediaByName = await mediaLookup(zip, modern);

    const cards = [];
    const referencedImages = new Set();
    const importStats = { sourceCards: rows.length, skippedCards: 0, clozeCards: 0, imageOcclusionCards: 0, manualCards: 0 };
    for (const row of rows) {
      const converted = AnkiCards.convertCard(row, noteTypes.get(String(row.mid)) || {});
      if (!converted) { importStats.skippedCards++; continue; }
      const termImageNames = AnkiCards.unique(converted.termMediaHtml.flatMap(imageNames));
      const definitionImageNames = AnkiCards.unique(converted.definitionMediaHtml.flatMap(imageNames));
      termImageNames.forEach(name => referencedImages.add(name));
      definitionImageNames.forEach(name => referencedImages.add(name));
      const term = fieldText(converted.termHtml);
      const definition = fieldText(converted.definitionHtml);
      if ((!term && !termImageNames.length) || (!definition && !definitionImageNames.length)) { importStats.skippedCards++; continue; }
      if (converted.kind === 'cloze') importStats.clozeCards++;
      if (converted.kind === 'image-occlusion') importStats.imageOcclusionCards++;
      if (converted.manual) importStats.manualCards++;
      cards.push({
        deck: decks.get(String(row.did)) || 'Unfiled',
        term,
        definition,
        answerExtra: fieldText(converted.answerExtraHtml),
        termMedia: termImageNames,
        definitionMedia: definitionImageNames,
        termOcclusions: converted.termOcclusions,
        manual: converted.manual,
        ankiKind: converted.kind,
        ankiCardId: String(row.cid),
        ankiNoteId: String(row.nid),
        ankiCardOrdinal: Number(row.ord)
      });
    }
    if (!cards.length) throw new Error('No usable two-field cards were found in this package.');

    const importId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const media = new Map();
    const keyByName = new Map();
    let missingImages = 0;
    let loadedImages = 0;
    for (const name of referencedImages) {
      const entry = mediaByName.get(name);
      const type = mimeType(name);
      const zipped = entry == null ? null : zip.file(entry.zipKey);
      if (!zipped || !type || entry.size > MAX_IMAGE_BYTES) { missingImages++; continue; }
      onProgress(`Preserving image ${loadedImages + 1} of ${referencedImages.size}…`);
      const archived = await zipped.async('uint8array');
      const imageBytes = entry.compressed ? decompressZstd(archived, `Image “${name}”`) : archived;
      if (imageBytes.byteLength > MAX_IMAGE_BYTES || (entry.size && imageBytes.byteLength !== entry.size)) { missingImages++; continue; }
      const blob = new Blob([imageBytes], { type });
      const key = `${importId}:${entry.zipKey}`;
      media.set(key, { key, blob, name, type });
      keyByName.set(name, key);
      loadedImages++;
    }
    for (const card of cards) {
      card.termMedia = card.termMedia.map(name => keyByName.get(name)).filter(Boolean);
      card.definitionMedia = card.definitionMedia.map(name => keyByName.get(name)).filter(Boolean);
    }

    const packageName = file.name.replace(/\.apkg$/i, '');
    onProgress('Saving the deck on this device…');
    await replaceLibrary(cards, media, packageName);
    return { cards, name: packageName, loadedImages, missingImages, ...importStats };
  }

  window.KeystrokeLibrary = { clearLibrary, deleteDeck, getMedia, importApkg, loadLibrary, replaceLibrary };
})();
