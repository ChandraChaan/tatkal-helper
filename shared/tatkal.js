/* Shared helpers: loaded as a plain script in popup, content script and service worker.
   Exposes window/self.TatkalShared. No chrome.* calls here. */
(function (root) {
  const AC_CLASSES = ['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'EV', 'VC'];
  const CLASSES = [
    { code: '1A', label: 'AC First Class (1A)' },
    { code: '2A', label: 'AC 2 Tier (2A)' },
    { code: '3A', label: 'AC 3 Tier (3A)' },
    { code: '3E', label: 'AC 3 Economy (3E)' },
    { code: 'CC', label: 'AC Chair Car (CC)' },
    { code: 'EC', label: 'Exec. Chair Car (EC)' },
    { code: 'EA', label: 'Anubhuti Class (EA)' },
    { code: 'SL', label: 'Sleeper (SL)' },
    { code: '2S', label: 'Second Sitting (2S)' },
    { code: 'FC', label: 'First Class (FC)' }
  ];
  const QUOTAS = [
    { code: 'TQ', label: 'Tatkal' },
    { code: 'PT', label: 'Premium Tatkal' },
    { code: 'GN', label: 'General' },
    { code: 'LD', label: 'Ladies' },
    { code: 'SS', label: 'Senior Citizen' }
  ];
  const BERTHS = [
    { code: '', label: 'No preference' },
    { code: 'LB', label: 'Lower' },
    { code: 'MB', label: 'Middle' },
    { code: 'UB', label: 'Upper' },
    { code: 'SL', label: 'Side Lower' },
    { code: 'SU', label: 'Side Upper' },
    { code: 'WS', label: 'Window Side' },
    { code: 'CB', label: 'Cabin' },
    { code: 'CP', label: 'Coupe' }
  ];
  const FOODS = [
    { code: '', label: 'Not set' },
    { code: 'V', label: 'Veg' },
    { code: 'N', label: 'Non-veg' },
    { code: 'J', label: 'Jain' },
    { code: 'D', label: 'No food' }
  ];
  const ID_TYPES = [
    { code: '', label: 'None' },
    { code: 'AADHAAR', label: 'Aadhaar' },
    { code: 'PAN', label: 'PAN card' },
    { code: 'DRIVING_LICENSE', label: 'Driving licence' },
    { code: 'PASSPORT', label: 'Passport' },
    { code: 'VOTER_ID', label: 'Voter ID' },
    { code: 'STUDENT_ID', label: 'Student ID' }
  ];

  function isAcClass(cls) { return AC_CLASSES.includes(String(cls || '').toUpperCase()); }
  function windowHour(cls) { return isAcClass(cls) ? 10 : 11; }

  /** A Date whose *local* fields equal the current IST wall clock. */
  function istWallNow(now) {
    const d = now ? new Date(now) : new Date();
    return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  }
  /** Epoch ms for an IST wall-clock moment (y, m0, d, h, min). */
  function istEpoch(y, m0, d, h, min, now) {
    const realNow = now ? new Date(now) : new Date();
    const wall = istWallNow(realNow);
    const skew = realNow.getTime() - wall.getTime(); // local-vs-IST offset difference
    const t = new Date(wall); t.setFullYear(y, m0, d); t.setHours(h, min, 0, 0);
    return t.getTime() + skew;
  }
  function parseISODate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { y: +m[1], m0: +m[2] - 1, d: +m[3] } : null;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtISTDate(epoch) {
    const w = istWallNow(epoch);
    return `${pad(w.getDate())}/${pad(w.getMonth() + 1)}/${w.getFullYear()}`;
  }
  function toIrctcDate(iso) { const p = parseISODate(iso); return p ? `${pad(p.d)}/${pad(p.m0 + 1)}/${p.y}` : ''; }

  /**
   * Next Tatkal window for a trip.
   * Returns { at: epochMs|null, hour, kind:'next'|'journey'|'passed', bookingDate:'dd/mm/yyyy' }
   */
  function nextWindow(trip, now) {
    const realNow = now ? new Date(now).getTime() : Date.now();
    const hour = windowHour(trip && trip.cls);
    const isTatkal = !trip || !trip.quota || trip.quota === 'TQ' || trip.quota === 'PT';
    const p = trip && parseISODate(trip.date);
    if (p && isTatkal) {
      // Tatkal opens one day before the journey date (journey date excluded).
      const at = istEpoch(p.y, p.m0, p.d - 1, hour, 0, realNow);
      if (at + 30 * 60 * 1000 >= realNow) return { at, hour, kind: 'journey', bookingDate: fmtISTDate(at) };
      return { at: null, hour, kind: 'passed', bookingDate: fmtISTDate(at) };
    }
    if (p && !isTatkal) {
      // General quota: nothing to race; just report the journey date.
      return { at: null, hour, kind: 'general', bookingDate: toIrctcDate(trip.date) };
    }
    const w = istWallNow(realNow);
    let at = istEpoch(w.getFullYear(), w.getMonth(), w.getDate(), hour, 0, realNow);
    if (at < realNow - 30 * 60 * 1000) at = istEpoch(w.getFullYear(), w.getMonth(), w.getDate() + 1, hour, 0, realNow);
    return { at, hour, kind: 'next', bookingDate: fmtISTDate(at) };
  }

  function fmtCountdown(ms) {
    if (ms == null) return '--:--:--';
    const neg = ms < 0; ms = Math.abs(ms);
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const days = Math.floor(h / 24);
    const core = days > 0 ? `${days}d ${pad(h % 24)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
    return (neg ? '-' : '') + core;
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  function defaultTrip() {
    return { id: uid(), label: '', from: '', to: '', date: '', cls: '3A', quota: 'TQ', train: '',
      passengerIds: [], mobile: '', autoUpgrade: true, confirmOnly: false, insurance: 'no', payment: 'upi' };
  }
  function defaultPassenger() {
    return { id: uid(), name: '', age: '', gender: 'M', berth: '', food: '', idType: '', idNumber: '' };
  }

  root.TatkalShared = { AC_CLASSES, CLASSES, QUOTAS, BERTHS, FOODS, ID_TYPES, isAcClass, windowHour,
    istWallNow, istEpoch, nextWindow, fmtCountdown, fmtISTDate, toIrctcDate, parseISODate, uid,
    defaultTrip, defaultPassenger, pad };
})(typeof self !== 'undefined' ? self : window);
