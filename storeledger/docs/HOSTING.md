# VPS Hosting Guide

## 1. Prepare the server

Use an Ubuntu VPS with at least 2 vCPU, 4 GB RAM and 40 GB SSD for the initial rollout. Point a DNS A record such as `api.yourdomain.com` to the VPS public IP.

Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu installation instructions. Confirm:

```bash
docker --version
docker compose version
```

Allow SSH, HTTP and HTTPS in the firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Configure StoreLedger

Upload or clone the project, then:

```bash
cd storeledger
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 24
nano .env
```

Put the first generated value in `DJANGO_SECRET_KEY`. Use the second hexadecimal value as both `POSTGRES_PASSWORD` and the password segment in `DATABASE_URL`. Set `DOMAIN`, `DJANGO_ALLOWED_HOSTS`, and `CSRF_TRUSTED_ORIGINS` to the real API hostname.

## 3. Start production

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f web worker scheduler caddy
```

Caddy obtains and renews the HTTPS certificate automatically after DNS is correct and ports 80/443 are reachable.

Create the first owner:

```bash
docker compose exec web python manage.py bootstrap_store \
  --username owner \
  --password 'replace-with-a-private-password' \
  --email you@example.com \
  --store-name "My Store"
```

Change the initial password through Django Admin or create the user with a private password in an interactive administrative session.

Verify:

```bash
curl https://api.yourdomain.com/health/
python scripts/smoke_test.py --url https://api.yourdomain.com
```

## 4. Backups

Run a backup manually:

```bash
set -a
. ./.env
set +a
sh scripts/backup.sh
```

Copy backups to a second server or object-storage bucket. Schedule the command nightly and perform a restore test before onboarding paying stores.

## 5. Configure the mobile production API

Inside `mobile/.env`:

```text
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

This v1.6.0 delivery is already linked to the existing `@henoktza/storeledger` EAS project, and its preview/production profiles target `https://api.ethiomeda.com/api/v1`. Change those `eas.json` values only if the production API hostname changes.

Then produce an internal APK:

```bash
cd mobile
npm install
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Use the production profile for a Google Play App Bundle after changing the application package ID, icon, splash assets, privacy policy and store listing.

For a responsive desktop deployment, export the Expo web build with the production HTTPS API URL and serve the generated static files behind Caddy or another static host:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 npx expo export --platform web
```

## 6. Updates

```bash
git pull
docker compose up -d --build
docker compose exec web python manage.py migrate --noinput
docker compose ps
```

Back up PostgreSQL before every production migration.
