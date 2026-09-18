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

## 4. Submit through the developer dashboard

Obsidian moved submissions off GitHub in May 2026. `community-plugins.json` in
`obsidianmd/obsidian-releases` is now mirrored hourly from
`https://community.obsidian.md/assets/community-plugins.json` by a workflow in that repository, so a
pull request editing it is reverted within the hour and is no longer the way in.

The current path is the developer dashboard, and it needs two accounts only you can sign into, so
this is the one step in this document that cannot be scripted:

1. Open <https://community.obsidian.md> and sign in with your **Obsidian** account — the one your
   licence and forum login use, not GitHub.
2. Link your **GitHub** account to that profile. The directory uses the link to prove you own the
   repository you are about to submit, and it only sees *public* organisation membership, which does
   not matter here because the repository is on your personal account.
3. Add `carlesba/obsidian-task-overview` as a plugin. The dashboard reads `manifest.json` from the
   HEAD of the default branch, so the `id`, `name`, `version`, `description` and `author` it lists
   are whatever is committed on `main` — there is no separate entry to fill in by hand any more.

If the dashboard answers `Please wait before trying again`, it has rate-limited you and says nothing
about for how long; clicking again extends it. Leave it and come back later, then click once.

## 5. What happens after you submit

The automated review runs immediately and usually reports within a few minutes, checking the
developer policies, code quality and known vulnerabilities rather than waiting on a human. A plugin
that passes is searchable inside Obsidian within 24 hours. A plugin that fails shows the findings in
the dashboard, and you clear them by fixing the code and publishing a **new release with a higher
version** — editing the repository alone changes nothing, because the review scans releases.

From then on every release is scanned, not just this first one, and a release that fails review
delists the plugin from search within 24 hours until a passing release exists. That is the part of the
new system worth remembering: shipping a bad version is no longer just a bad version.

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
