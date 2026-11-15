# streak.

A small, local-first dashboard for building a steady open-source contribution habit. Import recent public GitHub activity, log contributions that GitHub's feed misses, and keep an eye on your weekly goal and streak.

## Run locally

```sh
npm install
npm run dev
```

## How it works

- Public GitHub activity is fetched directly from the unauthenticated GitHub Events API. No GitHub sign-in, token, or backend is used.
- The GitHub username is prefilled from the account this app was built for and can be edited in the import field.
- GitHub's events feed is limited to recent public events (at most 100 are requested) and is rate-limited. It does not include private activity; manually log anything missing.
- Contributions and preferences are saved in this browser's `localStorage`. They do not sync to another browser or device. Clearing browser data removes them.
- A “contribution” in this tracker is any logged or imported event; this is a personal consistency aid, not an authoritative copy of GitHub's contribution graph.

## Checks

```sh
npm test
npm run lint
npm run build
```

## Deploy

The `main` branch has a GitHub Actions workflow that tests, builds, and deploys to GitHub Pages. The production base path is configured for the `oss-streak` repository.
