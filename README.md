# Client Gallery — free personalized photo delivery pages on GitHub Pages

A template for a **private-looking client gallery** per photography client, hosted
free on GitHub Pages with CI/CD via GitHub Actions:

- **Clients see** a dark, elegant gallery: their name, collections of photos,
  a lightbox, favorites ("email my picks"), and **download buttons for the
  full-resolution originals**.
- **You store** web-sized previews in the repo; **full-res originals live in a
  GitHub Release** (free, 2 GB per file) — the repo stays small.
- **CI/CD**: push to `main` → GitHub Actions resolves the release download
  links, builds the site, and publishes it to Pages. No branch juggling,
  no Jekyll, zero npm dependencies in CI.
- **Access**: each client gets an unguessable URL plus an **access code**
  (checked locally, remembered per browser). Pages are excluded from search
  engines.

One repo per client: `username.github.io/gallery-chen-wedding/`.

```
┌─────────────┐  push   ┌──────────────────────────────────────────┐
│ your laptop │ ──────► │ GitHub repo (public, template-derived)   │
│             │         │  src/config.json   gallery settings      │
│ previews    │         │  src/photos/…      web-sized previews    │
│ originals   │  gh     │  .github/workflows/deploy.yml            │
└─────────────┘ ──────► ├──────────────────────────────────────────┤
                        │ GitHub Release  ← full-res originals     │
                        └───────────────┬──────────────────────────┘
                                        │ Actions: resolve release
                                        │ links → build dist/ → deploy
                                        ▼
                        https://<you>.github.io/gallery-<client>/
```

---

## How clients download photos

| Button | What it is |
|---|---|
| **⤓ Download full-res** (in lightbox) | Direct link to that photo's original file, hosted as a GitHub **Release asset** (up to 2 GB/file, free). Links are matched by filename: preview `sample_0123.jpg` ⇄ release asset `sample_0123.CR3/JPG` (extension-insensitive, case-insensitive). |
| **⤓ Download all full-res** (per collection) | One ZIP release asset, if that's how you prefer to deliver. |
| ♥ Save + **Email my picks** | Client favorite-picking; opens an email to you listing filenames. |

If no release is linked yet, the gallery still works — download buttons simply
stay hidden.

---

## Prerequisites

- [git](https://git-scm.com/) and the [GitHub CLI](https://cli.github.com/)
  (`brew install gh git`), then `gh auth login`
- Node.js ≥ 20 for local helper scripts (`brew install node`) — **not** needed
  for CI, which has its own

## One-time setup (once ever)

1. Create a GitHub repo from this folder and push it:
   ```sh
   git init -b main && git add -A && git commit -m "client gallery template"
   gh repo create client-gallery-template --public --source . --push
   ```
2. Mark it as a template: repo page → **Settings → General → ☑ Template repository**.

## New client (the whole ritual, ~10 minutes)

```sh
# 1. Scaffold the client's repo from the template (public is required for free Pages)
./scripts/new-client.sh chen-wedding        # or: gh repo create gallery-chen-wedding \
                                            #   --template you/client-gallery-template --public --clone
cd gallery-chen-wedding

# 2. Name the client and pick an access code (only the SHA-256 hash is committed)
$EDITOR src/config.json
npm run code -- "stormy-cliff-91"

# 3. Make web previews from your Lightroom/Camera Raw exports (first time: npm i -D sharp)
npm run previews -- ~/Pictures/chen/fullres ceremony

#    …add the collection to src/config.json (dir: "ceremony"), delete the demo ones

# 4. Ship it → Actions builds and deploys to Pages automatically
git rm -r --quiet src/photos/portraits src/photos/landscapes   # remove demo photos
git add -A && git commit -m "chen wedding gallery" && git push

# 5. Deliver originals (per-photo download buttons light up on the next build)
npm run deliver -- ~/Pictures/chen/fullres --tag delivery --title "Chen wedding originals"
```

The gallery URL is **Settings → Pages** (or the Actions deploy log). Steps 4–5
can happen in either order; a nightly rebuild also picks up newly uploaded
release assets, as does any push or a manual **Run workflow**.

## Day-to-day

| Task | Do |
|---|---|
| Add another collection | `npm run previews -- <dir> <name>`, add to `collections` in `src/config.json`, push |
| Add originals later | `npm run deliver -- <dir> --tag delivery` (updates the release in place), then re-run the workflow |
| Revoke/rotate access | `npm run code -- "new-code"`, commit, push — clients must re-enter |
| Lock the page permanently | `"gate": { "enabled": false }`? No — set `codeHash` to a random value; or delete the repo |
| Retire a client | Archive the repo (Pages stops serving) |

## Local development

```sh
npm run build    # render dist/
npm run dev      # build + serve at http://localhost:8080
```

## CI/CD details (`deploy.yml`)

1. **Enable Pages (first run)** — tries `POST /repos/…/pages` with
   `build_type=workflow`; if the token can't, run once yourself:
   `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`
2. **`build/releases.mjs`** — for each collection's `release` (a tag or
   `"latest"`), lists release assets via the GitHub API →
   `build/release-assets.json` (filename → download URL). Non-fatal on failure.
3. **`build/build.mjs`** — renders `dist/`: copies previews + `site/` shell,
   writes `gallery.json` + `gate.json`, attaches download URLs.
4. **`actions/upload-pages-artifact` + `actions/deploy-pages`** — publishes
   `dist/`. No `gh-pages` branch, rollback is built into the Pages deployment UI.

## `src/config.json` reference

```jsonc
{
  "studio":  { "name": "Studio Nord", "email": "you@studio.com", "url": "https://…" },
  "client":  { "name": "Emma & Liam", "event": "Wedding", "date": "2026-09-12", "location": "Big Sur" },
  "gate":    { "enabled": true, "codeHash": "<sha256 via npm run code>", "hint": "On the card I emailed you." },
  "collections": [
    {
      "id": "ceremony",          // unique key
      "title": "Ceremony",       // shown to client
      "description": "…",        // optional
      "date": "2026-09-12",      // optional
      "dir": "ceremony",         // folder name in src/photos/
      "release": "delivery",     // release tag | "latest" | null → per-photo download links
      "zipAsset": "ceremony.zip" // optional: name of a ZIP asset for Download-all; null = auto if exactly one zip
    }
  ]
}
```

## Customizing

Everything visual lives in `site/styles.css` — change the CSS variables at the
top (`--accent`, `--bg`, fonts) to match your brand.

## Limits & reality check (free tiers)

- **Pages**: 1 GB site size, 100 GB/month transfer (soft limits; GitHub emails
  you first). Keep previews ~1600–1800 px (`npm run previews`) — a 500-photo
  gallery lands around 50–80 MB.
- **Release assets**: 2 GB per file, unlimited release storage in practice —
  but this is *free hosting you didn't pay for*: keep originals backed up
  elsewhere (you should anyway).
- **The repo is public** (free Pages can't serve private repos). The access
  code is a **deterrent, not encryption**: it hides the gallery from casual
  visitors and search engines, but photos are fetchable by URL and release
  asset URLs are discoverable by anyone who knows the repo name. For
  contractually private deliveries, use a paid service (Pixieset, ShootProof)
  or Pro's private-Pages. Codes should be ≥ 12 random chars — hash-only is
  stored, but weak codes are brute-forceable since the hash is public.
- **No real auth**: there is no login. Unlocked browsers remember via
  `localStorage`; the footer's “Not you? Lock this page” forgets it.

## Repo map

```
.github/workflows/deploy.yml   CI/CD: build + Pages deploy
site/                          HTML/CSS/JS shell copied verbatim into dist/
build/build.mjs                renders dist/ (no dependencies)
build/releases.mjs             release assets → download links (CI)
build/hash-code.mjs            npm run code — set the access code
scripts/previews.mjs           npm run previews — web-sized previews (needs `npm i -D sharp`)
scripts/deliver.mjs            npm run deliver — originals → GitHub Release (needs gh)
scripts/new-client.sh          scaffold a client repo from this template
scripts/serve.mjs              local preview server
src/config.json                the one file you edit per client
src/photos/<dir>/              committed web previews, one folder per collection
```

MIT licensed. Demo content (`src/photos/portraits`, `landscapes`, code
`demo1234`) is there so the first build/deploy looks alive — delete it per client.
