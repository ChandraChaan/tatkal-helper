# Contributing

Thanks for helping. Bug reports from real booking days are the most valuable thing you can send.

## Reporting a fill problem

When a field does not fill on the live IRCTC page, the toast and the popup list exactly which one. Open a
[bug report](https://github.com/ChandraChaan/tatkal-helper/issues/new?template=bug_report.yml) with that text,
the page you were on (search or passenger), and, if you can, right-click the field → Inspect and paste the
element's outer HTML (remove any personal data first). That is usually enough to fix the selector in minutes.

## Running the checks

```bash
python3 -m http.server 8765
# open http://localhost:8765/test/mock-irctc.html#auto
```

All 43 checks must pass before a pull request. If you change a selector, update the mock page in `test/mock-irctc.html`
to match the real IRCTC markup you observed, so the checks keep meaning something.

## What will not be merged

Anything that makes the extension act without a human click: auto-login, auto-submit, CAPTCHA solving or bypass,
payment automation, hammering Book Now, or request-level booking. This is the line that keeps the project legal and
users' IRCTC accounts safe.

## Style

Vanilla JS, no build step, no dependencies. Keep `content/fill-core.js` free of `chrome.*` calls so it stays testable
on the mock page.
