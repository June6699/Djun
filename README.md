# DJun Travel Journal

A local Next.js travel photo journal with a cinematic chapter player and a single-admin CMS.

## Run

```powershell
npm install
npm run dev
```

Open:

- Frontend: http://localhost:3000
- CMS: http://localhost:3000/admin

Default local CMS account:

- Username: `admin`
- Password: `admin123`

Set `DJUN_ADMIN_USERNAME` and `DJUN_ADMIN_PASSWORD` before the first run if you want different initial credentials.

## Photos

The CMS reads local images from:

```text
public/uploads/originals
```

You can either upload images in `/admin` or copy images into that folder and press `Scan`. Thumbnails are generated into:

```text
public/uploads/thumbs
```

The first run seeds curated Bing Wallpaper demo images from `public/demo-assets` when no local photos exist. Photo titles, captions, locations, and dates are initialized automatically and can be edited in `/admin`.

## Data

SQLite data is stored in:

```text
data/travel-cms.sqlite
```

The session signing secret is stored in:

```text
data/session-secret.txt
```

Both are ignored by git.

## Cloudflare

This app is configured for Cloudflare's OpenNext adapter. In Cloudflare Pages, use:

```text
Build command: npm run cloudflare:build
Deploy command: npm run cloudflare:deploy
Output directory: .open-next
```

Do not use `npx wrangler deploy` directly as the Pages deploy command. It can trigger Wrangler's interactive Next.js migration during the build and recreate transient config instead of using the committed `wrangler.jsonc` and `open-next.config.ts` files.

For local Cloudflare preview, run:

```powershell
npm run cloudflare:build
npx wrangler dev --port 51888
```

Note: the current CMS uses local SQLite, filesystem uploads, and `sharp` thumbnail generation. Those Node-local storage features are not persistent in Cloudflare Workers. A production Cloudflare deployment should migrate data to D1 and uploaded images to R2, or the app should be hosted on a Node server with persistent disk.