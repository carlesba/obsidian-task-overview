# Task Overview

An Obsidian sidebar panel that lists the tasks of the note you have in focus, filtered by open, completed or all.

The panel follows the active note the way the Calendar plugin follows the active date, so switching notes swaps the list. Checkboxes in the panel write back to the note, and clicking a row opens the note with the cursor on that task's line.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # typecheck + production bundle
```

Copy or symlink `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/task-overview/`.
