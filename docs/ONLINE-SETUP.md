# Putting Sketchforge online

Sketchforge works fully offline, and the ✨ Ask helper is built in (free, no setup). These steps switch on the online parts — all on free plans:

| Part | What it gives | Service (free plan) | Time |
|---|---|---|---|
| A. Website | ✅ done: GitHub Pages, https://akarulvm777.github.io/Sketchforge/ (Netlify is an optional alternative) | GitHub | — |
| B. Public downloads | ✅ done: the repository is public, installers are on its Releases page | GitHub | — |
| C. Accounts & cloud | Google / GitHub sign-in, cloud drawings, settings sync, shared brushes & themes | Supabase | 15 min |

When you are done, send Claude **the 3 public values** listed at the end; they go into `cloud-config.js` and
`package.json`. Never paste passwords, secrets or API keys into the chat: they go straight into GitHub, Supabase or
Netlify as described below.

---

## A. Website (Netlify)

1. Go to <https://app.netlify.com/signup> and choose **Sign up with GitHub**.
2. **Add new site → Import an existing project → GitHub**. Allow Netlify to see the `Sketchforge` repository (private is fine).
3. Branch to deploy: `claude/new-session-vuufqj`. The build settings come from `netlify.toml` (nothing to type). Click **Deploy**.
4. **Site configuration → Change site name**, for example `sketchforge` → your site is `https://sketchforge.netlify.app`.

From now on the site is rebuilt only when a release is pushed (a commit with `[release]` in its message), so
half-finished work never reaches people. Every app checks this site for new versions.

## B. Public downloads (GitHub)

The installers are big (80–100 MB), so they live on GitHub Releases. Your code repository is private, so people can't
download from it; a second, **public and empty** repository holds only the installers.

1. Create a new **public** repository, for example `sketchforge-downloads` (tick "Add a README").
2. Create a token that can publish there: GitHub → your picture → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**. Repository access: **Only select repositories →
   sketchforge-downloads**. Permissions → Repository permissions → **Contents: Read and write**. Generate, copy it.
3. In the **Sketchforge** repository: **Settings → Secrets and variables → Actions → New repository secret**.
   Name `RELEASES_TOKEN`, value: the token. Save.

Each release then copies the installers to `sketchforge-downloads` and the website's download buttons point there.

## C. Accounts & cloud (Supabase)

1. Go to <https://supabase.com>, sign in with GitHub, **New project** (name `sketchforge`, choose a region near you,
   save the database password somewhere safe — you won't need it here).
2. **SQL Editor → New query**: paste all of [`supabase/setup.sql`](../supabase/setup.sql) → **Run**. (Safe to run again.)
3. **Authentication → URL Configuration**:
   - Site URL: your Netlify address, e.g. `https://sketchforge.netlify.app`
   - Redirect URLs: add `https://sketchforge.netlify.app/**`
4. **Sign in with GitHub**: on GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Homepage URL: your Netlify address
   - Authorization callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
     (shown in Supabase under **Authentication → Providers → GitHub**)
   - Create, then **Generate a new client secret**. In Supabase → **Authentication → Providers → GitHub**: turn it on,
     paste the Client ID and the secret, Save.
5. **Sign in with Google**: <https://console.cloud.google.com> → create a project → **APIs & Services → OAuth consent
   screen** (External, app name "Sketchforge", your email) → **Credentials → Create credentials → OAuth client ID →
   Web application**. Authorized redirect URI: the same `https://<your-project>.supabase.co/auth/v1/callback`.
   Copy the Client ID and secret into Supabase → **Authentication → Providers → Google**, turn it on, Save.
   (Google shows "unverified app" to other people until you publish the consent screen: **OAuth consent screen →
   Publish app**.)

---

## Send these 3 public values to Claude

1. **Website address** — e.g. `https://sketchforge.netlify.app`
2. **Supabase Project URL** and **anon public key** — Supabase → **Project Settings → API**
   (the anon key is meant to be public; the database is protected by the rules in `setup.sql`)
3. **Downloads repository** — e.g. `your-name/sketchforge-downloads`

Claude then fills in `cloud-config.js` and `package.json` (`sketchforge.releasesRepo`)
and pushes a release. Installed apps from 2.4.0 on pick up the website address from that release onwards.

## Keeping it up to date

- `node tools/make_screenshots.cjs` to refresh the website pictures.
- A release = bump the version (see CLAUDE.md) and push a commit with `[release]`: GitHub builds the installers and
  copies them to the downloads repository, Netlify publishes the new website and web app, every installed app updates itself.
