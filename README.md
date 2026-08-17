# Keystroke

A keyboard-first study app created by **gemz**.

## Open Keystroke

Use the same link on **Windows, Mac, or Chromebook**:

**https://rubyinsight.github.io/KeyStrokePublic/**

No installation is needed. Open the link in Chrome, Edge, Safari, or Firefox.

## Preview

[![Keystroke import and setup screen](previews/setup.svg)](https://rubyinsight.github.io/KeyStrokePublic/)

*Import an Anki deck, choose a practice direction, and start studying.*

[![Keystroke learning screen in the Cyberspace theme](previews/learn.svg)](https://rubyinsight.github.io/KeyStrokePublic/)

*Type what you remember, check your answer, and rate it Again, Hard, Good, or Easy.*

## Start studying

1. Open the link.
2. Drag in an Anki `.apkg` file, or choose **choose a file**.
3. Select a deck and study.

Keystroke can also import `.txt`, `.tsv`, and `.csv` files. Anki packages can keep their deck separation and included images.

## Drag and drop

Drag one `.apkg`, `.txt`, `.tsv`, or `.csv` file anywhere onto the Keystroke page. The same import also works with **choose a file**, which is usually easier on phones and tablets.

Import one file at a time and wait for the success message before starting a session or importing another file.

## Make simple cards now

You do not need Anki for basic cards. Paste one card per line into the large **Import cards** box. Separate the term and definition with a semicolon:

```text
mitosis;Cell division producing two genetically identical cells
osmosis;Movement of water across a membrane
```

Keystroke shows the number of detected cards automatically. Choose a practice direction and press **start session**.

Tabs and CSV are also supported. For a larger set, place terms in the first spreadsheet column and definitions in the second, then copy and paste the cells into Keystroke. A dedicated one-card-at-a-time creator is planned for a future update.

## How images work

Use an Anki `.apkg` file when cards contain images:

1. In Anki, choose **File → Export**.
2. Select **Anki Deck Package (`.apkg`)**.
3. Turn on **Include media**.
4. Drag the exported file onto Keystroke or use **choose a file**.

Keystroke preserves images referenced by the first two card fields. PNG, JPEG, GIF, WebP, AVIF, and BMP images up to 50 MB each are supported. Unsupported, missing, or oversized images are skipped and reported after import.

Every generated Anki card is imported. Each cloze deletion becomes its own typing prompt, while image-occlusion cards show a masked image followed by an unmasked reveal in self-rated Learn mode.

Images are copied into private browser storage on that device. They are never uploaded to GitHub or a Keystroke server. Plain-text, TSV, and CSV imports cannot preserve image files, so use `.apkg` for image cards.

Keep the original `.apkg` file. Clearing browser data can remove stored cards and images, and a Keystroke progress backup contains schedules and statistics—not card text or media.

## Privacy

Cards, images, schedules, and progress stay in that person's browser. They are not uploaded to this repository or sent to a server.

Each student should keep the original Anki file and occasionally use **Export backup** for their progress. Clearing browser data can remove the browser's saved copy.

## Mac application

The website works on Mac without installing anything. Students who receive the separate Mac app can unzip it, drag **Keystroke.app** into **Applications**, and open it. If macOS blocks the first launch, right-click the app and choose **Open**.

## Sharing

Share the website link above with classmates. This repository contains only the Keystroke app—not anyone's decks or study history. Search engines are asked not to index the site, but anyone who receives the link can open it.
