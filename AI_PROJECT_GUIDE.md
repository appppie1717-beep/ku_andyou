# ku_andyou Project Guide

This file is an AI-facing map for the project at:

```text
C:\Users\USER\Desktop\앤유
```

Do not paste secrets into this file. Local secrets and private notes are consolidated in `정보.md`, which is intentionally ignored by Git and Vercel.

## Purpose

This is a small static fan site for the CHZZK streamer `ku앤유`.

Main capabilities:

- Public landing page with profile, schedule, social links, and clip cards.
- CHZZK live-status badge for the `방송 바로가기` button.
- Hidden admin editor for site text, schedule, profile rows, social URLs, and clips.
- Supabase-backed content storage.
- Discord Webhook live-start alert endpoint, intended to be called by an external scheduler.

## Deployment Shape

The production site is deployed on Vercel:

```text
https://ku-andyou.vercel.app
```

Vercel serves the static files and the JavaScript files under `api/` as serverless functions.

Important constraint:

- Vercel Hobby does not support a 3-minute Vercel Cron schedule.
- The Discord live alert endpoint exists on Vercel, but a separate external scheduler such as cron-job.org must call it every 3 minutes.

## Repository Layout

```text
.
├─ index.html
├─ styles.css
├─ app.js
├─ clips.json
├─ supabase-schema.sql
├─ supabase-schema.sql.md
├─ vercel-env.md
├─ AI_PROJECT_GUIDE.md
├─ .gitignore
├─ .vercelignore
├─ api/
│  ├─ admin-auth.js
│  ├─ admin-content.js
│  ├─ admin-security.js
│  ├─ live-status.js
│  ├─ check-live-alert.js
│  └─ discord-live-alert.js
├─ clips/
│  └─ andyou-clip-01.mp4
├─ images/
│  ├─ andyou-bg.png
│  └─ andyou-full.png
├─ 정보.md
├─ 사진/
└─ 클립/
```

## Public Frontend

### `index.html`

Defines the complete page structure.

Important sections:

- Hero with streamer name, live broadcast link, social links, and character image.
- Profile area.
- Schedule area.
- Clips grid.
- Clip player modal.
- Hidden admin modal opened by the `관리자 설정` floating button.

Important script include:

```html
<script src="./app.js?v=20260612-2"></script>
```

The query string is a cache-busting version. If browser or Vercel static caching causes stale JavaScript, bump this value.

### `styles.css`

Contains all visual styling for:

- Public page layout.
- Hero and image presentation.
- Profile accordion.
- Schedule cards.
- Clip grid and modal player.
- Admin modal/editor UI.

### `app.js`

Browser-side logic.

Responsibilities:

- Loads `site_settings` from Supabase REST.
- Loads visible clips from Supabase REST.
- Falls back to `clips.json` if Supabase clip loading fails.
- Renders hero text, schedule, profile, social links, footer, and clips.
- Calls `./api/live-status` for the live badge.
- Handles clip modal playback.
- Handles admin login through `./api/admin-auth`.
- Handles admin content save through `./api/admin-content`.

Public Supabase values are in this file:

```js
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The publishable key can be public if RLS policies remain correct. Never add service-role or secret keys to this file.

## API Functions

All files in `api/` are Vercel serverless functions.

### `api/live-status.js`

Public live-status endpoint used by the browser UI.

Flow:

1. Calls CHZZK channel API.
2. Reads `content.openLive`.
3. Returns:

```json
{
  "live": true,
  "channelName": "..."
}
```

On CHZZK failure it returns `502` with `live: false`. This endpoint is for display only and should not drive Discord alert state.

### `api/admin-security.js`

Shared helper for admin APIs.

Responsibilities:

- Reads JSON request bodies in Vercel and stream-style runtimes.
- Compares admin passwords with `crypto.timingSafeEqual`.
- Applies a simple in-memory per-IP rate limit.

This rate limit is basic abuse resistance, not a full security system.

### `api/admin-auth.js`

Admin login check.

Environment variable:

```text
ADMIN_PASSWORD
```

Accepts only `POST`. Returns `200 { ok: true }` when the submitted password matches.

### `api/admin-content.js`

Admin save endpoint.

Environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
```

Flow:

1. Accepts only `POST`.
2. Verifies admin password.
3. Sanitizes settings and clips.
4. Calls Supabase RPC `replace_site_content`.
5. Returns saved content to the browser.

The service-role key must only live in Vercel environment variables.

### `api/check-live-alert.js`

Discord live-start alert worker.

Environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DISCORD_WEBHOOK_URL
```

Flow:

1. Accepts only `GET`.
2. Checks CHZZK live status.
3. Calls Supabase RPC `claim_live_start_alert`.
4. Sends a Discord Webhook message only when needed.
5. Calls Supabase RPC `mark_live_start_alert_sent` after successful Discord delivery.
6. Calls Supabase RPC `mark_live_start_alert_failed` if Discord delivery fails.

Alert message:

```text
ku앤유 방송 시작했습니다!
     https://chzzk.naver.com/7f43db49e367d87397c3a38d57dad71f
```

Mentions are disabled through:

```json
{
  "allowed_mentions": {
    "parse": []
  }
}
```

State behavior:

- Repeated calls while the broadcast remains live do not resend Discord alerts.
- CHZZK failures do not get treated as offline transitions.
- If a broadcast is already live when the state row is first initialized, a later unsent-live check can still send one alert if `last_alert_sent_at` is empty.

### `api/discord-live-alert.js`

Thin alias endpoint for external schedulers.

It simply exports `check-live-alert.js`:

```js
module.exports = require("./check-live-alert");
```

Use this public URL in cron-job.org or another scheduler:

```text
https://ku-andyou.vercel.app/api/discord-live-alert
```

Recommended scheduler settings:

```text
Method: GET
Interval: 3 minutes
Timeout: 30 seconds
```

## Supabase

Project URL currently used by the frontend:

```text
https://qgjxyqehvftddypltzrd.supabase.co
```

### `supabase-schema.sql`

Full setup SQL for the public site content system.

Defines:

- `public.site_settings`
- `public.clips`
- `public.set_updated_at`
- RLS policies for public reads.
- Grants for `anon`, `authenticated`, and `service_role`.
- RPC `public.replace_site_content(p_settings jsonb, p_clips jsonb)`.
- Seed data for settings and the initial clip.

Use this file when rebuilding the main content schema from scratch.

### `supabase-schema.sql.md`

Copy-paste SQL specifically for the Discord live alert state system.

Defines:

- `public.live_alert_state`
- RPC `public.claim_live_start_alert(p_state_id text, p_is_live boolean)`
- RPC `public.mark_live_start_alert_sent(p_state_id text)`
- RPC `public.mark_live_start_alert_failed(p_state_id text, p_error text)`
- Service-role grants for those functions.

This file is intentionally SQL-only so the user can paste it directly into the Supabase SQL Editor.

## Data Model

### `site_settings`

Single site settings row.

Primary row:

```text
id = main
```

Important fields:

- `hero_lead`
- `stream_url`
- `schedule_note`
- `footer_text`
- `social_links`
- `profile_items`
- `schedule_items`

`social_links`, `profile_items`, and `schedule_items` are JSON arrays rendered by `app.js`.

### `clips`

Clip card data.

Important fields:

- `title`
- `url`
- `video`
- `embed_url`
- `thumbnail`
- `sort_order`
- `is_visible`

Only `is_visible = true` clips are public through the browser-side Supabase query.

### `live_alert_state`

Single-row live alert state.

Primary row:

```text
id = chzzk_main
```

Important fields:

- `was_live`
- `alert_pending`
- `alert_in_flight_until`
- `last_checked_at`
- `last_live_started_at`
- `last_alert_sent_at`
- `last_error`

This table prevents repeated Discord alerts while the broadcast remains live.

## Admin Editor Behavior

User flow:

1. Open site.
2. Click `관리자 설정`.
3. Enter password.
4. Browser calls `./api/admin-auth`.
5. On success, admin editor appears.
6. User edits content.
7. Browser calls `./api/admin-content`.
8. On success, the page updates, `수정되었습니다` alert appears, and the admin modal closes.

Schedule editing format:

```text
요일=시간
```

Example:

```text
월요일=오후 8시
금요일=오후 10시
```

Lines without `=` or with an empty key/value are ignored.

## Local And Ignored Files

### `정보.md`

Local private notes and secrets. This file is ignored by Git and Vercel.

It may contain:

- Supabase keys.
- Discord Webhook URL.
- Admin password notes.
- Other private operational notes.

Do not commit it. Do not paste its secret values into public files.

### `사진/`

Local raw image folder. Ignored by Git and Vercel.

### `클립/`

Local raw clip folder. Ignored by Git and Vercel. It can contain very large source videos and must not be uploaded to Vercel.

### `.vercel/`

Local Vercel CLI project-link metadata. Ignored by Git and Vercel.

## Public Assets

### `images/`

Committed image assets used by the public page.

- `andyou-bg.png`
- `andyou-full.png`

### `clips/`

Committed lightweight site clip assets.

- `andyou-clip-01.mp4`

Do not confuse this folder with ignored local raw folder `클립/`.

### `clips.json`

Fallback clip data. Used only when Supabase clip loading fails.

## Environment Variables

Production Vercel environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
DISCORD_WEBHOOK_URL
```

The user-facing setup helper is:

```text
vercel-env.md
```

Update that helper if environment variable names change.

## Deployment Notes

GitHub repository:

```text
https://github.com/appppie1717-beep/ku_andyou
```

Normal deployment path:

```text
git push origin main
```

If Vercel does not automatically deploy the latest commit, use Vercel CLI from a clean deployment directory containing only tracked files. The real project folder contains ignored large files, so deploying directly from the project root can fail with a file-size error.

The repo includes `.vercelignore`, but the safest manual deploy path is:

```powershell
$stamp=Get-Random
$zip="C:\Windows\Temp\ku-andyou-$stamp.zip"
$dir="C:\Windows\Temp\ku-andyou-deploy-$stamp"
git -C "C:\Users\USER\Desktop\앤유" archive --format=zip -o $zip HEAD
New-Item -ItemType Directory -Path $dir | Out-Null
Expand-Archive -LiteralPath $zip -DestinationPath $dir
npx vercel link --yes --project ku-andyou --scope appppie1717-beeps-projects
npx vercel deploy --prod --yes
```

Run the last two commands with `workdir` set to the extracted `$dir`.

## Validation Commands

Run from any shell:

```powershell
node --check "C:\Users\USER\Desktop\앤유\app.js"
node --check "C:\Users\USER\Desktop\앤유\api\admin-auth.js"
node --check "C:\Users\USER\Desktop\앤유\api\admin-content.js"
node --check "C:\Users\USER\Desktop\앤유\api\admin-security.js"
node --check "C:\Users\USER\Desktop\앤유\api\live-status.js"
node --check "C:\Users\USER\Desktop\앤유\api\check-live-alert.js"
node --check "C:\Users\USER\Desktop\앤유\api\discord-live-alert.js"
git -C "C:\Users\USER\Desktop\앤유" diff --check
git -C "C:\Users\USER\Desktop\앤유" status --short --branch
```

Secret scan before committing:

```powershell
rg -n "discord\.com/api/webhooks|discordapp\.com/api/webhooks|sb_secret_|eyJ[A-Za-z0-9._-]{80,}|ADMIN_PASSWORD=|SUPABASE_SERVICE_ROLE_KEY=" "C:\Users\USER\Desktop\앤유"
```

Expected behavior:

- Real secret values should only appear in ignored local files such as `정보.md`.
- No Discord Webhook URL or service-role key should appear in committed files.

## Known Operational Caveats

- `api/live-status.js` and `api/check-live-alert.js` both query CHZZK, but they serve different purposes. Do not use the UI endpoint as the alert state machine.
- The Discord alert endpoint is public. Abuse mainly costs extra Vercel/Supabase/CHZZK calls; duplicate Discord messages are prevented by Supabase state.
- If stronger abuse resistance is needed later, add a `CRON_SECRET` environment variable and require it on `/api/discord-live-alert`.
- Vercel Hobby does not support 3-minute Vercel Cron. Use cron-job.org or another external scheduler to call `/api/discord-live-alert`.
- If a live broadcast is already in progress when the alert state is first initialized, the code can send one unsent-live alert as long as `last_alert_sent_at` is still empty.
- `AI_PROJECT_GUIDE.md` itself is currently excluded from Vercel uploads by `.vercelignore`.
