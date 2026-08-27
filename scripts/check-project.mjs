import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'index.html', 'styles.css', 'features.css', 'app.js', 'anki-card.js',
  'deck-update.js', 'study-limits.js', 'library.js', 'drop-import.js',
  'vendor/jszip.min.js', 'vendor/fzstd.min.js', 'vendor/sql-wasm.js',
  'vendor/sql-wasm-binary.js', 'scripts/test-anki-card.cjs',
  'scripts/test-drop-import.cjs', 'scripts/test-deck-update.cjs',
  'scripts/test-study-limits.cjs', 'README.md', 'CHANGELOG.md'
];
const missing = requiredFiles.filter(file => !existsSync(file));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`);

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate HTML IDs: ${[...new Set(duplicateIds)].join(', ')}`);

const externalAssets = [...html.matchAll(/(?:src|href)="(https?:\/\/[^\"]+)"/g)].map(match => match[1]);
if (externalAssets.length) throw new Error(`External page assets break offline mode: ${externalAssets.join(', ')}`);
if (!html.includes('created by gemz')) throw new Error('Creator credit is missing from index.html');

const app = readFileSync('app.js', 'utf8');
const library = readFileSync('library.js', 'utf8');
if (!app.includes('importApkg') || !library.includes('collection.anki21b') || !html.includes('anki-card.js')) throw new Error('The local Anki package importer is missing.');
if (!library.includes('SELECT c.id AS cid') || library.includes('GROUP BY n.id, c.did')) throw new Error('The Anki importer must preserve every generated Anki card.');
if (!html.includes('id="deleteDeckBtn"') || !app.includes('deleteSelectedDeck') || !library.includes('async function deleteDeck')) throw new Error('The safe deck deletion controls are missing.');
if (!html.includes('id="importCard"') || !app.includes("document.addEventListener('drop',handleFileDrop)") || !html.includes('drop-import.js')) throw new Error('Drag-and-drop importing is missing.');
if (!html.includes('v1.4.0')) throw new Error('The public web version is out of sync.');
if (!html.includes('id="importStrategyFieldset"') || !library.includes('storeImportedLibrary') || !html.includes('deck-update.js')) throw new Error('Safe deck updating is missing.');
if (!html.includes('id="dailyLimitsFieldset"') || !app.includes('learnSelection') || !html.includes('study-limits.js')) throw new Error('Daily Learn limits are missing.');
if (!app.includes('Replace the entire Keystroke library?') || !app.includes("state.mode==='learn'&&!reviewingMissed")) throw new Error('The replacement confirmation or Learn-limit session guard is missing.');
if (!html.includes('id="mediaDialog"') || !app.includes('media-mask-toggle') || !app.includes('definitionOcclusions')) throw new Error('Image mask toggling or expanded image viewing is missing.');

console.log(`Keystroke public checks passed: ${ids.length} unique IDs, offline assets only, required files present.`);
