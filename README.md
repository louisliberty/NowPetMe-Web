# NowPetMe

Pet photo rating site: upload a pet, the community votes 1-10, Bayesian-weighted leaderboards, Pet of the Day,
XP and achievements, comments with reactions.

## How it is built

| Part | Tech | Where |
|---|---|---|
| Front end | React + TypeScript, Vite, Tailwind, shadcn/ui, wouter, TanStack Query | `client/`, shared types in `shared/` |
| Back end | PHP 8 JSON API (`/api/...`), MySQL, sessions in the database | `php-api/public/api/` |
| Database | MySQL / MariaDB | `php-api/database/schema.sql` |
| Share previews | `seo.php` adds the pet's name and photo to `/pet/:id` pages | `php-api/public/seo.php` |
| Hosting | HostGator shared hosting | see `HOSTGATOR_SETUP.md` |

## How changes go live
Pushing to `main` runs `.github/workflows/deploy-hostgator.yml`: it builds the React app, lints the PHP, runs the API
tests (`python3 php-api/tests/run_tests.py`), and only then uploads the site to HostGator over FTP. If any step fails,
nothing is uploaded. Uploaded pet photos (`uploads/` on the server) are never overwritten by a deploy.

## Working on it
* `npm ci && npm run build` builds the front end into `dist/public`.
* `python3 php-api/tests/run_tests.py` runs the whole API against a throwaway SQLite database.
* Database changes need a SQL file imported in phpMyAdmin (the deploy does not touch the database).
* Keep `CATEGORIES` and `PERSONALITY_TAGS` in `shared/schema.ts` in sync with `php-api/public/api/lib/Rules.php`.
