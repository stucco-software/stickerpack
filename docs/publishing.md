# Publishing the extension

Publisher: **Stucco Software**. First target: **Chrome Web Store**. Firefox is
**self-hosted**: Mozilla signs the build, we host it here.

Nothing in this file submits anything. It's the checklist and the copy to paste in.

## Before every submission

```sh
npm ci
npm test
npm run package:extension
```

That writes, into `dist-extension/`:

| File | For |
|---|---|
| `stickerpack-chrome-<version>.zip` | Chrome Web Store (and Edge later) |
| `stickerpack-firefox-<version>.zip` | Mozilla, for signing |
| `stickerpack-source-<version>.zip` | Mozilla's source-code requirement |

**Bump the version first.** Every submission needs a higher number than the last, in
both `package.json` and `src/extension/manifest.js`. All three stores accept a plain
`1.0.0`.

## Chrome Web Store

### Account
- Google account with **2-step verification on**; you cannot publish without it.
- One-time registration fee (long the equivalent of $5; the current amount shows at
  registration).
- The account email can't be changed later, so use one Stucco Software will keep.
- Verify a contact email before publishing.
- **EU trader declaration.** This follows where you distribute, not where you're
  incorporated. Declaring as a trader means publishing a legal name, address and an
  SMS-verifiable phone number on the listing. If that's unwelcome, exclude the EU in the
  listing's distribution settings instead.
- New publishers may have two published extensions until they ask for more.

### Listing copy

**Name:** Stickerpack

**Summary** (132 characters max):

> Put stickers on any website. They stay where you put them, they're saved on your machine, and the site never knows.

**Description:**

> Stickerpack lets you stick stickers onto any web page. Pick one, click where you want
> it, and it stays there. Come back to the page tomorrow, next week or next year and your
> stickers are exactly where you left them.
>
> It asks for no access to any website when you install it. On a site you'd like to
> sticker, click the toolbar button and say yes: the browser then asks about that one
> site, and nothing runs anywhere else. Change your mind and you can turn a site back off
> from the options page.
>
> Your stickers are yours. They're saved in the extension's own storage on your machine.
> There's no account, no server, and no network request: even the sticker pictures are
> bundled inside the extension, so it works offline. Sites can't see your stickers, and
> neither can we.
>
> - Stick a sticker anywhere on a page, and peel it off just as easily.
> - Stickers stay attached to the content, so they survive a site's layout changing.
> - Works on single-page apps, where the page changes without reloading.
> - Open the tray from the toolbar button or with a keyboard shortcut.
> - Five stickers to start: eyes, a star, a pointing hand, a no-entry sign and fire.

**Category:** Fun (alternatively Productivity/Tools)

**Single purpose** (their wording: one clear purpose, narrowly defined):

> Let a person place sticker images onto web pages they choose, and show those stickers
> again when they return to the page.

### Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Saves the stickers you place, and which page each one belongs to, in the extension's own storage on your machine. Nothing is transmitted. |
| `scripting` | Registers and injects the content script that draws your stickers, only on the sites you have explicitly granted. |
| `activeTab` | When you click the toolbar button, reads the current tab's address so the extension can ask whether to sticker this site, and can tell whether you already granted it. |
| `optional_host_permissions: *://*/*` | Stickers can be placed on any site the user chooses, and no list of sites can be known in advance. Access is **not** requested at install: the pattern is optional, and the user grants one origin at a time by clicking "Stick stickers on this site". On every other site no code runs at all. |

Expect a longer review because of the broad host pattern, even though it's optional. Say
plainly in the justification that it is optional and granted per site.

### Privacy tab

- **Privacy policy URL:** `https://stickerpack.stucco.software/privacy`
- **Remote code:** No. Everything is in the package; nothing is fetched or evaluated.
- **Data collected:** tick **Website content** (which page a sticker belongs to, stored
  as its address). Nothing else: no personally identifiable information, no health,
  financial, authentication, personal communications, location, or activity data.
- Certify all three limited-use statements: the data isn't sold, isn't used for anything
  beyond the single purpose, and isn't used for creditworthiness or lending. All true:
  the data never leaves the machine.

### Images

In `docs/store/`, regenerate by rerunning the steps in "Regenerating the images" below.

| File | Where it goes |
|---|---|
| `screenshot-1280x800-stuck.png` | Screenshot 1 (required) |
| `screenshot-1280x800-tray.png` | Screenshot 2 |
| `promo-440x280.png` | Small promo tile (required) |
| `logo-300x300.png` | Edge logo, when you get to Edge |

The 128px store icon comes from the package itself (`icons/icon-128.png`).

## Firefox, self-hosted

Mozilla must sign the build even when you host it yourself. Unsigned extensions don't
install in release Firefox.

1. Get API credentials at `addons.mozilla.org` → Tools → Manage API Keys.
2. Sign the build, choosing **unlisted** so it isn't published on AMO:

```sh
npx web-ext sign \
  --source-dir dist-extension/firefox \
  --artifacts-dir dist-extension \
  --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET"
```

3. Upload the source zip when asked. Mozilla requires it because our files come from a
   bundler: they rebuild and diff against what we submitted, and it has to match. The
   source zip is `git archive` of the tracked tree, and `README.md` carries the build
   instructions (`npm ci && npm run build:extension`). Their environment runs Node 24.
4. Put the signed `.xpi` in `static/` as `stickerpack-<version>.xpi`, and deploy.
   `https://stickerpack.stucco.software/updates.json` already advertises exactly that
   filename for the current version, so existing installs update themselves.
5. Add the download link to the Firefox section of `/extension`.

`web-ext` is not a dependency of this project; `npx` fetches it for the one command.

## Edge, later

The Chrome zip works as-is: we have no `update_url` in the Chromium manifest and say
"Chrome" nowhere. Partner Center account, no fee, certification takes up to seven
business days. A company account there needs verification, which can take days and
involves a phone call. Edge wants a description of at least 250 characters (the one above
is longer) and a 300×300 logo.

## Regenerating the images

The screenshots are a fake news page with stickers already placed, and the tile is an
HTML file; both were rendered with headless Chrome at exact store dimensions. There's no
committed script for them: they're one-offs, and remaking them means writing a small
local page, serving it, and screenshotting with
`--window-size=1280,800 --virtual-time-budget=6000 --screenshot=…`. Keep the dimensions
exact, because both stores reject anything else.

## After submitting

- Chrome review: usually days, sometimes weeks. Chase after three weeks.
- Keep `docs/extension.md` and the `/extension` page honest about where the extension can
  be installed from; both currently say "build it yourself", which stops being true the
  day the listing goes live.
