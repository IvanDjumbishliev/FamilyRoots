# FamilyRoots AI

FamilyRoots AI is an Expo and React Native foundation for a genealogy application on web, iOS, and Android. The initial app has a home screen and a settings route and runs without a backend.

## Install

Install Git and Node.js 22 LTS (22.13 or newer) with npm. Open PowerShell on Windows or a terminal on macOS or Linux. In the cloned repository, run:

```sh
npm ci
npm run web
```

Open the URL printed by Expo. Select **Settings**, then **Back to home** to check navigation. You can also open `/settings` directly. For a production web bundle, use `npm run build:web`. Expo writes the static export to `dist/`.

## Run on mobile

| Platform                            | Setup                                                                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android on Windows, macOS, or Linux | Install Android Studio and the Android SDK. Create and start a virtual device, then run `npm run android`.                                                                                                             |
| iOS on macOS                        | Install Xcode and an iOS Simulator runtime, start a simulator, then run `npm run ios`.                                                                                                                                 |
| Physical device                     | Run `npm start` with the computer and device on the same network. Use an Expo Go build compatible with SDK 54 where available, or create an SDK 54 development build and start Metro with `npm start -- --dev-client`. |

The iOS Simulator requires macOS. If the installed Expo Go version does not support this project's SDK, use a compatible development build. For native tooling and device instructions, see the [Expo development environment guide](https://docs.expo.dev/get-started/set-up-your-environment/).

## Environment

The demo workspace runs without Supabase. To enable the connected workspace in Settings, copy `.env.example` to `.env.local`:

- Windows PowerShell — `Copy-Item .env.example .env.local`
- macOS and Linux — `cp .env.example .env.local`

| Variable                               | Value                                                     |
| -------------------------------------- | --------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Supabase project URL                                      |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key beginning with `sb_publishable_` |

Set both values together and restart Expo. The app uses the publishable key to reach Supabase Auth and the Data API. Authorized requests also carry the signed-in user’s session. Values prefixed with `EXPO_PUBLIC_` are bundled into the client. Keep service-role keys, secret keys, and database credentials in server-side configuration. Local environment files are Git-ignored.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check:dependencies
npm run build:web
```

Use `npm run format` to apply formatting. Use `npx expo install <package>` for packages with Expo SDK version constraints.

## Project layout

- `src/app` holds Expo Router routes and the root stack.
- `src/components` holds shared controls, screen layout, and status states.
- `src/features` holds feature-specific screens and logic.
- `src/constants` holds theme tokens.
- `src/lib` holds infrastructure helpers and their tests.
- `src/hooks`, `src/services`, `src/types`, and `src/assets` are reserved for shared hooks, service integrations, domain types, and local assets.

Use the `@/` alias to import from `src/`.

## Design system

Run `npm run web` and open **Settings → Component showcase** or navigate to `/showcase` to try the shared controls, validation, dialog, and status states. The showcase is available in development builds. Open **Settings → Appearance** to follow the device theme or switch to light or dark for the current app session.

Shared components live in `src/components`. Use `useTheme` for semantic color and typography tokens and `useLayout` for tablet and desktop breakpoints. No additional environment variables are required for Phase 2.

## Dashboard and demo workspaces

The app starts with the fictional Moreau family. Open **Settings → Demo workspace → Empty family** to try onboarding. The two workspaces are independent and changes last until the page reloads or the app restarts.

Use **Add Person** to add a relative, **View Tree** to see people grouped by generation, **Upload Memory** to attach a local file, and **Create Book** to save and preview a draft outline. Discover searches the active tree by name and relationship. Files and other demo changes stay local to the running app. No new environment variables or credentials are needed.

`FamilyRepository` in `src/types/family.ts` defines the read, subscription, and write interface. `FamilyProvider` accepts a repository implementation. Phase 3 uses the in-memory repository in `src/services/mockFamilyRepository.ts`. The mobile shell uses bottom navigation and larger windows use a sidebar. The development showcase remains accessible from **Settings**.

## Supabase backend

Install Docker with a running engine and use the Supabase CLI from the repository root. The commands below use CLI 3.2.0 and create a separate local development stack.

```sh
npx supabase@3.2.0 start
npx supabase@3.2.0 test db --local
```

On a fresh start, the CLI applies `supabase/migrations/` and loads `supabase/seed.sql`. The seed contains fictional records and passwordless fixture identities used by the database tests. For interactive sign-in, create and confirm a development user in local Studio under **Authentication → Users**, then use that user's email and password in **Settings → Account settings**. Choose a password for that local development user. To grant the account access to a seeded tree, use the local SQL editor as an administrator to insert a `tree_memberships` row with the seeded tree ID, the new user's ID, and role `viewer` or `editor`. The account can also create its own tree from Settings.

Use `npx supabase@3.2.0 status` to find the local API URL and publishable key, and copy only those two values into `.env.local`. When testing from a mobile emulator or device, use the address through which that device can reach your development machine. For example, Android Studio's emulator uses `10.0.2.2` to reach the host loopback address. Use your project's HTTPS URL for hosted environments.

For your hosted project, run the commands below with your own project reference. The CLI prompts for any required credentials. Deploy the migrations to a development or staging project first.

```sh
npx supabase@3.2.0 login
npx supabase@3.2.0 link --project-ref <your-project-reference>
npx supabase@3.2.0 db push
```

In the hosted project's **Connect** dialog, copy the project URL and publishable key into the app environment. Provision and confirm an account in **Authentication → Users** to test sign-in. The hosted migration deployment excludes the local seed by default. Keep database passwords and secret or service-role keys out of client environment variables and app bundles.

**Settings → Account settings** lists the signed-in account's authorized trees, creates owned trees, and displays their people. Owners and editors can add a person. The existing dashboard and feature flows continue to use the separate session-based demo workspace.

### Authorization and data conventions

| Role   | Access                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner  | Read and edit tree records and media, rename the tree, and grant or revoke editor and viewer memberships. Creation assigns the owner role in the database. |
| Editor | Read and edit tree records and add or remove media.                                                                                                        |
| Viewer | Read tree records and private media.                                                                                                                       |

Each profile is readable and editable by its account holder. Memberships are visible to the owner and to the holder of each membership. The database writes activity records with the acting user's ID. Clients cannot insert or modify activity rows, transfer ownership, or delete a tree directly. People and genealogy records, including living persons, stay inside the authorized tree. The foundation includes no public sharing endpoint.

Record unknown dates as `NULL` with precision `unknown`. Use the first day of the year or month to store partial dates and set the matching precision. Approximation is recorded separately. Relationship provenance and verification are separate fields. The database rejects verified relationships whose provenance is still `ai_suggested`.

The private `family-media` bucket accepts paths of the form `<tree UUID>/<unique-file-name>`, with a 10 MB per-file limit. Storage authorization checks the tree membership on each request. Uploads, relationship editing, and ownership transfer in the connected UI are outside this backend foundation.

After schema changes, regenerate the database types against the migrated local stack:

```sh
npx supabase@3.2.0 gen types typescript --local --schema public > src/types/database.ts
npx prettier --write src/types/database.ts
npm run typecheck
```
