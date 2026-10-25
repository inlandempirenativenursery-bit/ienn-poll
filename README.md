# IENN poll

Standalone, anonymous 3-question poll for Inland Empire Native Nursery, used in person via a QR code. It isn't linked from the shop website and is set to `noindex`.

- `index.html`, `poll.css`, `poll.js`: plain static files with no build step, no web fonts, and no analytics or trackers.
- `ENDPOINT_URL` at the top of `poll.js` is a **placeholder** until the Apps Script web-app `/exec` URL is ready. Until then, answers stay queued on the phone (localStorage) and are sent on a later visit once the URL is set.
- The browser POSTs a `text/plain` JSON body, which avoids a CORS preflight:
  `{"response_id":"<uuid>","q1":1-5,"q2":1-5,"q3":1-5,"src":"jerky-promo"}`
- `response_id` is a random `crypto.randomUUID()` kept in localStorage, so a re-take on the same phone sends the same ID. The endpoint should **upsert by response_id** so the newer answer replaces the older one.
- `src` comes from `?src=` (lowercase letters, digits, `-` and `_`, max 40 characters) and defaults to `jerky-promo`.
- No personal data is collected: no name, email, phone or location. The endpoint shouldn't log IP addresses.
- The logo is the approved IMG_2773 (scaled copy only). The favicon is the circle icon, scaled.
