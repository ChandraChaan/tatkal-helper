(function () {
  const S = window.TatkalShared;
  const $ = (s, sc) => (sc || document).querySelector(s);
  const $$ = (s, sc) => Array.from((sc || document).querySelectorAll(s));
  const DEFAULT_SETTINGS = { alerts: true, alertMinutes: [10, 2], showWidget: true, fillPayment: true };
  let state = { passengers: [], trips: [], activeTripId: null, settings: { ...DEFAULT_SETTINGS }, checklist: {} };

  async function load() {
    const d = await chrome.storage.local.get(null);
    state.passengers = d.passengers || [];
    state.trips = d.trips || [];
    state.activeTripId = d.activeTripId || (state.trips[0] && state.trips[0].id) || null;
    state.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    state.checklist = d.checklist || {};
  }
  async function save(keys) {
    const out = {};
    for (const k of keys) out[k] = state[k];
    await chrome.storage.local.set(out);
  }
  const activeTrip = () => state.trips.find((t) => t.id === state.activeTripId) || null;
  const pax = (trip) => trip.passengerIds.map((id) => state.passengers.find((p) => p.id === id)).filter(Boolean);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (list, code) => (list.find((x) => x.code === code) || {}).label || code;

  /* ---------- tabs ---------- */
  $$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  }

  /* ---------- option lists ---------- */
  function fillOptions(sel, list) { sel.innerHTML = list.map((o) => `<option value="${esc(o.code)}">${esc(o.label)}</option>`).join(''); }
  fillOptions($('#berth-opts'), S.BERTHS); fillOptions($('#food-opts'), S.FOODS); fillOptions($('#id-opts'), S.ID_TYPES);
  fillOptions($('#class-opts'), S.CLASSES); fillOptions($('#quota-opts'), S.QUOTAS);

  /* ---------- home ---------- */
  function renderHome() {
    const sel = $('#active-trip');
    sel.innerHTML = state.trips.length
      ? state.trips.map((t) => `<option value="${t.id}" ${t.id === state.activeTripId ? 'selected' : ''}>${esc(t.label || t.from + ' → ' + t.to)}</option>`).join('')
      : '<option value="">No trips</option>';
    const t = activeTrip();
    const sum = $('#home-trip-summary');
    if (!t) { sum.className = 'summary muted'; sum.textContent = 'No trip yet. Add one in the Trips tab.'; }
    else {
      const ps = pax(t);
      sum.className = 'summary';
      sum.innerHTML = `<div><strong>${esc(t.from)} → ${esc(t.to)}</strong> · ${esc(label(S.CLASSES, t.cls))} · ${esc(label(S.QUOTAS, t.quota))}${t.train ? ' · Train ' + esc(t.train) : ''}</div>
        <div class="muted small">${t.date ? 'Journey ' + esc(S.toIrctcDate(t.date)) + ' · ' : ''}${ps.length ? ps.map((p) => esc(p.name)).join(', ') : '<span style="color:var(--err)">no passengers selected</span>'}${t.mobile ? ' · ' + esc(t.mobile) : ''}</div>`;
    }
    $$('#checklist input').forEach((i) => { i.checked = !!state.checklist[i.dataset.k]; });
    tick();
  }
  function tick() {
    const t = activeTrip();
    const w = S.nextWindow(t);
    const big = $('#cd-value'), lab = $('#cd-label'), sub = $('#cd-sub');
    big.className = 'cd-big';
    if (w.kind === 'passed') { lab.textContent = 'Tatkal window passed'; big.textContent = '—'; sub.textContent = `It opened ${w.bookingDate} at ${S.pad(w.hour)}:00 IST. Try general quota or another date.`; return; }
    if (w.kind === 'general') { lab.textContent = 'General quota trip'; big.textContent = '—'; sub.textContent = 'No Tatkal race for this trip. Book any time.'; return; }
    const ms = w.at - Date.now();
    lab.textContent = (w.kind === 'journey' ? 'Tatkal window for this trip' : 'Next Tatkal window') + ` · ${S.pad(w.hour)}:00 IST`;
    if (ms <= 0) { big.textContent = 'OPEN NOW'; big.classList.add('open'); sub.textContent = `Opened ${w.bookingDate} ${S.pad(w.hour)}:00 IST. Go!`; }
    else { big.textContent = S.fmtCountdown(ms); if (ms < 5 * 60 * 1000) big.classList.add('soon'); sub.textContent = `${w.bookingDate} at ${S.pad(w.hour)}:00 IST (${t && S.isAcClass(t.cls) ? 'AC classes' : 'non-AC classes'})`; }
  }
  setInterval(tick, 1000);

  $('#active-trip').addEventListener('change', async (e) => { state.activeTripId = e.target.value || null; await save(['activeTripId']); renderAll(); });
  $$('#checklist input').forEach((i) => i.addEventListener('change', async () => { state.checklist[i.dataset.k] = i.checked; await save(['checklist']); }));
  $('#btn-reset-check').addEventListener('click', async () => { state.checklist = {}; await save(['checklist']); renderHome(); });
  $('#btn-open').addEventListener('click', () => chrome.tabs.create({ url: 'https://www.irctc.co.in/nget/train-search' }));

  $('#btn-fill').addEventListener('click', async () => {
    const st = $('#fill-status'); st.className = 'status'; st.textContent = 'Filling…';
    const t = activeTrip();
    if (!t) { st.className = 'status err'; st.textContent = 'Add a trip first.'; return; }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/www\.irctc\.co\.in\//.test(tab.url || '')) { st.className = 'status err'; st.textContent = 'Switch to an IRCTC tab first (train search or passenger page).'; return; }
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'TK_FILL' });
      if (!res || !res.ok) { st.className = 'status err'; st.textContent = (res && res.error) || 'Fill failed.'; return; }
      st.className = res.warnings.length ? 'status warn' : 'status ok';
      st.textContent = `Filled ${res.filled.length} item(s). ` + (res.warnings.length ? 'Check: ' + res.warnings.join(' ') : 'Now review the page, solve the CAPTCHA and pay.');
    } catch (e) {
      st.className = 'status err'; st.textContent = 'Could not reach the page. Reload the IRCTC tab once and try again.';
    }
  });

  /* ---------- passengers ---------- */
  const pForm = $('#passenger-form');
  function renderPassengers() {
    const list = $('#passenger-list');
    if (!state.passengers.length) { list.innerHTML = '<div class="empty">No passengers saved. Add the people you usually travel with.</div>'; return; }
    list.innerHTML = state.passengers.map((p) => `
      <div class="item" data-id="${p.id}">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(p.age)} · ${esc(label([{ code: 'M', label: 'Male' }, { code: 'F', label: 'Female' }, { code: 'T', label: 'Transgender' }], p.gender))}${p.berth ? ' · ' + esc(label(S.BERTHS, p.berth)) : ''}${p.food ? ' · ' + esc(label(S.FOODS, p.food)) : ''}</div>
        <div class="acts"><button class="btn small" data-act="edit">Edit</button><button class="btn small danger" data-act="del">Delete</button></div>
      </div>`).join('');
  }
  $('#passenger-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.closest('.item').dataset.id;
    if (b.dataset.act === 'edit') openPassengerForm(state.passengers.find((p) => p.id === id));
    if (b.dataset.act === 'del') {
      if (!confirm('Delete this passenger?')) return;
      state.passengers = state.passengers.filter((p) => p.id !== id);
      state.trips.forEach((t) => { t.passengerIds = t.passengerIds.filter((x) => x !== id); });
      await save(['passengers', 'trips']); renderAll();
    }
  });
  function openPassengerForm(p) {
    p = p || S.defaultPassenger();
    for (const el of pForm.elements) if (el.name) el.value = p[el.name] ?? '';
    pForm.classList.remove('hidden'); pForm.elements.name.focus();
  }
  $('#btn-add-passenger').addEventListener('click', () => openPassengerForm());
  $('#btn-cancel-passenger').addEventListener('click', () => pForm.classList.add('hidden'));
  pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = pForm.elements;
    const p = { id: f.id.value || S.uid(), name: f.name.value.trim(), age: f.age.value.trim(), gender: f.gender.value, berth: f.berth.value, food: f.food.value, idType: f.idType.value, idNumber: f.idNumber.value.trim() };
    const i = state.passengers.findIndex((x) => x.id === p.id);
    if (i >= 0) state.passengers[i] = p; else state.passengers.push(p);
    await save(['passengers']); pForm.classList.add('hidden'); renderAll();
  });

  /* ---------- trips ---------- */
  const tForm = $('#trip-form');
  function renderTrips() {
    const list = $('#trip-list');
    if (!state.trips.length) { list.innerHTML = '<div class="empty">No trips yet. A trip is a route, class, quota and the passengers travelling.</div>'; return; }
    list.innerHTML = state.trips.map((t) => `
      <div class="item ${t.id === state.activeTripId ? 'active' : ''}" data-id="${t.id}">
        <div class="name">${esc(t.label || t.from + ' → ' + t.to)}</div>
        <div class="meta">${esc(t.from)} → ${esc(t.to)} · ${esc(t.cls)} · ${esc(label(S.QUOTAS, t.quota))}${t.date ? ' · ' + esc(S.toIrctcDate(t.date)) : ''} · ${pax(t).length} pax</div>
        <div class="acts">${t.id === state.activeTripId ? '' : '<button class="btn small" data-act="use">Use</button>'}<button class="btn small" data-act="edit">Edit</button><button class="btn small danger" data-act="del">Delete</button></div>
      </div>`).join('');
  }
  $('#trip-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.closest('.item').dataset.id;
    if (b.dataset.act === 'use') { state.activeTripId = id; await save(['activeTripId']); renderAll(); }
    if (b.dataset.act === 'edit') openTripForm(state.trips.find((t) => t.id === id));
    if (b.dataset.act === 'del') {
      if (!confirm('Delete this trip?')) return;
      state.trips = state.trips.filter((t) => t.id !== id);
      if (state.activeTripId === id) state.activeTripId = state.trips[0] ? state.trips[0].id : null;
      await save(['trips', 'activeTripId']); renderAll();
    }
  });
  function openTripForm(t) {
    t = t || S.defaultTrip();
    for (const el of tForm.elements) {
      if (!el.name || el.name === 'passengerIds') continue;
      if (el.type === 'checkbox') el.checked = !!t[el.name]; else el.value = t[el.name] ?? '';
    }
    const picker = $('#trip-passenger-picker');
    picker.innerHTML = state.passengers.length
      ? state.passengers.map((p) => `<label><input type="checkbox" name="passengerIds" value="${p.id}" ${t.passengerIds.includes(p.id) ? 'checked' : ''}> ${esc(p.name)} <span class="muted">(${esc(p.age)}, ${esc(p.gender)})</span></label>`).join('')
      : '<div class="empty">Add passengers in the Passengers tab first.</div>';
    tForm.classList.remove('hidden'); tForm.elements.label.focus();
  }
  $('#btn-add-trip').addEventListener('click', () => openTripForm());
  $('#btn-cancel-trip').addEventListener('click', () => tForm.classList.add('hidden'));
  tForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = tForm.elements;
    const ids = $$('input[name="passengerIds"]:checked', tForm).map((i) => i.value);
    if (ids.length > 4 && (f.quota.value === 'TQ' || f.quota.value === 'PT')) { alert('Tatkal allows at most 4 passengers per PNR.'); return; }
    const t = { id: f.id.value || S.uid(), label: f.label.value.trim(), from: f.from.value.trim().toUpperCase(), to: f.to.value.trim().toUpperCase(), date: f.date.value, train: f.train.value.trim(),
      cls: f.cls.value, quota: f.quota.value, mobile: f.mobile.value.trim(), passengerIds: ids, autoUpgrade: f.autoUpgrade.checked, confirmOnly: f.confirmOnly.checked, insurance: f.insurance.value, payment: f.payment.value };
    const i = state.trips.findIndex((x) => x.id === t.id);
    if (i >= 0) state.trips[i] = t; else state.trips.push(t);
    if (!state.activeTripId || state.trips.length === 1) state.activeTripId = t.id;
    await save(['trips', 'activeTripId']); tForm.classList.add('hidden'); renderAll();
  });

  /* ---------- settings ---------- */
  function renderSettings() {
    $('#set-alerts').checked = !!state.settings.alerts;
    $('#set-alert-minutes').value = (state.settings.alertMinutes || []).join(', ');
    $('#set-widget').checked = !!state.settings.showWidget;
    $('#set-payment').checked = !!state.settings.fillPayment;
  }
  async function saveSettings() {
    const mins = $('#set-alert-minutes').value.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((n) => n > 0 && n <= 1440);
    state.settings = { alerts: $('#set-alerts').checked, alertMinutes: mins.length ? mins : [10, 2], showWidget: $('#set-widget').checked, fillPayment: $('#set-payment').checked };
    await save(['settings']);
    const st = $('#settings-status'); st.className = 'status ok'; st.textContent = 'Saved.'; setTimeout(() => (st.textContent = ''), 1500);
    if (state.settings.alerts && chrome.notifications && chrome.notifications.getPermissionLevel) {
      chrome.notifications.getPermissionLevel((lvl) => { if (lvl !== 'granted') { st.className = 'status warn'; st.textContent = 'Chrome notifications are off for this extension. Enable them in Chrome settings.'; } });
    }
  }
  ['#set-alerts', '#set-widget', '#set-payment'].forEach((s) => $(s).addEventListener('change', saveSettings));
  $('#set-alert-minutes').addEventListener('change', saveSettings);

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ passengers: state.passengers, trips: state.trips, settings: state.settings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tatkal-helper-backup.json'; a.click();
  });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.passengers) || !Array.isArray(d.trips)) throw new Error('bad');
      state.passengers = d.passengers; state.trips = d.trips; if (d.settings) state.settings = { ...DEFAULT_SETTINGS, ...d.settings };
      state.activeTripId = state.trips[0] ? state.trips[0].id : null;
      await save(['passengers', 'trips', 'settings', 'activeTripId']); renderAll();
      const st = $('#settings-status'); st.className = 'status ok'; st.textContent = `Imported ${d.passengers.length} passengers, ${d.trips.length} trips.`;
    } catch { const st = $('#settings-status'); st.className = 'status err'; st.textContent = 'That file is not a Tatkal Helper backup.'; }
    e.target.value = '';
  });

  function renderAll() { renderHome(); renderPassengers(); renderTrips(); renderSettings(); }
  load().then(() => { renderAll(); if (!state.trips.length && !state.passengers.length) showTab('passengers'); });
})();
