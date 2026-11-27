#!/usr/bin/env bash
set -euo pipefail

vault="${1:-$HOME/Obsidian/plugin tester}"
scenario="$vault/task-overview-panels"
today="$(date +%Y-%m-%d)"
this_week="$(date +%G-W%V)"
this_month="$(date +%Y-%m)"
this_year="$(date +%Y)"
this_quarter="$this_year-Q$(( ($(date +%-m) + 2) / 3 ))"

if [[ ! -d "$vault/.obsidian" ]]; then
	echo "Not an Obsidian vault: $vault" >&2
	exit 1
fi

write_if_missing() {
	local path="$1"
	if [[ -e "$path" ]]; then
		echo "kept     ${path#"$vault"/}"
		return
	fi
	mkdir -p "$(dirname "$path")"
	cat >"$path"
	echo "created  ${path#"$vault"/}"
}

write_scenario_note() {
	local path="$1"
	mkdir -p "$(dirname "$path")"
	cat >"$path"
	echo "wrote    ${path#"$vault"/}"
}

write_scenario_note "$scenario/Project Alpha.md" <<'EOF'
# Project Alpha

## Design

- [ ] Alpha: sketch the settings page
- [x] Alpha: agree on panel names

## Build

- [ ] Alpha: migrate stored settings
	- [ ] Alpha: child task under migrate
- [-] Alpha: cancelled idea
- [i] Alpha: information line, hidden when [i] is listed as not a task
EOF

write_scenario_note "$scenario/Project Beta.md" <<'EOF'
# Project Beta

- [ ] Beta: open task without a heading
- [x] Beta: done task without a heading

## Follow-ups

- [ ] Beta: follow-up under a heading
EOF

write_scenario_note "$scenario/Inbox without tasks.md" <<'EOF'
# Inbox without tasks

Plain text and a bullet, no checkboxes.

- Just a bullet
EOF

write_scenario_note "$scenario/Renamed later.md" <<'EOF'
# Renamed later

- [ ] Rename: rename or move this note while it is a panel source
EOF

write_if_missing "$vault/on/$today.md" <<EOF
# $today

- [ ] Today: open task in today's note
- [x] Today: done task in today's note

## Meetings

- [ ] Today: task under a heading in today's note
EOF

write_if_missing "$vault/$this_week.md" <<EOF
# $this_week

- [ ] Week: open task in this week's note
EOF

write_scenario_note "$scenario/Panels test plan.md" <<EOF
# Panels test plan

Seeded on $today by \`scripts/seed-test-vault.sh\` in obsidian-task-overview. Rerun it on the test day so Today and This week point at existing notes. This note has no checkboxes on purpose, so it adds nothing to a panel that shows the focused note.

Before starting, copy \`.obsidian/plugins/task-overview/data.json\` aside. It still holds the 1.2.1 shape \`{"filter": "all", "showHeadings": true}\`, which case 1 migrates.

## 1. Migration

1. Build the new version and reload Obsidian with the old data.json in place.
2. Open Settings → Task Overview. Expect a Panels list with one row, Task overview, described as Focused note. Its pencil opens the panel's page: icon check-square, one source Focused note.
3. Expect the panel's filter to be All and its headings toggle on, carried over from the old file.
4. Expect the already-open sidebar leaf to keep working as that panel. The command is now named Task Overview: Open Task overview but keeps the id \`task-overview:open-panel\`, so a hotkey bound in 1.2.1 still opens it.

## 2. Focused note only, unchanged behaviour

1. Open [[Project Alpha]].
2. Expect the same list as 1.2.1: no note header, title Project Alpha, headings Design and Build when headings are on.

## 3. Several sources and note headers

1. In the Panels list press +. Expect a picker with three starting points, and nothing added until one is picked. Pick Empty panel; its page opens with the sources placeholder "No sources yet".
2. Name it Work, choose the icon briefcase from the fuzzy icon picker, and add the sources Focused note, Today, This week and, through Note…, [[Project Beta]]. Each + opens the picker again.
3. Run Task Overview: Open Work and focus [[Project Alpha]].
4. Expect four groups in source order, each under a header with the note name: Project Alpha, $today, $this_week, Project Beta. Clicking a header opens that note. The panel title reads Work.
5. Turn "Show a header for each note" off. Expect one flat list in the same order.
6. Turn headings on as well. Expect note headings, such as Follow-ups in Project Beta, inside each group.
7. Reorder the sources with the up and down arrows, and on desktop by dragging the grip. Expect the groups to follow. The grip, arrows and pencil sit left of the name and the X on the right.

## 4. Same note twice is shown once

1. In Work, open today's note on/$today so Focused note and Today resolve to the same file.
2. Expect today's tasks once, at the position of the first source that resolved to it, and the filter counts to count them once.
3. Add [[Project Beta]] a second time through Note…. Expect it once in the panel.

## 5. Periodic sources

1. Press + in a panel's source list. Expect Focused note, Today, This week, This month, This quarter, This year and Note…, minus the single-use ones the panel already has. Note… is always offered.
2. Pick Today. Expect the row to default to Follow Date Compass and its description to read "Follows the folder and format of Date Compass: on/$today.md".
3. Switch Today to Custom. Expect Folder \`on\` and Format \`YYYY-MM-DD\` prefilled from Date Compass, and the format description to show today's date, updating while you type.
4. Pick This week. Expect Follow Date Compass resolving to $this_week.md at the vault root. Change the week folder in Date Compass and expect the panel to follow without touching this source, which is what Follow is for.
5. Pick This month. It resolves to $this_month.md at the vault root, which does not exist. With note headers on and another note in the panel, expect a muted header "$this_month not created yet" and no create button. As the panel's only source, expect the title $this_month and the message "This note is not created yet."
6. Pick This quarter and This year. Expect $this_quarter.md and $this_year.md, handled like the month.
7. Disable Date Compass and reopen the panel's page. Expect Today to read Follow Daily notes (core plugin, \`on\` / \`YYYY-MM-DD\`). Expect This week to read "Follow a plugin" with a warning row beneath it, "No plugin provides weekly notes", naming Date Compass and Periodic Notes, and the panel to show a muted "This week" line. A Custom source keeps resolving. Enable Date Compass again.

## 6. Commands and icons

1. Expect a command Task Overview: Open Work in the palette, and the briefcase icon on the panel's tab.
2. Bind a hotkey to Open Work, then rename Work to Deep work. Expect the command name and the tab title to follow and the hotkey to keep working.
3. Run Open Deep work twice. Expect one tab, revealed the second time. The ribbon icon opens the first panel in the list.
4. Delete the panel while it is open. Expect its tab to close and its command to leave the palette. Deleting the last remaining panel is refused with a notice.

## 7. Live updates

1. With Work open, tick a task in Project Beta from the panel. Expect that file to change, not the focused one, and the list to refresh.
2. Edit [[Project Beta]] in the editor. Expect the panel to refresh without refocusing.
3. Rename or move [[Renamed later]] while it is a source. Expect the source row in the settings to show the new path and the panel to keep listing its task.
4. Create the missing month note with a task in it. Expect the panel to pick it up without reopening.
5. Delete a note that is a Note… source. Expect a muted header "<name> missing" in the panel and "is missing from the vault" on its settings row.
6. Leave Obsidian open past midnight. Expect Today to move to the new day's note within a few seconds.

## 8. Edge sources

1. Add [[Inbox without tasks]]. Expect no group and no header for it. When no source has a matching task, expect a single message such as "No open tasks in this panel."
2. Focus a canvas or the settings, then come back. Expect Focused note to keep the last markdown note, as 1.2.1 does.
3. With nothing in focus after a restart, expect the focused panel to be titled Task overview and say "Open a note to see its tasks."

## 9. Phone

1. Repeat cases 3 and 5 on mobile. Every add, remove and reorder must work by tapping: + opens the picker, the arrows reorder, X removes. The drag grip is desktop only.
EOF

echo
echo "today      -> on/$today.md  (core Daily notes and Date Compass day: on/YYYY-MM-DD)"
echo "this week  -> $this_week.md  (Date Compass week: vault root, GGGG-[W]WW)"
echo "this month -> $this_month.md (Date Compass month: vault root, YYYY-MM; intentionally not created)"
echo "this quarter -> $this_quarter.md, this year -> $this_year.md (Date Compass: vault root; created only if you make them)"
