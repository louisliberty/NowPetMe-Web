# Hosting NowPetMe on HostGator (PHP + MySQL)

This repo now contains two backends. The original Node/Express one (`server/`) still works on Replit or any
Node host. The new one in **`php-api/`** is a drop-in PHP/MySQL replacement that runs on HostGator's
shared hosting (Baby plan). The React front end is unchanged: it is built once and uploaded as static files.

```
GitHub push to main ──► GitHub Actions ──► builds React (vite) + merges php-api/public ──► FTP to public_html
```

What lands in `public_html/`:

| Path | What it is |
|---|---|
| `index.html`, `assets/`, `images/` | The built React app |
| `api/` | PHP API (same `/api/...` endpoints the React app already calls) |
| `seo.php` | Makes `/pet/123` links show the pet's name and photo when shared |
| `uploads/` | Photos people upload. **Never overwritten by deploys** |
| `.htaccess` | HTTPS redirect, `/api` routing, React page fallback, caching |

---

## One-time setup

### 1. Check PHP (cPanel → MultiPHP Manager)
Set your domain to **PHP 8.1 or newer** (8.2/8.3 are fine). In cPanel → *Select PHP Version* → *Extensions*,
make sure these are ticked: `pdo_mysql` (or `mysqlnd`), `gd`, `curl`, `mbstring`, `fileinfo`, `exif`, `json`.

### 2. Create the database (cPanel → MySQL® Databases)
1. Create a database, e.g. `nowpetme` (cPanel adds your account prefix: `youracct_nowpetme`).
2. Create a database user with a strong password.
3. Add the user to the database with **ALL PRIVILEGES**.
4. Write down the full database name, user name and password.

### 3. Create the tables (cPanel → phpMyAdmin)
1. Select your database → **Import** → choose `php-api/database/schema.sql` → *Go*.
2. Optional: import `php-api/database/seed.sql` to add the 5 sample pets (Buddy, Whiskers, Rio, Snowball, Neptune).

### 4. Create the secrets file
Copy `php-api/nowpetme-config.sample.php` to a file named **`nowpetme-config.php`**, fill it in, and upload it
**one folder above `public_html`** (cPanel → File Manager → your home directory, e.g. `/home/youracct/`).
It must not be inside `public_html`, and it is already in `.gitignore` so it never goes to GitHub.

| Setting | Where to get it |
|---|---|
| `db.*` | Step 2. Host is `localhost` on HostGator |
| `base_url` | Your site, e.g. `https://nowpetme.com` (no trailing slash) |
| `ip_salt` | Any long random string |
| `resend_api_key`, `from_email` | https://resend.com → API Keys. Add and verify your domain in Resend (it gives you DNS records to add in cPanel → Zone Editor). Without this, verification and password-reset emails are not sent |
| `openai_api_key` | https://platform.openai.com → API keys (needs billing). Without it, **every upload is rejected** (the app fails closed, like the Replit version) |
| `trust_proxy_header` | Leave empty unless you put Cloudflare in front, then `CF-Connecting-IP` |

> If your site lives in a sub-folder or is an *addon domain* rather than the main `public_html`, put the config
> file one level above that site's folder, or ask HostGator support to help set the `NOWPETME_CONFIG` environment variable.

### 5. Free SSL (cPanel → SSL/TLS Status)
Run **AutoSSL** for your domain and wait until it shows a valid certificate. The `.htaccess` redirects all traffic to
HTTPS, so do this *before* the first deploy (otherwise the site will show certificate errors).

### 6. Let GitHub upload the site
1. cPanel → **FTP Accounts** → create an account (e.g. `deploy@nowpetme.com`) whose directory is `public_html`.
2. In GitHub: repo → **Settings → Secrets and variables → Actions**.
   Add **secrets**:
   * `FTP_SERVER`: your server's hostname from cPanel's FTP Accounts page (e.g. `gator1234.hostgator.com`), **not** your domain
   * `FTP_USERNAME`: the full FTP username
   * `FTP_PASSWORD`: its password
   * `FTP_DIR` (optional): defaults to `public_html/`. Use e.g. `public_html/nowpetme.com/` for an addon domain

   Optional **variables** (Variables tab): `FTP_PROTOCOL` = `ftps` (default, encrypted) or `ftp` if FTPS fails; `FTP_PORT` (default 21).

### 7. Deploy
Merge the `hostgator-php-backend` branch into `main` (or push to `main`). GitHub → **Actions → Deploy to HostGator**
builds and uploads everything (about 2-3 minutes). You can also run it by hand with *Run workflow*.
Each run also saves the finished site as a downloadable zip (`nowpetme-site`) if you ever prefer uploading through File Manager.

---

## Smoke test (do this after the first deploy)
1. Open the site. The home page loads, sample pets appear (if you imported `seed.sql`).
2. Vote on a pet: the score updates; voting again says you already voted.
3. Register an account: a verification email arrives; clicking it returns you to the site with a success message.
4. Upload a pet photo: a real pet photo is approved; a picture of a laptop is rejected.
5. Comment, like, react with an emoji, edit and delete a comment.
6. Open `https://yoursite/pet/1`, then paste the link into a chat app, which should show the pet's photo and name.
7. Forgot password → email → reset → log in.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Everything under `/api` returns *Internal Server Error* | Open `public_html/error_log` (or `api/error_log`). Usually a wrong DB name/user/password in `nowpetme-config.php`, or the config file is in the wrong folder |
| `NowPetMe config file ... not found` in the log | Config isn't directly above `public_html` (see step 4) |
| Every upload says *moderation unavailable* | `openai_api_key` missing/invalid, or OpenAI billing not set up. Check the log |
| No emails | `resend_api_key` missing, or the `from_email` domain isn't verified in Resend |
| Refreshing `/leaderboard` gives a 404 | `.htaccess` didn't upload (hidden file). Re-run the deploy, check File Manager → *Show hidden files* |
| Upload fails with *Photo must be 5MB or smaller* for small photos | Host's `upload_max_filesize` / `post_max_size` is very low. Raise them in cPanel → MultiPHP INI Editor |
| Deploy fails at "Upload to HostGator" | Wrong `FTP_SERVER`/credentials, or try variable `FTP_PROTOCOL=ftp` |

## Good to know
* **Photos** live in `public_html/uploads`. They are not in GitHub, so back them up (cPanel → Backup, or download the folder). Back up the database too (phpMyAdmin → Export).
* **Sessions** (logins) are stored in MySQL and last 30 days. Passwords use bcrypt, same as before.
* **Votes and likes** are limited per anonymised IP (hashed with `ip_salt`; raw IPs aren't stored). Visitors behind the same Wi-Fi/office share one vote per pet, same as the Replit version.
* **Pet of the Day** needs no cron job. It is chosen the first time anyone loads the home page each (UTC) day, and the owner is emailed.
* **Ranking** uses the Bayesian weighted score (m = 10), recalculated on every vote.
* Basic abuse limits are built in: login (20 per 15 min per IP), sign-ups (10/hour), password resets (5/hour), reports (30/hour).
* Uploaded photos are re-encoded (stripping GPS/EXIF location data) and capped at 1600px, which saves bandwidth on shared hosting.
* Tests: `python3 php-api/tests/run_tests.py` runs the whole API against a throwaway SQLite database (needs PHP 8.1+ and Python `requests`).
* The Node server, `.replit`, and Replit-specific files are no longer needed for HostGator and can be deleted whenever you like.
