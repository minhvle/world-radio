# World Radio PWA

A Progressive Web App version of World Radio, designed for GitHub Pages and Android.

## Deploy with GitHub Pages

1. Create a new **public GitHub repository**, for example `world-radio`.
2. Upload **all files and folders in this directory** to the repository root.
3. On GitHub, open:
   **Settings → Pages**
4. Under **Build and deployment**, choose:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Click **Save**.
6. Wait for GitHub Pages to deploy the site.

Your URL will normally be:

`https://YOUR-GITHUB-USERNAME.github.io/world-radio/`

## Install on Android

1. Open the GitHub Pages URL in Chrome on Android.
2. Open the Chrome menu (`⋮`).
3. Choose **Install app** or **Add to Home screen**.
4. Launch World Radio from the Android home screen.

## Features

- Persistent favourite stations
- Recent stations
- Search
- Country/language filters
- Music, news, talk, sports and jazz filters
- Previous/next/shuffle
- Volume control
- Sleep timer
- Export/import favourites
- PWA install support
- Offline caching of the application shell

## Notes

Radio playback still requires an Internet connection. Individual station streams may be unavailable, blocked, or unsupported by a browser.

The app uses browser `localStorage`, so favourites are stored separately on each device/browser.

For GitHub Pages project sites, all application paths are relative so the app works under `/world-radio/` rather than requiring the domain root.
