const vscode = require('vscode');
const axios = require('axios');

const capitalize = (s) => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.toLowerCase().slice(1);
};

const until = new Map(),
  timings = new Map();

const CACHE_KEY = 'prayerReminder.cache.v1';
const CACHE_DAYS = 30;
const REFRESH_THRESHOLD_DAYS = 14;
const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
item.tooltip = 'Next prayer';

let k,
  lastDay,
  extensionContext,
  prayerCache,
  isPrayerTime = false,
  updatePromise = null;

const setLoadingText = () => {
  item.text = `\$(watch) Updating prayer times`;
  item.tooltip = 'Updating prayer times';
  item.backgroundColor = null;
};

const getSettings = () => {
  const config = vscode.workspace.getConfiguration('prayerReminder');

  return {
    city: config.get('city'),
    country: config.get('country'),
    method: config.get('method'),
  };
};

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const getStartOfToday = () => {
  const date = new Date();

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const parsePrayerDate = (dateKey, time) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  return new Date(year, month - 1, day, hour, minute);
};

const getCalendar = async (date, settings) => {
  const { city, country, method } = settings;

  const month = date.getMonth() + 1,
    year = date.getFullYear();

  const url = `http://api.aladhan.com/v1/calendarByCity?city=${capitalize(
    city
  )}&country=${capitalize(
    country
  )}&method=${method}&month=${month}&year=${year}`;

  const res = await axios.get(url);

  return res.data.data;
};

const getPrayerTimings = (dayTimings) => {
  const prayers = {};

  for (const prayer of prayerOrder) {
    if (dayTimings[prayer]) {
      prayers[prayer] = dayTimings[prayer].substring(0, 5);
    }
  }

  return prayers;
};

const isCacheForSettings = (cache, settings) =>
  cache &&
  cache.city === settings.city &&
  cache.country === settings.country &&
  cache.method === settings.method &&
  cache.days;

const getFutureCachedDays = (cache, today = getStartOfToday()) => {
  if (!cache || !cache.days) return [];

  const todayKey = getDateKey(today);

  return Object.keys(cache.days)
    .filter((dateKey) => dateKey >= todayKey)
    .sort();
};

const hasUsableCache = (cache, settings) =>
  isCacheForSettings(cache, settings) && getFutureCachedDays(cache).length > 0;

const hasEnoughCache = (cache, settings) =>
  isCacheForSettings(cache, settings) &&
  getFutureCachedDays(cache).length >= REFRESH_THRESHOLD_DAYS;

const loadCacheFromState = () => {
  if (!extensionContext) return;

  prayerCache = extensionContext.globalState.get(CACHE_KEY);
};

const saveCache = async (cache) => {
  prayerCache = cache;

  if (extensionContext) {
    await extensionContext.globalState.update(CACHE_KEY, cache);
  }
};

const buildCache = async (settings, startDate = getStartOfToday()) => {
  const days = {};
  const calendars = new Map();
  const endDate = addDays(startDate, CACHE_DAYS - 1);

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    if (!calendars.has(monthKey)) {
      calendars.set(monthKey, await getCalendar(date, settings));
    }

    const calendar = calendars.get(monthKey);
    const day = calendar[date.getDate() - 1];

    if (day && day.timings) {
      days[getDateKey(date)] = getPrayerTimings(day.timings);
    }
  }

  return {
    city: settings.city,
    country: settings.country,
    method: settings.method,
    updatedAt: new Date().toISOString(),
    days,
  };
};

const ensureCache = async (forceRefresh = false) => {
  const settings = getSettings();
  loadCacheFromState();

  if (!forceRefresh && hasEnoughCache(prayerCache, settings)) {
    return prayerCache;
  }

  try {
    const cache = await buildCache(settings);
    await saveCache(cache);

    return cache;
  } catch (error) {
    if (hasUsableCache(prayerCache, settings)) {
      vscode.window.showWarningMessage(
        'Prayer Reminder: Using saved prayer times because the latest times could not be fetched.'
      );

      return prayerCache;
    }

    throw error;
  }
};

const loadTimingsFromCache = (cache, now = new Date()) => {
  timings.clear();

  if (!cache || !cache.days) return;

  for (const dateKey of getFutureCachedDays(cache)) {
    const dayTimings = cache.days[dateKey];

    for (const prayer of prayerOrder) {
      if (!dayTimings[prayer]) continue;

      const prayerTime = parsePrayerDate(dateKey, dayTimings[prayer]);

      if (prayerTime > now) {
        timings.set(`${dateKey}:${prayer}`, {
          name: prayer,
          dateKey,
          time: dayTimings[prayer],
          date: prayerTime,
        });
      }
    }
  }
};

const updateCountdowns = (now = new Date()) => {
  until.clear();

  for (const [key, prayer] of timings) {
    const timeLeft = prayer.date - now;

    if (timeLeft > 0) {
      until.set(key, timeLeft);
    } else {
      timings.delete(key);
    }
  }
};

const showFetchError = () => {
  vscode.window
    .showErrorMessage(
      'Prayer Reminder: Error fetching prayer times, please check your settings and then reload the window',
      'Open Settings'
    )
    .then((selection) => {
      if (selection === 'Open Settings')
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'prayerReminder'
        );
    });
};

const updateTooltip = (nextPrayerName, hours, minutes) => {
  const todayKey = getDateKey(new Date());
  const todayTimings = prayerCache && prayerCache.days && prayerCache.days[todayKey];
  const tooltip = new vscode.MarkdownString();

  tooltip.appendMarkdown("**Today's Prayer Times**\n\n");

  if (todayTimings) {
    for (const prayer of prayerOrder) {
      if (todayTimings[prayer]) {
        tooltip.appendMarkdown(`- **${prayer}**: ${todayTimings[prayer]}\n`);
      }
    }
  } else {
    tooltip.appendMarkdown('Prayer times are not loaded for today.\n');
  }

  if (nextPrayerName) {
    tooltip.appendMarkdown(`\nNext: **${nextPrayerName}** in ${hours}h ${minutes}m`);
  }

  item.tooltip = tooltip;
};

const updateMaps = async (forceRefresh = false) => {
  if (updatePromise) return updatePromise;

  updatePromise = (async () => {
    until.clear();
    timings.clear();

    const date = new Date();
    lastDay = date.getDate();

    try {
      const cache = await ensureCache(forceRefresh);
      loadTimingsFromCache(cache, date);
      updateCountdowns(date);

      return true;
    } catch (error) {
      showFetchError();

      return false;
    } finally {
      updatePromise = null;
    }
  })();

  return updatePromise;
};

const updateText = async () => {
  // Check if the day has changed
  const date = new Date();
  const day = date.getDate();

  if (day !== lastDay || timings.size === 0) {
    await updateMaps();
  } else {
    updateCountdowns(date);
  }

  if (until.size === 0) {
    await updateMaps();
  }

  if (until.size === 0) {
    setLoadingText();
    return;
  }

  // get the next prayer's name
  k = until.keys().next().value;
  const nextPrayer = timings.get(k);
  const nextPrayerName = nextPrayer.name;

  // convert the time left to hours:minutes
  const timeLeft = until.get(k);
  const hours = Math.floor(timeLeft / 1000 / 60 / 60);
  const minutes = Math.floor((timeLeft / 1000 / 60 / 60 - hours) * 60);

  // Showing popup on prayer time
  if (hours === 0 && minutes === 0) {
    if (!isPrayerTime) {
      // Store some state so this shows only once and then resets
      isPrayerTime = true;

      item.text = `\$(watch) ${nextPrayerName} Adhan now`;
      updateTooltip(nextPrayerName, hours, minutes);
      vscode.window.showInformationMessage(`It's time for ${nextPrayerName} prayer`);
      if (nextPrayerName === 'Asr')
        vscode.window.showInformationMessage(
          `حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلاةِ الْوُسْطَى`
        );
      if (nextPrayerName === 'Fajr')
        vscode.window.showInformationMessage(
          `رَكْعَتا الفَجْرِ خيرٌ منَ الدُّنيا وما فيها`
        );

      // We want to preserve the item text at least for this minute
      return;
    }
  } else {
    if (isPrayerTime) {
      // Reset after 1m of showing that it's prayer time
      isPrayerTime = false;
    }

    // set the text
    item.text = `\$(watch) ${nextPrayerName} in ${hours}h ${minutes}m`;
    updateTooltip(nextPrayerName, hours, minutes);

    // Changing background color
    if (hours === 0 && minutes <= 10 && minutes > 5) {
      item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else if (hours === 0 && minutes <= 5) {
      item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    } else {
      item.backgroundColor = null;
    }

    isPrayerTime = false;
  }
};

async function activate(context) {
  extensionContext = context;

  updateMaps().then(() => {
    updateText();
  });

  item.show();

  // update the status bar item every minute
  const interval = setInterval(() => {
    updateText();
  }, 60000);

  const refresh = vscode.commands.registerCommand(
    'prayerReminder.refresh',
    async () => {
      const updated = await updateMaps(true);
      await updateText();

      if (updated) {
        vscode.window.showInformationMessage('Prayer Reminder: Refreshed');
      }
    }
  );

  context.subscriptions.push(refresh, {
    dispose: () => clearInterval(interval),
  });
}

function deactivate() {
  vscode.window.showInformationMessage('لا خير في عملٍ يلهي عن الصلاة');
  vscode.window.showInformationMessage('Prayer Reminder: Deactivated');
  item.dispose();
}

module.exports = {
  activate,
  deactivate,
};
