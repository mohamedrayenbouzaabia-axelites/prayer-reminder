# Prayer Reminder

Prayer Reminder helps you keep track of the next prayer directly from the VS Code status bar.

The extension shows the remaining time until the upcoming prayer, reminds you when it is time for Adhan, and keeps prayer times available even after restarting VS Code.

![Screenshot-01](https://i.imgur.com/uvnkdlf.png)

## Features

- Shows the next prayer and remaining time in the status bar.
- Shows today's full prayer schedule when you hover over the status bar item.
- Saves prayer times locally, so VS Code does not need to call the API every time it opens.
- Loads a rolling 30 days of prayer times when an internet connection is available.
- Refreshes the saved prayer times when fewer than 14 future days remain.
- Falls back to saved prayer times if the API cannot be reached.
- Handles the end of the day by moving to tomorrow's Fajr instead of showing `undefined` or `NaN`.

![Screenshot-02](/image.png)

## Extension Settings

- `prayerReminder.city`: City name, for example `Cairo`.
- `prayerReminder.country`: Country name, for example `Egypt`.
- `prayerReminder.method`: Prayer time calculation method. See [Aladhan calculation methods](https://aladhan.com/calculation-methods).

## Commands

- `Prayer Reminder: Refresh`: Forces the extension to fetch and save fresh prayer times.

## Release Notes

## 1.0.5

- Added saved prayer-time cache across VS Code restarts.
- Added rolling 30-day prayer time loading.
- Added hover tooltip with today's prayer schedule.
- Fixed stale countdowns after VS Code stays open for a long time.
- Fixed next-prayer display after the last prayer of the day.

## 1.0.4

- Introduced stability fixes.

## 1.0.3

- Fixed wrong timings after prayers.

## 1.0.2

- Fixed end-of-day `NaN` issue.

## 1.0.1

- Fixed after-Isha issue.
- Added `Refresh` command to force refresh timings.

## 1.0.0

- Initial release.

## Developed By


- [Omar AbdulRahman](https://omar45.com/)
- [Mohamed Eldeeb](https://github.com/mosamadeeb)
- [Mohamed Rayen Bouzaabia](https://www.linkedin.com/in/medrayenbouzaabia)

## Support

For bugs or issues, please contact contact@omar45.com.