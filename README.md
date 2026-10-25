# Voice Tasks 2

Standalone offline-first Android application, developed separately from the original Voice-Tasks project.

## Status

Development scaffold. No release APK is available yet.

## Requirements

- New Android applicationId, installed alongside the original app.
- Bundle Planner HTML/CSS/JavaScript locally in the APK; no GitHub Pages runtime dependency.
- Preserve JSON export/import compatibility, with imported alarms disabled by default.
- Default missing task dates to today; never invent a missing time.
- Recognize explicit alarm commands without including control words in task text.
- Fully cancel Android scheduled alarms when tasks become completed; never reactivate them automatically on restore.
- Center the edited task after reordering.
- Show weekday, date, and current time in the Now divider.
- Offer text input when speech recognition is unavailable offline.

## Safety

Original repository `Ddmmiittrriiyy/Voice-Tasks` is not to be modified. Keep the existing application installed and data separate. The prior contents of this repository are preserved in branch `backup-before-voice-tasks-2-2026-10-25`.
