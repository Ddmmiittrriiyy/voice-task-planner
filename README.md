# VoiceTasks

VoiceTasks is a personal task app for quickly adding tasks by voice or text.

The app does not make decisions for the user: it does not plan the day, move tasks automatically, assign priorities, or give productivity advice. It only saves and shows the tasks that the user enters.

## Features

- Add tasks by text.
- Add tasks by voice in supported Android browsers, especially Chrome.
- Recognize dates and times in Russian, Ukrainian, and English.
- Supported date phrases include today, tomorrow, the day after tomorrow, weekdays, month names, and numeric dates.
- Supported time phrases include simple hours, `09:30`, and morning/day/evening/night or AM/PM phrases.
- Edit task text, date, and time.
- Mark tasks as completed and restore completed tasks.
- Delete tasks with confirmation.
- Store all tasks locally on the device in browser storage.
- Export tasks to a JSON file.
- Import tasks from a JSON file and merge them by task id.
- Install as a PWA from Chrome using Add to Home screen / Install app.

## Privacy

VoiceTasks stores tasks locally in the browser using `localStorage`.

There is no account, no server database, no advertising, and no cloud sync in this version. If the app is hosted with GitHub Pages, GitHub only serves the static files of the app; task data stays in the user's browser storage.

Voice recognition in the PWA version is handled by the browser through the Web Speech API. Browser speech recognition may require internet access depending on the device, browser, language, and installed speech packages.

## Installation On Android

1. Open the GitHub Pages link in Chrome.
2. Tap the Chrome menu `...`.
3. Tap **Add to Home screen** or **Install app**.
4. Open VoiceTasks from the home screen.

Chrome may also offer to install the app automatically after the site has been used.

## Files

- `index.html` - app interface.
- `style.css` - visual design.
- `app.js` - task logic, parsing, storage, import/export, voice input.
- `manifest.json` - PWA metadata and icons.
- `sw.js` - offline cache service worker.
- `icon-192.png` and `icon-512.png` - app icons.
- `.nojekyll` - tells GitHub Pages to serve files as plain static assets.

## Deploy To GitHub Pages

1. Create a GitHub repository, for example `VoiceTasks`.
2. Upload all files from this folder into the repository root.
3. Open repository **Settings**.
4. Go to **Pages**.
5. In **Build and deployment**, choose **Deploy from a branch**.
6. Select branch `main` and folder `/root`.
7. Save.

After deployment, GitHub Pages will provide a link similar to:

```text
https://USERNAME.github.io/VoiceTasks/
```

Open that link in Chrome on Android and install the PWA.

## Notes

The APK version and the PWA version are different delivery formats for the same app idea.

- PWA is recommended for ordinary users because it installs from an HTTPS link and does not trigger Android unknown-source APK warnings.
- APK is useful for a private offline Android build, but installing APK files outside Google Play can show security warnings.
