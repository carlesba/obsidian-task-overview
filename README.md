# Task Overview

An Obsidian sidebar panel that lists the tasks of the note you have in focus, filtered by open, completed or all.

The panel follows the active note the way the Calendar plugin follows the active date, so switching notes swaps the list. Checkboxes in the panel write back to the note, and clicking a row opens the note with the cursor on that task's line.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # typecheck + production bundle
```

## Installing into a vault

After a build, copy the plugin into a vault with:

```bash
node scripts/install-to-vault.mjs --vault "/path/to/vault"
```

The script copies `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/task-overview/`, creating that directory the first time. Set `OBSIDIAN_VAULT` to the vault path to leave `--vault` off, and add `--dry-run` to print what would be copied without writing anything. It refuses a path that holds no `.obsidian` directory, so pass the vault root rather than the plugins folder.

Enable the plugin from Obsidian's community plugins settings. Each rebuild needs the script run again before Obsidian sees the new bundle, so re-run it and then reload the plugin from the same settings pane.
