# Publishing Task Overview

This takes the plugin from a private repository to an entry in the Obsidian community plugin list.
Run every command from the repository root, on `main`, with a clean working tree.

## Two preconditions that are not yours

Both belong to the agent that handed you this document. If either check fails you have been handed
something unfinished, and nothing below should be run yet.

```sh
git log --oneline main..docs/publish-runbook
```

This prints nothing when `main` has already been fast-forwarded onto `docs/publish-runbook`; any line
it prints is a commit `main` is missing, and publishing would then ship a tree without it.

```sh
git ls-files docs/images
```

This must list `docs/images/panel.png`, `docs/images/headings.png` and `docs/images/settings.png`,
because `README.md` links all three and a reader on GitHub sees broken images until they are committed.

## 1. Check the id, then make the repository public

```sh
grep '"id"' manifest.json
```

This must print `task-overview`. The id is the primary key of your entry in `community-plugins.json`,
permanent once that entry is merged, and a different id later is a different plugin that existing
users never receive.

```sh
gh repo edit carlesba/obsidian-task-overview --visibility public \
  --accept-visibility-change-consequences
```

This is the irreversible step. Making the repository public exposes the whole history to anyone and to
forks and caches you do not control, and flipping it back does not withdraw what was read. The id is
frozen when a maintainer merges your entry, so this is the last point at which changing it is free.

## 2. Push `main`

```sh
git push origin main
```

`origin/main` is many commits behind, so this is the first push that carries the real history, and it
is what reviewers and users read. It costs nothing beyond the exposure step 1 committed you to.

## 3. Tag, build and release

```sh
git tag 1.0.0
git push origin 1.0.0
```

The tag must be exactly the `version` in `manifest.json` with no `v` prefix, because Obsidian resolves
a release by that string. Pushing a tag is effectively irreversible: once anyone has installed from it,
moving or deleting it breaks their update path, so a mistake is fixed by releasing `1.0.1`.

```sh
npm install && npm run build
```

This installs the build tools from `devDependencies`, typechecks, and produces `main.js`. Nothing else
in the flow creates that file.

```sh
gh release create 1.0.0 --title 1.0.0 \
  --notes "First public release." \
  main.js manifest.json styles.css
```

The three files must be attached as individual assets rather than an archive, because Obsidian
downloads them by name. `main.js` is gitignored, so it exists only as a build artifact and only as a
release asset, and a release missing it installs as a plugin that cannot load — the most common
reason a first submission is sent back.

## 4. Submit to the community list

```sh
cd ..
gh repo fork obsidianmd/obsidian-releases --clone --default-branch-only
cd obsidian-releases
```

This leaves the clone beside the plugin instead of inside it, where it would sit untracked in a tree
these steps need clean. The fork is a public repository on your account and you need it only once.

Append this entry to the end of the array in `community-plugins.json`, matching its tab indentation
and adding the comma the previously last entry now needs, or the bot below rejects the file as
invalid JSON. It is filled in from `manifest.json`, and its `name` and `description` are what the
community browser displays, so read those two once and then paste rather than retype:

```json
	{
		"id": "task-overview",
		"name": "Task Overview",
		"author": "Carles Ballester",
		"description": "Sidebar panel listing the tasks of the note in focus, filtered by open, done or all.",
		"repo": "carlesba/obsidian-task-overview"
	}
```

```sh
git checkout -b add-task-overview
git commit -am "Add Task Overview"
git push -u origin add-task-overview
gh pr create --web
```

The branch and the push touch only your fork, so they cost nothing and can be redone. `--web` opens
the pull request form in a browser because their template is a checklist you tick by hand, which
reviewers ask for before they look at anything else, and merging the result is what fixes the id
permanently.

## 5. What happens after the pull request is open

An automated validation bot comments on the pull request soon after it opens, checking the manifest
and the release assets; if it complains, fix the repository, cut a new release once the fix is in the
code, and reply on the same pull request rather than opening another. A human review follows and takes
weeks, so treat the wait as normal rather than as a sign something went wrong. Code and releases you
push while you wait need no second submission, because the entry points at the repository and Obsidian
reads each release from it. The five fields you pasted, though, live only in `community-plugins.json`,
so renaming the repository or changing the displayed name, author or description takes another pull
request there, and the id can never change at all.

## Releasing an update later

Bump `version` in both `manifest.json` and `package.json`, which hold the same version today, and
raise `minAppVersion` if the update needs a newer Obsidian. Add the matching line to `versions.json`,
which maps each plugin version to the minimum Obsidian version it runs on and is how older installs
know to stay on `1.0.0`. Then:

```sh
git commit -am "Release 1.0.1"
git push origin main
git tag 1.0.1
git push origin 1.0.1
npm install && npm run build
gh release create 1.0.1 --title 1.0.1 \
  --notes "Fix the filter counts after a toggle." main.js manifest.json styles.css
```

Obsidian picks the update up from the new release on its own, so there is no second pull request and
no change to `community-plugins.json`. This tag push is as final as the first one was: a mistake is
fixed by releasing `1.0.2`, never by moving `1.0.1`.
