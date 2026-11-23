# FamilyRoots AI

FamilyRoots AI is an Expo and React Native foundation for a genealogy application on web, iOS, and Android. The initial app has a home screen and a settings route and runs without a backend.

## Install

Install Git and Node.js 22 LTS (22.13 or newer) with npm. Open PowerShell on Windows or a terminal on macOS or Linux. In the cloned repository, run:

```sh
npm ci
npm run web
```

Open the URL printed by Expo. Select **Settings**, then **Back to home** to check navigation. You can also open `/settings` directly. For a production web bundle, use `npm run build:web`. Expo writes the single-page export to `dist/`. Serve existing assets normally and rewrite other requests to `index.html` so account callbacks and private person URLs open directly.

## Run on mobile

| Platform                            | Setup                                                                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android on Windows, macOS, or Linux | Install Android Studio and the Android SDK. Create and start a virtual device, then run `npm run android`.                                                                                                             |
| iOS on macOS                        | Install Xcode and an iOS Simulator runtime, start a simulator, then run `npm run ios`.                                                                                                                                 |
| Physical device                     | Run `npm start` with the computer and device on the same network. Use an Expo Go build compatible with SDK 54 where available, or create an SDK 54 development build and start Metro with `npm start -- --dev-client`. |

The iOS Simulator requires macOS. If the installed Expo Go version does not support this project's SDK, use a compatible development build. For native tooling and device instructions, see the [Expo development environment guide](https://docs.expo.dev/get-started/set-up-your-environment/).

## Environment

The demo workspace runs without Supabase. To enable authentication and the connected workspace, copy `.env.example` to `.env.local`:

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

On a fresh start, the CLI applies `supabase/migrations/` and loads `supabase/seed.sql`. The seed contains fictional records and passwordless fixture identities used by the database tests. For interactive development, register from the app and use the verification email in local Mailpit. Alternatively, provision a confirmed test user in local Studio under **Authentication → Users**. To grant the account access to a seeded tree, use the local SQL editor as an administrator to insert a `tree_memberships` row with the seeded tree ID, the new user's ID, and role `viewer` or `editor`. The account can also create its own tree from Settings.

Use `npx supabase@3.2.0 status` to find the local API URL and publishable key, and copy only those two values into `.env.local`. When testing from a mobile emulator or device, use the address through which that device can reach your development machine. For example, Android Studio's emulator uses `10.0.2.2` to reach the host loopback address. Use your project's HTTPS URL for hosted environments.

For your hosted project, run the commands below with your own project reference. The CLI prompts for any required credentials. Deploy the migrations to a development or staging project first.

```sh
npx supabase@3.2.0 login
npx supabase@3.2.0 link --project-ref <your-project-reference>
npx supabase@3.2.0 db push
```

In the hosted project's **Connect** dialog, copy the project URL and publishable key into the app environment. Configure Auth email delivery and redirects before testing registration or recovery. The hosted migration deployment excludes the local seed by default. Keep database passwords and secret or service-role keys out of client environment variables and app bundles.

**Settings → Account settings** lists the signed-in account's authorized trees, creates owned trees, and displays their people. Owners and editors can add a person. The existing dashboard and feature flows continue to use the separate session-based demo workspace.

### Authorization and data conventions

| Role   | Access                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner  | Read and edit tree records and media, rename the tree, and grant or revoke editor and viewer memberships. Creation assigns the owner role in the database. |
| Editor | Read and edit tree records and add or remove media.                                                                                                        |
| Viewer | Read tree records and private media.                                                                                                                       |

Each profile is readable and editable by its account holder. Memberships are visible to the owner and to the holder of each membership. The database writes activity records with the acting user's ID. Clients cannot insert or modify activity rows, transfer ownership, or delete a tree directly. People and genealogy records, including living persons, stay inside the authorized tree. The foundation includes no public sharing endpoint.

Record unknown dates as `NULL` with precision `unknown`. Use the first day of the year or month to store partial dates and set the matching precision. Approximation is recorded separately. Relationship provenance and verification are separate fields. The database rejects verified relationships whose provenance is still `ai_suggested`.

The private `family-media` bucket accepts paths of the form `<tree UUID>/<unique-file-name>`, with a 10 MB per-file limit. Storage authorization checks the tree membership on each request. The connected person profile supports photograph uploads. Relationship editing and ownership transfer are separate workflows.

After schema changes, regenerate the database types against the migrated local stack:

```sh
npx supabase@3.2.0 gen types typescript --local --schema public > src/types/database.ts
npx prettier --write src/types/database.ts
npm run typecheck
```

## Authentication and onboarding

With both public Supabase variables set, the app requires a session for its main routes. New accounts confirm their email, then save a display name and create their first tree. Setup progress is derived from the saved profile and tree membership and survives a reload. An existing member only needs to fill in a missing display name. The onboarding database function serializes retries and creates at most one initial tree per account through this flow.

Open **Settings → Edit user profile** to change your display name or preferred language, or to log out. The language preference is saved with your account. The current interface is in English. The dashboard links to the connected tree and labels the separate demo data. With both environment variables blank, only the demo workspace is available.

### Local email testing

Start Supabase with Mailpit enabled. If the stack was already running when you changed the Auth configuration or templates, run `npx supabase@3.2.0 stop` and start it again. The normal stop preserves local data. Apply pending migrations with `npx supabase@3.2.0 migration up --local`, then run `npm run web` and open the app at `http://localhost:8081`. Supabase status shows the local Mailpit URL. Open the signup or recovery email there, follow its app link, then enter the address and six-digit code from the message. A native development build registers the `familyroots` scheme. Use a development build for native email links.

### Hosted Auth setup

1. Apply the database migrations. In the Supabase Dashboard, enable email and password signup and require email confirmation. Set the minimum password length to 12, choose six-digit email codes, and set an appropriate code lifetime and request rate limits. The local configuration uses a 10-minute lifetime and a 30-second email request interval.
2. Configure your SMTP provider for signup and recovery email. Add the sender credentials to Supabase Auth. Keep the app environment limited to the Supabase URL and publishable key.
3. Set the Auth **Site URL** to your HTTPS web origin. Add the exact callback URLs for that origin, ending in `/verify-email` and `/reset-password`, plus `familyroots://verify-email` and `familyroots://reset-password` for native builds. Serve both web paths through the single-page fallback described above.
4. Copy [the confirmation template](supabase/templates/confirmation.html) into **Confirm sign up** and [the recovery template](supabase/templates/recovery.html) into **Reset password**. The messages keep credentials out of the deep link and provide the one-time code separately. Links and code verification work from another device that has the app or web origin available.

The mobile client stores its persistent session in Expo SecureStore and clears the legacy unencrypted session cache. The web client persists the Supabase session in origin-scoped browser storage. Serve production web over HTTPS. Password recovery uses a temporary isolated session and requires a separate login afterward. The app throttles repeated submissions and uses generic responses to code requests. Configure provider-side Auth rate limits to enforce abuse controls independently of the client.

## Managing family members

Sign in and open **Family Tree**. Select a tree if your account belongs to more than one. Use the directory to search display names, birth names, and alternative names and filter active profiles, drafts, archived profiles, or living status. Owners and editors can add people and edit profiles. Viewers can read authorized records. Without a Supabase connection, Family Tree opens the session-based demo.

A person can be saved as a draft before a name is known. For dates, enter a year, year and month, or full date and mark it approximate when needed. Leave the date blank if unknown. A person's photo and citations can be attached after saving their profile. Photos are uploaded to the private `family-media` bucket and displayed through short-lived URLs. No additional credentials or environment variables are required.

Archiving keeps the person, relationships, media, and sources. Find the person in **Archived** to restore them. Profile history shows which fields changed and when. Supabase records the actor alongside those changes. Deploy the latest migrations using the Supabase setup above before using connected person management.

## Managing family relationships

Sign in, open **Family Tree**, and choose a person. Use **Relationships → Add relationship** to connect an existing person or create and link a new person in the same operation. The editor warns when the entered name matches an existing name or alias. It never links people based on name or gender. Editors and owners can change a parent-child type or direction, update a partnership's type, status, and dates, or change the label for another documented connection. To change a connection to a different category, remove it with confirmation and add the appropriate connection. Removing a connection keeps both people and removes citations attached to that connection.

A person can have multiple partnerships. Leave unknown parents unlinked and unknown dates blank. Partnership dates accept year, month, or day precision and an independent approximate marker. FamilyRoots AI derives shared-parent siblings, grandparents, grandchildren, ancestry, and generation levels from biological and adoptive links. Step, foster, guardian, partner, and other recorded links can contribute to **Find relationship path** without implying ancestry. Disputed and AI-suggested links are visible as recorded evidence and excluded from derived results.

Apply the latest Supabase migration for the connected feature. Viewer access remains read-only. PostgreSQL checks parent-child changes for cycles and serializes concurrent ancestry changes in the same tree. No new environment variables or credentials are required.

## Interactive family tree

Open **Family Tree** to explore the diagram. Selecting a card opens its profile. Search by name or alias and choose **Focus** to move the diagram to that person. The focused person sets the starting point for **Ancestors** and **Descendants**. Use **Collapse branch** or **Expand branch** to change what is shown. A shared relative stays visible when another expanded branch still reaches them.

Drag to pan and pinch or scroll to zoom. On the web, tab to the diagram and use the arrow keys and + or −. **Fit tree** shows the full current view, and **Center focused person** returns to the selection. Choose **Accessible list** for profiles and relationship descriptions grouped by generation. **People directory** still provides connected draft, archive, and living-status filters.

Owners and editors can choose **Add relative** to open relationship editing for the focused person. Returning to the tree reloads connections. Viewers can explore authorized trees. With Supabase unset, the sample workspace shows more than 100 fictional people across several generations. The empty demo and any demo edits stay local to the app session. No migration or new environment variables are required for this phase.
