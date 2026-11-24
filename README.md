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

The private `family-media` bucket accepts paths of the form `<tree UUID>/<unique-file-name>`, with a 10 MB per-file limit. Storage authorization checks the tree membership on each request. The connected person profile uses this bucket for profile photos. The Family Archive uses its own private bucket and upload validation function.

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

## Family Archive

Open **Family Archive → Upload Memory** in a connected tree. The archive accepts JPEG, PNG, PDF, and UTF-8 text. Keep originals up to 10 MB. Images also get a compressed preview with a maximum side of 2,000 pixels and a thumbnail with a maximum side of 320 pixels. The archive preserves the original bytes for download. PDFs open in the device or browser viewer, and plain text previews open in the app.

Owners and editors can upload files, edit descriptions and other details, link up to 50 people, and select an existing tree event or create one from the archive form. Use a consistent collection name to group related files. The directory can search across titles, filenames, descriptions, locations, source notes, and linked names, then filter by file type, person, event, or collection. Viewers can read and download authorized files. Owners can remove any file in their tree, and editors can remove their own uploads.

The private `family-archive` bucket enforces tree access for each new download or signed URL. URLs expire after 60 seconds. The server validates file structure and ignores path components in filenames. It hashes the original bytes with SHA-256. An identical upload in the same tree returns the existing record without changing its metadata. A retry after a failed upload can reuse the same file and details. Interrupted reservations expire after 10 minutes. Ready and pending file bytes, including derivatives, count toward a 500 MiB limit per tree.

Removal first hides the item and denies new downloads, then removes the original and derivatives from Storage. The database retains a private tombstone and audit history with uploader and editor IDs. If a Storage outage prevents cleanup, an operator can retry removing the paths for the affected failed or removed rows through the Storage API. A URL already issued can work until expiration if the object could not be deleted immediately.

### Deploy the archive backend

Apply the latest migrations, then deploy the Edge Function to the same linked Supabase project:

```sh
npx supabase@3.2.0 db push
npx supabase@3.2.0 functions deploy archive
```

For local development, start the Supabase stack and, if the function runtime is not running, run `npx supabase@3.2.0 functions serve archive` from the repository root. Run `npx supabase@3.2.0 test db --local` for the archive and authorization suites. Supabase provides the function's server-only environment. The app still uses only the project URL and publishable key. The function verifies the caller's user JWT through Supabase Auth and checks the tree role before using the server-only Storage capability.

## Family history timeline

Open **Family history timeline** from Home or Family Tree. The connected timeline lists saved events oldest first, groups them by decade or century, and displays undated entries separately. A partial date sorts by the first day of its known period and displays only the precision entered. Approximate dates are labeled. Date range filters use inclusive years and exclude undated records by default. The branch filter follows recorded links from the selected person to their descendants.

Owners and editors can add and edit events, select multiple people, attach photos and documents already in Family Archive, and cite existing or new sources. Open an event to follow its evidence and people links. Removing an event also removes its associations. The people, archive files, and source records stay in the tree. Viewers can read authorized timeline records.

Use **Historical context** for background notes. These appear in a separate section from family events and their verification labels. The `timelineForBook` function in `src/features/timeline/timelineModel.ts` exposes chronological sections, event dates, verification status, and evidence IDs for later book use.

Apply the latest migration before using connected timeline editing. No new credentials or environment variables are required.

## Phase 11 · Family collaboration

Open **Family collaboration** from Home or Family Tree. Owners can send and cancel invitations, assign Editor or Viewer, and revoke access. Editors can post on profiles, archive items, and source citations, propose supported corrections, and flag disputed relationships. Owners resolve reviews after comparing the original, current, and proposed values. Recent changes show the authenticated editor and time, with read markers for each member.

The invitation email and the pending inbox omit the tree name and its records. The recipient must sign in with the matching verified email address. Invitations expire after seven days and can be accepted or declined once. If email delivery fails, the invitation remains in **My tree invitations** for the verified recipient. Access starts on acceptance. Before sending, the owner must confirm they have permission to share the tree’s living relatives’ information with that recipient. Membership is tree-wide, so keep material without sharing consent in a separate private tree. Revocation blocks subsequent database and storage access. Previously issued archive and profile photo URLs can remain usable for up to 60 seconds. Keep Supabase Auth email confirmation enabled so only the verified owner of an address can accept an invitation.

Apply the migration and deploy the Edge Function to your linked Supabase project:

```sh
npx supabase@3.2.0 db push
npx supabase@3.2.0 functions deploy collaboration
```

Set these **Edge Function secrets** in Supabase. The application continues to use the same public environment variables in `.env.example`.

| Secret                  | Value                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `COLLAB_APP_URL`        | The HTTPS origin of the deployed FamilyRoots web app. Configure your host to serve the app at `/invitations`. |
| `COLLAB_EMAIL_FROM`     | Sender address on a verified Resend domain.                                                                   |
| `COLLAB_RESEND_API_KEY` | Resend key with permission to send mail.                                                                      |
| `COLLAB_EMAIL_API_URL`  | Optional operator-controlled Resend-compatible send endpoint for local integration tests.                     |

For local development, pass an untracked secrets file to `npx supabase@3.2.0 functions serve collaboration --env-file path/to/collaboration.env`. The local invite inbox works without delivery secrets. Invitation email is the external notification channel. Review and change notifications appear in the app when refreshing or opening the collaboration screen.

## Phase 12 · GEDCOM import and export

Open **Family Tree → GEDCOM import and export** in a connected workspace. Choose a `.ged` or `.gedcom` file. Preview people, relationships, events, and field notices before confirming. For possible duplicates, choose **Create new person**, **Skip person**, or an explicit merge target. Possible matches use normalized names and aliases, with exact birth dates ranked first. Merging keeps populated values and fills gaps. An import runs in one transaction. If a record violates a tree constraint, the summary identifies the record class and position, and the batch is rolled back. The downloadable field report includes original lines and may contain private information.

FamilyRoots reads the supported subset of [FamilySearch GEDCOM 7.0 and GEDCOM 5.5.1](https://gedcom.io/specs/) in UTF-8 (including ASCII text) and writes UTF-8 GEDCOM 7.0. It supports individual names, vital facts, common personal and family events, explicit pedigree links and partnerships, inline or shared notes, source records, and source citations with page references. Single Gregorian dates may have year, month, or day precision and an approximate indicator. The file report lists unsupported fields such as media, unfamiliar tags, date ranges, and non-Gregorian dates. Keep the original file if you need those fields. The app does not follow file paths, load remote media, or open source URLs during import. FamilyRoots extensions preserve selected relationship details, biography, display names, and shared-event participants. Other applications can ignore those extensions.

Owners and editors can import. Owners can export active records. **Deceased people only** is the default export and leaves out unknown-status and living profiles, connections involving them, and free-text notes, places, sources, and events that could identify them. The full export includes supported facts, evidence, and notes. It omits uploaded media, archived and draft profiles, historical context, disputed or AI-suggested relationships, and unrelated application data such as comments. Review exported files before sharing them outside FamilyRoots.

Transfers are limited to 1 MiB, 500 individuals, 4,000 parsed records or generated related records, and 30,000 lines. Use the fictional [GEDCOM sample](supabase/fixtures/gedcom-sample.ged) to try the workflow. Apply the migration with `npx supabase@3.2.0 db push` for a linked project. There are no new environment variables or provider credentials.

## Phase 13 · Historical record discovery

Sign in to a connected family tree and open **Discover**. Search the **Fictional Archive** for **Ada Valette**, **Lucien Moreau**, or **Inês Duarte**. Narrow a search by town, region, or country, by years between 1600 and 1925, or by record type. The sample collection and representative URLs are fictional. FamilyRoots publishes the fixtures under CC0-1.0. Live historical records are currently unavailable.

Review the result’s collection, reference, URL, license, and retrieval date. Compare it with an existing profile, then save the finding, reject the suggested match for that person, or attach a clearly labeled fictional citation. You can also record a possible parent, child, or partner as an unverified hypothesis. Hypotheses stay in Saved research and do not add links to the family tree. Attached fictional citations remain practice examples. Owners and editors can make research decisions. Viewers can search, compare, and read their tree’s saved research.

Apply the schema with `npx supabase@3.2.0 db push` on a linked project. No new environment variables or credentials are required. The mock uses the signed-in Supabase session and allows 20 requests per account each minute. Search responses are not cached. Saved findings are private tree records and carry the original provider attribution.

The provider boundary is in `src/features/discovery/historicalSearch.ts`. Each adapter identifies its provider and terms, and the search service validates and deduplicates results while retaining source attribution. A live adapter requires authorized API access and documentation, a server-side authenticated transport, its own rate limit, and a review of the provider’s rules for storing and citing records. Only approved historical facts and locality-level places belong in normalized results. Keep provider credentials, contact information, street addresses, and sensitive living-person details out of the app.

## Phase 14 · AI genealogy assistant

Open **Discover → Open genealogy assistant** in a connected tree. The protected backend defaults to a deterministic grounded preview, so it works without an AI account. Choose a task for a verified summary, biography, profile gaps, document explanation, possible record matches, relationship path, interview questions, or research plan. Paste a document excerpt for text-based analysis. The assistant does not fetch files or browse external records. Possible matches currently come from the Fictional Archive and are labeled as practice examples.

The assistant distinguishes verified tree entries, reported text or links, unknown details, and research suggestions. Available evidence appears beside each statement. Profile-level citations are linked records and may support only part of a profile. Relationship paths are limited to eight steps across up to 600 eligible links and omit disputed and AI-suggested links. A response does not edit a profile or add a relationship. Review the evidence and make any confirmed change through the regular tree editor.

Apply the database migration and deploy the function to your linked Supabase project:

```sh
npx supabase@3.2.0 db push
npx supabase@3.2.0 functions deploy genealogy-assistant
```

For local development, run `npx supabase@3.2.0 functions serve genealogy-assistant` from the repository root. The function checks the signed-in session and tree membership. Keep the app environment limited to the Supabase project URL and publishable key.

Optional Supabase Edge Function secrets are `OPENAI_API_KEY` and `ASSISTANT_OPENAI_MODEL`. Choose an available Responses API model that supports Structured Outputs. With both secrets set, the provider can reorder approved statements using only numbered items, task categories, and evidence-status labels. The function sends no profile names, dates, notes, source titles, IDs, tree identifiers, or document text to OpenAI. The response uses `store: false`, a 256-token output cap, and an eight-second timeout. The backend permits 20 assistant requests per account per UTC day and 200 live attempts per project per UTC day. Invalid provider replies, provider errors, or exhausted live quota fall back to the grounded response. See the [OpenAI structured output guide](https://developers.openai.com/api/docs/guides/structured-outputs).

Assistant requests and responses are held only for the current view. **Clear assistant session** removes the excerpt, selected profiles, and response, including any response still in flight. The application keeps no conversation history. Quota counters track usage without storing prompts, excerpts, or answers.

## Phase 15 · Family history books

Open **My Books → Create Book** in a connected tree. Choose the whole tree, a verified descendant branch, or the **Fictional sample family** to try the complete workflow. Enter a title, attribution, optional notice and dedication. Choose a theme and English, Spanish, or Bulgarian for headings and generated text. Names, quotations, and contributor text stay in their original language. Review the outline, generate a draft, then edit or regenerate individual sections before selecting **Export PDF**. The contents page, running headers, page numbers, and photo captions are laid out on the server.

The default **Deceased people only** edition omits living and unknown-status profiles, places, biographies written by contributors, archive media, and source titles. It keeps references to the tree’s records without exposing those titles. A full edition requires permission to include private information and reproduce any selected media. Review manually entered titles, attributions, dedications, and edits before export. The worker does not automatically redact content typed by the contributor. It embeds available JPEG/PNG thumbnails and includes selected documents as archive references. Captions remain if an image is unavailable. The draft uses a snapshot of the evidence captured at generation. Create a fresh draft when privacy or source records change.

The worker assembles text from verified records and separates contributor text and media credits from automated material. This phase uses no generative AI. Copyright notices are configurable and the book does not determine ownership, licensing, or registration. PDFs are private to their creator while they retain tree access. Download URLs expire after 60 seconds. The worker supports up to 100 included profiles, 100 selected events, 150 source references, and 10 selected archive files. PDFs are limited to 190 pages and 10 MB. The included DejaVu fonts cover the selected edition languages and common Latin, Greek, and Cyrillic names.

### Deploy and schedule background jobs

Apply the migration and deploy the function with the CLI with Docker running so that the font assets ship with it:

```sh
npx supabase@3.2.0 db push
npx supabase@3.2.0 functions deploy family-book-worker
```

The app wakes the worker when the creator opens a queued draft. To continue processing after the app closes, set a high-entropy **BOOK_WORKER_SECRET** as an Edge Function secret and save the same value in Supabase Vault as `family_book_worker_secret`. Save the deployment's HTTPS project URL in Vault as `family_book_project_url`. Enable `pg_cron` and `pg_net` for the project, then schedule the worker once per minute:

```sql
select cron.schedule('family-book-worker', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
      where name = 'family_book_project_url') || '/functions/v1/family-book-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-book-worker-secret', (select decrypted_secret from vault.decrypted_secrets
        where name = 'family_book_worker_secret')
    ),
    body := '{}'::jsonb
  );
$job$);
```

For local development, start the database and run `npx supabase@3.2.0 functions serve family-book-worker`. The in-app worker wake can be used without a local cron secret. Keep the Edge Function and Vault secrets out of client environment files. The app still uses only the project URL and publishable key.
