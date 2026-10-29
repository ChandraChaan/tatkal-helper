/* Content script: floating widget on irctc.co.in + message handling. */
(function () {
  const S = window.TatkalShared, F = window.TatkalFill;
  let state = { passengers: [], trips: [], activeTripId: null, settings: { fillPayment: true, showWidget: true } };
  let widget, tickTimer;

  function activeTrip() { return state.trips.find((t) => t.id === state.activeTripId) || state.trips[0] || null; }
  function tripPassengers(trip) { return trip ? trip.passengerIds.map((id) => state.passengers.find((p) => p.id === id)).filter(Boolean) : []; }

  async function load() {
    const data = await chrome.storage.local.get(['passengers', 'trips', 'activeTripId', 'settings']);
    state.passengers = data.passengers || [];
    state.trips = data.trips || [];
    state.activeTripId = data.activeTripId || null;
    state.settings = Object.assign({ fillPayment: true, showWidget: true }, data.settings || {});
  }

  function toast(msg, kind) {
    let t = document.getElementById('tk-toast');
    if (!t) { t = document.createElement('div'); t.id = 'tk-toast'; document.documentElement.appendChild(t); }
    t.textContent = msg; t.className = 'tk-toast tk-' + (kind || 'info') + ' tk-show';
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('tk-show'), 6000);
  }

  async function fillNow() {
    const trip = activeTrip();
    if (!trip) { toast('No trip saved. Open Tatkal Helper and add a trip first.', 'warn'); return { ok: false, error: 'No trip' }; }
    const page = F.detectPage();
    let res;
    if (page === 'passenger') res = await F.fillPassengerPage(trip, tripPassengers(trip), { fillPayment: state.settings.fillPayment });
    else if (page === 'search') res = await F.fillSearchPage(trip);
    else return (toast('Open the train search or passenger details page first.', 'warn'), { ok: false, error: 'Unsupported page' });
    if (!res.ok) toast(res.error || 'Fill failed', 'error');
    else if (res.warnings.length) toast(`Filled ${res.filled.length} item(s). Check: ${res.warnings.join(' ')}`, 'warn');
    else toast(page === 'passenger' ? `Filled ${res.filled.length} passenger(s). Now review, solve the CAPTCHA and pay.` : 'Search form filled. Press Search.', 'ok');
    return res;
  }

  function render() {
    if (!state.settings.showWidget) { if (widget) widget.remove(); widget = null; return; }
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'tk-widget';
      widget.innerHTML = `
        <div class="tk-head"><span class="tk-logo">T</span><span class="tk-title">Tatkal Helper</span><button class="tk-x" title="Hide for this page">×</button></div>
        <div class="tk-body">
          <div class="tk-trip"></div>
          <div class="tk-count"><span class="tk-count-label"></span><span class="tk-count-val"></span></div>
          <button class="tk-fill">Fill this page <kbd>Alt+Shift+F</kbd></button>
        </div>`;
      document.documentElement.appendChild(widget);
      widget.querySelector('.tk-x').addEventListener('click', () => { widget.style.display = 'none'; });
      widget.querySelector('.tk-fill').addEventListener('click', fillNow);
    }
    const trip = activeTrip();
    widget.querySelector('.tk-trip').textContent = trip
      ? `${trip.label || (trip.from + ' → ' + trip.to)} · ${trip.cls} · ${trip.quota} · ${tripPassengers(trip).length} pax`
      : 'No trip saved yet';
    tick();
  }

  function tick() {
    if (!widget) return;
    const trip = activeTrip();
    const w = S.nextWindow(trip);
    const lab = widget.querySelector('.tk-count-label'), val = widget.querySelector('.tk-count-val');
    if (w.kind === 'passed') { lab.textContent = 'Tatkal window passed'; val.textContent = w.bookingDate; }
    else if (w.kind === 'general') { lab.textContent = 'General quota'; val.textContent = 'no window'; }
    else {
      const ms = w.at - Date.now();
      lab.textContent = ms > 0 ? `Window ${S.pad(w.hour)}:00 IST ${w.kind === 'journey' ? w.bookingDate : ''}` : 'Window is OPEN';
      val.textContent = ms > 0 ? S.fmtCountdown(ms) : 'GO';
      widget.classList.toggle('tk-open', ms <= 0);
      widget.classList.toggle('tk-soon', ms > 0 && ms < 5 * 60 * 1000);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'TK_FILL') { load().then(fillNow).then(sendResponse); return true; }
    if (msg && msg.type === 'TK_PAGE') { sendResponse({ page: F.detectPage() }); return false; }
    return false;
  });
  chrome.storage.onChanged.addListener(() => load().then(render));

  load().then(() => {
    render();
    tickTimer = setInterval(() => { tick(); }, 1000);
    // IRCTC is a single-page app: re-render when the route changes.
    let last = location.href;
    setInterval(() => { if (location.href !== last) { last = location.href; render(); } }, 800);
  });
})();
