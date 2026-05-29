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
