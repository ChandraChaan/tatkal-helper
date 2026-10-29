/* Pure DOM fill logic for IRCTC pages. No chrome.* usage so it can be unit-tested on a mock page.
   Exposes window.TatkalFill = { fillPassengerPage, fillSearchPage, detectPage } */
(function (root) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!el && el.offsetParent !== null;
  const q = (sel, scope) => (scope || document).querySelector(sel);
  const qa = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

  async function waitFor(fn, timeout = 2500, step = 60) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  function fire(el, type, init) {
    el.dispatchEvent(new Event(type, Object.assign({ bubbles: true, cancelable: true }, init || {})));
  }

  /** Set a text input in a way Angular reactive forms notice. */
  function setInput(el, value) {
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    el.focus();
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    fire(el, 'input');
    fire(el, 'change');
    fire(el, 'keyup');
    return true;
  }

  function blur(el) { if (el) { fire(el, 'blur'); el.blur && el.blur(); } }

  /** Set a native <select> by option value, else by option label match. */
  function setSelect(sel, value, labelRegex) {
    if (!sel) return false;
    const opts = Array.from(sel.options);
    let opt = value !== undefined && value !== null && value !== ''
      ? opts.find((o) => o.value === value || o.value.endsWith(': ' + value) || o.value.replace(/^\d+:\s*/, '') === value)
      : null;
    if (!opt && labelRegex) opt = opts.find((o) => labelRegex.test(o.textContent.trim()));
    if (!opt && (value === '' || value == null)) opt = opts[0];
    if (!opt) return false;
    sel.focus();
    sel.value = opt.value;
    opt.selected = true;
    fire(sel, 'input');
    fire(sel, 'change');
    blur(sel);
    return true;
  }

  function textOf(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function findByText(selectors, regex, scope) {
    return qa(selectors, scope).find((el) => visible(el) && regex.test(textOf(el)));
  }

  /* ---------- PrimeNG checkbox / radio ---------- */
  function primeCheckboxState(container) {
    const input = q('input[type="checkbox"]', container);
    if (input) return input.checked;
    const box = q('.ui-chkbox-box, .p-checkbox-box', container);
    return !!box && /ui-state-active|p-highlight/.test(box.className);
  }
  function setPrimeCheckbox(container, desired) {
    if (!container) return false;
    const cur = primeCheckboxState(container);
    if (cur === desired) return true;
    const box = q('.ui-chkbox-box, .p-checkbox-box', container) || q('input[type="checkbox"]', container) || container;
    box.click();
    return true;
  }
  function findCheckbox(formControl, labelRegex) {
    let c = formControl && q(`p-checkbox[formcontrolname="${formControl}"]`);
    if (c) return c;
    if (!labelRegex) return null;
    const lab = findByText('label, span, div', labelRegex);
    if (!lab) return null;
    const near = lab.closest('p-checkbox') || q('p-checkbox', lab.parentElement) || q('p-checkbox', lab.closest('div') || lab.parentElement);
    if (near) return near;
    const inp = q('input[type="checkbox"]', lab.parentElement || lab);
    return inp ? inp.closest('div') || inp.parentElement : null;
  }
  function clickRadioByLabel(labelRegex, scope) {
    const radios = qa('p-radiobutton, .ui-radiobutton, .p-radiobutton, input[type="radio"]', scope);
    for (const r of radios) {
      const holder = r.tagName === 'P-RADIOBUTTON' ? r : (r.closest('p-radiobutton') || r.parentElement);
      const label = holder && (q('label', holder) || holder);
      if (label && labelRegex.test(textOf(label))) {
        const box = q('.ui-radiobutton-box, .p-radiobutton-box', holder) || q('input[type="radio"]', holder) || label;
        box.click();
        return true;
      }
    }
    const lab = findByText('label', labelRegex, scope);
    if (lab) { lab.click(); return true; }
    return false;
  }

  /* ---------- Passenger page ---------- */
  const SEL = {
    name: 'input[formcontrolname="passengerName"], p-autocomplete[formcontrolname="passengerName"] input, input[placeholder*="Name" i]',
    age: 'input[formcontrolname="passengerAge"], input[placeholder*="Age" i]',
    gender: 'select[formcontrolname="passengerGender"]',
    berth: 'select[formcontrolname="passengerBerthChoice"]',
    food: 'select[formcontrolname="passengerFoodChoice"]',
    idType: 'select[formcontrolname="passengerCardType"]',
    idNumber: 'input[formcontrolname="passengerCardNumber"]',
    mobile: 'input[formcontrolname="mobileNumber"], #mobileNumber, input[placeholder*="Mobile" i]'
  };

  function passengerRows() {
    const apps = qa('app-passenger').filter((r) => q(SEL.name, r));
    if (apps.length) return apps;
    return qa(SEL.name).map((inp) => inp.closest('app-passenger, .passenger-row, [class*="passenger" i], tr') || inp.parentElement.parentElement)
      .filter((v, i, a) => v && a.indexOf(v) === i);
  }
  function addPassengerLink() {
    return findByText('a, button, span, div, label', /^\+?\s*add\s*passenger/i);
  }

  async function ensureRows(n, warnings) {
    let rows = passengerRows();
    let guard = 0;
    while (rows.length < n && guard++ < 6) {
      const link = addPassengerLink();
      if (!link) { warnings.push(`Could not find "+ Add Passenger" link; filled ${rows.length} of ${n}.`); break; }
      const before = rows.length;
      link.click();
      await waitFor(() => passengerRows().length > before, 1500);
      rows = passengerRows();
      if (rows.length === before) { warnings.push('"+ Add Passenger" did not add a row (limit reached?).'); break; }
    }
    return rows;
  }

  function genderRegex(code) { return { M: /^male/i, F: /^female/i, T: /^trans/i }[code] || null; }
  function berthRegex(code) {
    return { LB: /^lower/i, MB: /^middle/i, UB: /^upper/i, SL: /side lower/i, SU: /side upper/i, WS: /window/i, CB: /cabin/i, CP: /coupe/i }[code] || null;
  }
  function foodRegex(code) { return { V: /^veg/i, N: /non.?veg/i, J: /jain/i, D: /no food/i }[code] || null; }
  function idRegex(code) {
    return { AADHAAR: /aadhaar|aadhar|uid/i, PAN: /pan/i, DRIVING_LICENSE: /driving/i, PASSPORT: /passport/i, VOTER_ID: /voter/i, STUDENT_ID: /student/i }[code] || null;
  }

  async function fillPassengerPage(trip, passengers, opts) {
    opts = opts || {};
    const filled = [], warnings = [];
    const list = (passengers || []).filter((p) => p && p.name);
    if (!list.length) return { ok: false, error: 'No passengers selected for this trip.', filled, warnings };
    if (!passengerRows().length) return { ok: false, error: 'This does not look like the IRCTC passenger page.', filled, warnings };

    const rows = await ensureRows(list.length, warnings);
    for (let i = 0; i < Math.min(rows.length, list.length); i++) {
      const row = rows[i], p = list[i];
      const nameEl = q(SEL.name, row);
      if (nameEl) { setInput(nameEl, p.name); await sleep(40); blur(nameEl); }
      else warnings.push(`Row ${i + 1}: name field not found.`);
      const ageEl = q(SEL.age, row);
      if (ageEl) { setInput(ageEl, String(p.age || '')); blur(ageEl); }
      const g = q(SEL.gender, row);
      if (g && !setSelect(g, p.gender, genderRegex(p.gender))) warnings.push(`Row ${i + 1}: gender not set.`);
      const b = q(SEL.berth, row);
      if (b) {
        if (p.berth) { if (!setSelect(b, p.berth, berthRegex(p.berth))) warnings.push(`Row ${i + 1}: berth "${p.berth}" not available.`); }
      }
      const f = q(SEL.food, row);
      if (f && p.food) { if (!setSelect(f, p.food, foodRegex(p.food))) warnings.push(`Row ${i + 1}: food choice not set.`); }
      const it = q(SEL.idType, row);
      if (it && p.idType) {
        setSelect(it, p.idType, idRegex(p.idType));
        await sleep(60);
        const inum = q(SEL.idNumber, row);
        if (inum && p.idNumber) { setInput(inum, p.idNumber); blur(inum); }
      }
      filled.push(p.name);
    }
    if (rows.length > list.length) warnings.push(`${rows.length - list.length} extra passenger row(s) left blank; remove them before continuing.`);

    // Contact and preferences (outside rows)
    if (trip && trip.mobile) {
      const m = q(SEL.mobile);
      if (m) { setInput(m, trip.mobile); blur(m); } else warnings.push('Mobile number field not found.');
    }
    if (trip) {
      const au = findCheckbox('autoUpgradationSelected', /auto\s*upgrad/i);
      if (au) setPrimeCheckbox(au, !!trip.autoUpgrade);
      const cb = findCheckbox('confirmberths', /only if confirm/i);
      if (cb) setPrimeCheckbox(cb, !!trip.confirmOnly);
      if (trip.insurance === 'yes' || trip.insurance === 'no') {
        const insScope = (findByText('div, span, label, strong', /travel insurance/i) || document.body).closest('div') || document.body;
        const ok = clickRadioByLabel(trip.insurance === 'yes' ? /^yes/i : /^no/i, insScope) || clickRadioByLabel(trip.insurance === 'yes' ? /^yes/i : /^no/i);
        if (!ok) warnings.push('Travel insurance option not found (may not apply to this train).');
      }
      if (opts.fillPayment !== false && trip.payment) {
        const pay = trip.payment === 'upi' ? /bhim|upi/i : /credit|debit|card|net\s*banking/i;
        if (!clickRadioByLabel(pay)) warnings.push('Payment mode option not found on this page.');
      }
    }
    return { ok: true, filled, warnings };
  }

  /* ---------- Train search page ---------- */
  async function pickAutocomplete(inputSel, text, warnings, label) {
    const input = q(inputSel);
    if (!input) { warnings.push(`${label} field not found.`); return false; }
    setInput(input, text);
    const item = await waitFor(() => {
      const panel = qa('.ui-autocomplete-panel, .p-autocomplete-panel').find(visible);
      return panel && q('li', panel);
    }, 2500);
    if (item) { item.click(); }
    else {
      // Fall back to Enter, which PrimeNG uses to pick the highlighted suggestion
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      warnings.push(`${label}: no suggestion list appeared, typed "${text}" and pressed Enter. Check it.`);
    }
    blur(input);
    return true;
  }

  async function pickDropdown(hostSel, regex, warnings, label) {
    const host = q(hostSel);
    if (!host) { warnings.push(`${label} dropdown not found.`); return false; }
    // Native select fallback
    const native = host.tagName === 'SELECT' ? host : q('select', host);
    if (native && !q('.ui-dropdown, .p-dropdown', host)) return setSelect(native, undefined, regex) || (warnings.push(`${label}: option not found.`), false);
    const trigger = q('.ui-dropdown-trigger, .p-dropdown-trigger, .ui-dropdown-label, .p-dropdown-label, .ui-dropdown, .p-dropdown', host) || host;
    trigger.click();
    const item = await waitFor(() => {
      const panels = qa('.ui-dropdown-panel, .p-dropdown-panel').filter(visible);
      for (const p of panels) {
        const li = qa('li', p).find((l) => regex.test(textOf(l)));
        if (li) return li;
      }
      return null;
    }, 2000);
    if (!item) { warnings.push(`${label}: option not found in list.`); document.body.click(); return false; }
    item.click();
    return true;
  }

  function classRegex(code) { return new RegExp('\\(' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)', 'i'); }
  function quotaRegex(code) { return { TQ: /^tatkal/i, PT: /premium\s*tatkal/i, GN: /^general/i, LD: /ladies/i, SS: /senior/i }[code] || /^general/i; }

  async function fillSearchPage(trip) {
    const warnings = [], filled = [];
    if (!trip) return { ok: false, error: 'No active trip.', filled, warnings };
    const originSel = '#origin input, p-autocomplete#origin input, input#origin, input[placeholder*="From" i]';
    const destSel = '#destination input, p-autocomplete#destination input, input#destination, input[placeholder*="To" i]';
    if (!q(originSel) && !q(destSel)) return { ok: false, error: 'This does not look like the IRCTC train search page.', filled, warnings };
    if (trip.from) { if (await pickAutocomplete(originSel, trip.from, warnings, 'From')) filled.push('from'); await sleep(150); }
    if (trip.to) { if (await pickAutocomplete(destSel, trip.to, warnings, 'To')) filled.push('to'); await sleep(150); }
    if (trip.date) {
      const dateInput = q('p-calendar#jDate input, #jDate input, input#jDate, p-calendar input');
      if (dateInput) { setInput(dateInput, root.TatkalShared ? root.TatkalShared.toIrctcDate(trip.date) : trip.date); blur(dateInput); filled.push('date'); }
      else warnings.push('Date field not found.');
    }
    if (trip.cls) { if (await pickDropdown('#journeyClass, p-dropdown#journeyClass, p-dropdown[formcontrolname="journeyClass"]', classRegex(trip.cls), warnings, 'Class')) filled.push('class'); await sleep(120); }
    if (trip.quota) { if (await pickDropdown('#journeyQuota, p-dropdown#journeyQuota, p-dropdown[formcontrolname="journeyQuota"]', quotaRegex(trip.quota), warnings, 'Quota')) filled.push('quota'); }
    return { ok: true, filled, warnings };
  }

  function detectPage() {
    const path = location.pathname + location.hash;
    if (passengerRows().length) return 'passenger';
    if (q('#origin, #destination, input[placeholder*="From" i]')) return 'search';
    if (/psgninput/i.test(path)) return 'passenger';
    if (/train-search/i.test(path)) return 'search';
    if (/train-list/i.test(path)) return 'trainlist';
    if (/reviewBooking|review/i.test(path)) return 'review';
    return 'other';
  }

  root.TatkalFill = { fillPassengerPage, fillSearchPage, detectPage, _internals: { setInput, setSelect, passengerRows } };
})(window);
