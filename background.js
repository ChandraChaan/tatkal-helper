/* Service worker: Tatkal window alarms, notifications, badge countdown, keyboard shortcut. */
importScripts('shared/tatkal.js');
const S = self.TatkalShared;
const DEFAULT_SETTINGS = { alerts: true, alertMinutes: [10, 2], showWidget: true, fillPayment: true };

async function getState() {
  const d = await chrome.storage.local.get(['trips', 'activeTripId', 'settings']);
  const trips = d.trips || [];
  const trip = trips.find((t) => t.id === d.activeTripId) || trips[0] || null;
  return { trip, settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) } };
}

async function schedule() {
  const { trip, settings } = await getState();
  const all = await chrome.alarms.getAll();
  await Promise.all(all.filter((a) => a.name.startsWith('tk-alert-')).map((a) => chrome.alarms.clear(a.name)));
  chrome.alarms.create('tk-badge', { periodInMinutes: 1 });
  if (!trip || !settings.alerts) { updateBadge(); return; }
  const w = S.nextWindow(trip);
  if (!w.at) { updateBadge(); return; }
  for (const m of settings.alertMinutes) {
    const when = w.at - m * 60 * 1000;
    if (when > Date.now()) chrome.alarms.create(`tk-alert-${m}`, { when });
  }
  if (w.at > Date.now()) chrome.alarms.create('tk-alert-0', { when: w.at });
  updateBadge();
}

async function updateBadge() {
  const { trip } = await getState();
  const w = trip ? S.nextWindow(trip) : null;
  if (!w || !w.at) { chrome.action.setBadgeText({ text: '' }); return; }
  const mins = Math.ceil((w.at - Date.now()) / 60000);
  if (mins <= 0 && mins > -30) { chrome.action.setBadgeText({ text: 'GO' }); chrome.action.setBadgeBackgroundColor({ color: '#15803d' }); }
  else if (mins > 0 && mins <= 60) { chrome.action.setBadgeText({ text: `${mins}m` }); chrome.action.setBadgeBackgroundColor({ color: mins <= 5 ? '#b45309' : '#0e7490' }); }
  else chrome.action.setBadgeText({ text: '' });
}

function notify(id, title, message) {
  chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority: 2, requireInteraction: true });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tk-badge') { updateBadge(); return; }
  if (!alarm.name.startsWith('tk-alert-')) return;
  const { trip } = await getState();
  if (!trip) return;
  const m = parseInt(alarm.name.replace('tk-alert-', ''), 10);
  const route = `${trip.from} → ${trip.to} (${trip.cls})`;
  if (m === 0) notify('tk-open', 'Tatkal window is OPEN', `${route}. Go to the train list and press Book Now.`);
  else notify(`tk-${m}`, `Tatkal opens in ${m} min`, `${route}. Be logged in, on the train list, UPI ready.`);
});

chrome.notifications.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: 'https://www.irctc.co.in/*' });
  if (tabs.length) { chrome.tabs.update(tabs[0].id, { active: true }); chrome.windows.update(tabs[0].windowId, { focused: true }); }
  else chrome.tabs.create({ url: 'https://www.irctc.co.in/nget/train-search' });
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'fill-now') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && /^https:\/\/www\.irctc\.co\.in\//.test(tab.url || '')) chrome.tabs.sendMessage(tab.id, { type: 'TK_FILL' }).catch(() => {});
});

chrome.storage.onChanged.addListener((changes) => { if (changes.trips || changes.activeTripId || changes.settings) schedule(); });
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
schedule();
