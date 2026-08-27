# Changelog

All notable changes to Keystroke are recorded here.

## [Unreleased]

## [1.4.0] - 2026-08-27

### Added

- Safe **Update matching decks** imports that merge cards by stable Anki card ID while retaining unrelated decks
- A separate **Replace entire library** option for intentional full-collection resets
- Import summaries showing added, updated, unchanged, removed, and conflicted card counts
- Optional daily new-card and review limits for Learn mode; `0` remains unlimited

### Changed

- Reimporting an updated class deck now preserves valid review schedules, replaces edited card content and images, adds new cards, and removes cards no longer present in that deck
- Same-day Again and Hard repetitions remain available even after a daily limit is reached
- Orphaned schedules and unreferenced imported media are removed after a deck update

### Tests

- Added safe-update regressions for unrelated decks, repeated imports, moved and removed cards, conflicting IDs, content hashes, and retained media
- Added daily-limit regressions for unique daily counts, new and review caps, due dates, same-day repetitions, and unlimited sessions
- Verified exact conversion parity for 22 real Anki packages containing 17,258 generated cards, with zero skipped or duplicated card IDs within any package

## [1.3.3] - 2026-08-17

### Added

- Direct imports of Anki Collection Package (`.colpkg`) files, commonly used when exporting an entire collection on Windows or macOS
- Per-deck card totals in the import confirmation for collections containing up to five decks
- Clear progress after reading the Anki database, including the exact generated-card and used-deck counts

### Fixed

- Collection exports no longer appear to leave Keystroke at zero decks simply because their filename ends in `.colpkg`
- Invalid ZIP folders and genuinely empty Anki packages now produce specific recovery instructions

## [1.3.2] - 2026-08-17

### Added

- Anki-style hide/show mask controls for image-occlusion reviews
- Expanded image viewer with 50–300% zoom and mask controls
- Rectangle, ellipse, polygon, rotated-mask, and text-annotation rendering for native Anki image occlusions

### Fixed

- Keep inactive masks hidden on Hide All, Guess One cards after revealing the target
- Preserve empty or unusual generated cards with a manual fallback instead of silently dropping them
- Stop an import safely if its card count ever differs from the package database count

### Tests

- Added image-occlusion regressions for Hide All, Hide One, ellipses, polygons, annotations, and empty cards
- Rechecked package card-count parity and card media in the browser and Mac build

## [1.3.1] - 2026-08-17

### Fixed

- Import every generated Anki card instead of collapsing multiple cards from one note
- Convert each cloze deletion into its own typing prompt and answer
- Preserve image-occlusion cards with a masked prompt, an unmasked reveal, and self-rated Learn controls
- Give imported Anki cards stable per-card schedule identities while retaining earlier review history as a fallback
- Report imported-versus-source card totals and skipped-card reasons after package import

### Tests

- Added conversion regression tests for basic, cloze, single-field, and image-occlusion cards
- Verified zero skipped cards across three real packages containing 3,986 Anki cards

## [1.3.0] - 2026-08-17

### Added

- Finder drag-and-drop imports for `.apkg`, `.txt`, `.tsv`, and `.csv` files
- Clear drop-target feedback and unsupported/multiple-file messages

### Fixed

- Kept file-picker and dropped-file imports on one tested import path
- Synchronized the native Mac bundle version with the visible app version

## [1.2.0] - 2026-08-17

### Added

- Safe per-deck and delete-all controls with confirmation
- Automatic cleanup of deleted cards, schedules, and unneeded local images

### Fixed

- Kept remaining decks studyable and persistent after deleting one deck

## [1.1.0] - 2026-08-17

### Added

- Double-click Mac launcher for opening Keystroke without entering Terminal commands
- Lightweight native Mac application with a custom icon and dedicated local progress file
- Direct local imports of current compressed and legacy `.apkg` files with preserved raster card images
- Deck selector for studying one imported deck or all decks together
- IndexedDB persistence for imported Anki cards and media

### Changed

- Replaced the app icon with a simpler charcoal-and-yellow typing mark
- Updated Learn intervals to Again 1 minute, Hard 6 minutes, Good 1 day, and Easy 7 days
- Made later intervals adaptive to card ease, rating history, and overdue time

### Fixed

- Restored keyboard-only Enter progression and Learn-mode number shortcuts after the answer field becomes disabled

## [1.0.0] - 2026-08-16

### Added

- Anki text, TSV, CSV, semicolon, and pasted card imports
- Term-to-definition, definition-to-term, mixed, and Anki Learn modes
- Accuracy, WPM, streak, progress, missed-card review, shuffle, and restart
- Persistent Again, Hard, Good, and Easy scheduling
- One-year activity calendar and streak statistics
- Local JSON schedule and activity backups
- Dark, Light, Cyberspace, Serika, Dracula, Nord, Gruvbox, and Miami themes
- Responsive keyboard-first interface and complete offline operation
- Project checks and automatic GitHub Pages deployment

### Credits

- Created by gemz
