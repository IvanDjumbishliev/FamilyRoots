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

Environment configuration is optional for Phase 1. Copy `.env.example` to `.env.local` when preparing a Supabase project:

- Windows PowerShell — `Copy-Item .env.example .env.local`
- macOS and Linux — `cp .env.example .env.local`

| Variable                               | Value                                                     |
| -------------------------------------- | --------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Supabase project URL                                      |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key beginning with `sb_publishable_` |

Set both values together and restart Expo. `src/lib/env.ts` provides the configuration reader for a future Supabase client. Values prefixed with `EXPO_PUBLIC_` are bundled into the client. Keep service-role keys, secret keys, and database credentials in server-side configuration. Local environment files are Git-ignored.

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
