# Task Overview

An Obsidian sidebar panel that lists the tasks of the note you have in focus, filtered by open, completed or all.

The panel follows the active note the way the Calendar plugin follows the active date, so switching notes swaps the list. Checkboxes in the panel write back to the note, and clicking a row opens the note with the cursor on that task's line.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # typecheck + production bundle
npm test        # unit tests
```

Install into a test vault by symlinking the repository itself, so the build output the
plugin loads is always the one `npm run dev` just wrote:

```bash
ln -s "$PWD" "<vault>/.obsidian/plugins/task-overview"
```

Copying `main.js`, `manifest.json` and `styles.css` instead works once and then silently
freezes: the vault keeps serving that copy, and the [Hot
Reload](https://github.com/pjeby/hot-reload) plugin only watches plugin folders that are a
symlink or contain `.git` or `.hotreload`, so a copied folder never reloads either. With
the symlink in place, every `npm run dev` rebuild reloads the plugin in Obsidian.
