# streak.

A local-first dashboard for building a steady open-source contribution habit. See a full-year contribution heatmap and streak, inspect recent public activity, set a weekly goal, and log personal check-ins.

## Run locally

```sh
npm install
npm run dev
```

## How it works

- Full-year daily counts are loaded from the public GitHub contribution calendar through the community service [github-contributions-api](https://github.com/grubersjoe/github-contributions-api). The username is public; no sign-in or token is used.
- The GitHub username is prefilled from the account this app was built for and can be edited in the import field.
- Recent activity details come separately from GitHub's public Events API (up to 100 recent events). They are not used as the overall contribution total. The calendar shows the last 365 days as exposed by GitHub's profile graph; visibility settings affect what GitHub includes.
- The contribution calendar, recent event details, preferences, and manual check-ins are saved in this browser's `localStorage`. They do not sync to another browser or device. Clearing browser data removes them.
- Streaks and goals use the daily profile count, with local check-ins ensuring an otherwise empty day is still recorded. This is a personal consistency aid, not an official GitHub analytics product.

## Checks

```sh
npm test
npm run lint
npm run build
```

## Deploy

The `main` branch has a GitHub Actions workflow that tests, builds, and deploys to GitHub Pages. The production base path is configured for the `oss-streak` repository.
