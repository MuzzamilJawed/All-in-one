# Accounts, Sign-In & Per-User Data

Every screen in SoloTrackr now sits behind an account. Watchlists, the portfolio
ledger and the dashboard's "watch any asset" list belong to the signed-in user,
so two people using the same server never see each other's data.

---

## Signing in for the first time

An **admin account is seeded automatically** the first time the app connects to
MongoDB. Start the app and sign in with:

| | |
|---|---|
| Email | `admin@solotrackr.app` |
| Password | `admin12345` |

Override these with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME`
in `.env` **before** the first run. **Change the password before deploying.**

Anyone else can create their own account from the *Create Account* tab on
`/login` — new accounts get the `user` role and start with an empty workspace.

The sign-up form collects **name, email, phone number, password and a verify-
password confirmation**. The phone number is required on this form and stored
normalised (formatting stripped, a leading `+` kept — `+92 300 123-4567` becomes
`+923001234567`). Google sign-up never asks for one, so the field is optional on
the account itself; those users can add it later from `/profile`.

Every password field in the app has a show/hide eye toggle.

---

## My Profile — `/profile`

Every signed-in user gets their own account screen:

- **Identity** — avatar, name, email, role, which sign-in methods are linked,
  when they joined and when they last signed in.
- **Activity** — watchlists, symbols tracked, trades recorded, instruments
  traded, assets on the dashboard watch list, and the span of their trading.
- **Account details** — display name and phone number are editable (the phone
  can also be cleared). The sidebar chip updates immediately.
- **Password** — change it, or *set* one for the first time if the account was
  created through Google (which then enables email sign-in too).

Email and role aren't self-editable: the email identifies the account and is
what Google matches on, and the role is an administrator's decision.

---

## User Management — `/admin/users` (admins only)

The link appears in the sidebar only for administrators, and the page and its
APIs both refuse anyone else.

- **Directory** of every registered account — avatar, name, email, role,
  linked sign-in methods, watchlist/symbol/trade counts, join date and last
  sign-in. Searchable by name or email; sortable by newest, recently active,
  name or most trades.
- **Detail drawer** — click any row for that account's full activity roll-up and
  a summary of their watchlists (names, market type and size).
- **Role management** — promote a user to admin or demote them back.

Two things this deliberately does **not** do: an admin cannot read another
user's holdings or watchlist contents (only names and counts), and there is no
delete-user action.

**Guard rails on role changes**

- You can't remove your own administrator access.
- At least one administrator must always remain.
- The admin role is re-read from the database on every admin request, so
  demoting someone revokes their access immediately — they don't keep it until
  their session cookie expires.

---

## Google sign-in

The Google button only appears once a client ID is configured.

1. Open the [Google Cloud credentials page](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application.**
3. Under **Authorized JavaScript origins**, add every origin the app is served
   from — e.g. `http://localhost:3005` for development and your HTTPS domain in
   production.
4. Copy the client ID into `.env`:

   ```env
   GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
   ```

5. Restart the dev server.

Signing in with Google on an email that already has a password account links the
two — it's still one user, with one set of watchlists and one ledger.

> **Capacitor note:** Google Identity Services will only render on an origin
> listed above. The native shell loads your deployed server, so add that exact
> origin. Email/password sign-in works everywhere regardless.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | Database connection. |
| `AUTH_SECRET` | **in production** | Signs the session cookie. Without it the app falls back to a known development secret and sessions can be forged. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. |
| `GOOGLE_CLIENT_ID` | no | Enables the Google sign-in button. |
| `COOKIE_SECURE` | no | Set to `false` to allow the session cookie over plain HTTP in a production build (LAN / Capacitor dev). |
| `SEED_ADMIN_EMAIL` · `SEED_ADMIN_PASSWORD` · `SEED_ADMIN_NAME` | no | Override the seeded admin. |

Changing `AUTH_SECRET` signs everyone out; it does not affect stored passwords.

---

## What happens to data from before accounts existed

Nothing is lost:

- **Watchlists** already in MongoDB are adopted by the seeded admin on the first
  connection after upgrading, so signing in as the admin shows them exactly as
  before.
- **Portfolio trades and the universal watch list** used to live in the
  browser's `localStorage`. The first time you sign in on that browser they're
  uploaded into your account and the local copies are dropped. The import only
  runs when the account is still empty, so it can't duplicate or overwrite
  anything already on the server.

---

## How it works

Hand-rolled and dependency-free — nothing beyond what the project already used.

| Piece | File |
|---|---|
| Password hashing (scrypt, `node:crypto`) | `app/lib/password.ts` |
| Phone normalisation + validation | `app/lib/phone.ts` |
| Password input with show/hide toggle | `app/components/PasswordField.tsx` |
| Session cookie (HMAC-SHA256, 30 days, httpOnly) | `app/lib/session.ts` |
| Google ID-token verification | `app/lib/google.ts` |
| `requireUser()` guard for route handlers | `app/lib/apiAuth.ts` |
| Admin seed + legacy-data adoption | `app/lib/seed.ts` |
| `requireAdmin()` guard (re-reads the role from the DB) | `app/lib/apiAuth.ts` |
| Per-user activity roll-ups | `app/lib/userStats.ts` |
| Client auth state | `app/context/AuthContext.tsx` |
| Sign-in / sign-up screen | `app/login/page.tsx` |
| Profile screen | `app/profile/page.tsx` |
| Admin user directory | `app/admin/users/page.tsx` |
| Route gate (`/login` redirect, `/admin/*` block) | `app/components/AppShell.tsx` |

**Data model** — `User`, `Transaction` and `Watchlist` (`app/models/`). Both
`Transaction` and `Watchlist` carry an indexed `userId`.

**The isolation rule:** every user-scoped query filters on `userId` taken from
the session cookie, never from the request body. A watchlist or trade belonging
to someone else returns `404`, and unauthenticated API calls return `401`.
