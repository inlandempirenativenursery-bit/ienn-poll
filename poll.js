/* IENN anonymous 3-question poll. No trackers, no personal data. */

// Apps Script web app (Lobo). Contract: text/plain JSON {response_id, q1, q2, q3, src} -> {ok:true} | {ok:false, error}
const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbyxx4vGOow0OKdfO8RbxlR5Swr7iBvSpdwDbPb_stTcJ5uhUUg7JUteAEEugssmMoh9/exec';

(function () {
  'use strict';
  var QUESTIONS = [
    'I know which California native plants would grow well where I live.',
    'A yard full of California native plants would look good to me.',
    "If I got a simple plan and the plants to match, I'd try a native garden."
  ];
  var KEY_ID = 'iennPoll.responseId';
  var KEY_QUEUE = 'iennPoll.queue';
  var DEFAULT_SRC = 'jerky-promo';

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback for older browsers / non-secure contexts: RFC4122 v4 from getRandomValues.
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function responseId() {
    var id = store(KEY_ID);
    if (!id) { id = uuid(); store(KEY_ID, id); }
    return id;
  }

  function srcTag() {
    var s = '';
    try { s = new URLSearchParams(location.search).get('src') || ''; } catch (e) {}
    s = s.trim().toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32);
    return s || DEFAULT_SRC;
  }

  // ---- Sending, retry and offline queue ----
  function readQueue() { try { return JSON.parse(store(KEY_QUEUE) || '[]'); } catch (e) { return []; } }
  function writeQueue(q) { store(KEY_QUEUE, JSON.stringify(q)); }
  function enqueue(payload) {
    // Same response_id replaces any older queued copy, so a re-take updates instead of duplicating.
    var q = readQueue().filter(function (p) { return p.response_id !== payload.response_id; });
    q.push(payload); writeQueue(q);
  }
  function endpointReady() { return /^https:\/\//.test(ENDPOINT_URL); }

  function isValid(p) {
    function q(v) { return v === 1 || v === 2 || v === 3 || v === 4 || v === 5; }
    return /^[A-Za-z0-9_-]{8,64}$/.test(p.response_id) && q(p.q1) && q(p.q2) && q(p.q3) && /^[a-z0-9-]{1,32}$/.test(p.src);
  }

  // Resolves 'ok' or 'rejected' (server said ok:false: permanent, drop it). Rejects on network/CORS failure (keep queued).
  function post(payload) {
    if (!endpointReady()) return Promise.reject(new Error('endpoint not set'));
    // text/plain body = "simple" CORS request, no preflight. Apps Script answers with Access-Control-Allow-Origin: *.
    return fetch(ENDPOINT_URL, {
      method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ response_id: payload.response_id, q1: payload.q1, q2: payload.q2, q3: payload.q3, src: payload.src })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok === true) return 'ok';
      if (j && j.ok === false) return 'rejected';
      throw new Error('unexpected response');
    });
  }

  var flushing = false;
  function flush(attempt) {
    attempt = attempt || 0;
    if (flushing) return;
    var q = readQueue();
    if (!q.length || !endpointReady()) return;
    if (navigator.onLine === false) return; // wait for 'online' or next load
    flushing = true;
    var item = q[0];
    if (!isValid(item)) { writeQueue(readQueue().slice(1)); flushing = false; flush(0); return; }
    post(item).then(function () {
      var rest = readQueue().filter(function (p) { return !(p.response_id === item.response_id && p.ts === item.ts); });
      writeQueue(rest); flushing = false;
      if (rest.length) flush(0);
    }, function () {
      flushing = false;
      if (attempt < 4) setTimeout(function () { flush(attempt + 1); }, 2000 * Math.pow(2, attempt));
    });
  }
  window.addEventListener('online', function () { flush(0); });

  // ---- UI ----
  var $ = function (id) { return document.getElementById(id); };
  var answers = [null, null, null];
  var idx = 0;

  function show(id) {
    ['s-intro', 's-q', 's-thanks'].forEach(function (s) { $(s).hidden = (s !== id); });
    window.scrollTo(0, 0);
  }

  function renderQ() {
    $('q-text').textContent = QUESTIONS[idx];
    $('progress').textContent = (idx + 1) + ' of 3';
    $('bar-fill').style.width = ((idx + 1) / 3 * 100) + '%';
    $('back').disabled = false;
    var btns = $('scale').querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-checked', String(answers[idx] === +btns[i].dataset.v));
    }
  }

  var locked = false;
  $('scale').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || locked) return;
    answers[idx] = +b.dataset.v;
    renderQ(); // show the selection briefly
    locked = true;
    setTimeout(function () {
      locked = false;
      if (idx < 2) { idx++; renderQ(); }
      else finish();
    }, 180);
  });

  $('start').addEventListener('click', function () { idx = 0; show('s-q'); renderQ(); });
  $('back').addEventListener('click', function () {
    if (idx === 0) { show('s-intro'); return; }
    idx--; renderQ();
  });

  function finish() {
    var payload = { response_id: responseId(), q1: answers[0], q2: answers[1], q3: answers[2], src: srcTag(), ts: Date.now() };
    if (isValid(payload)) enqueue(payload);
    show('s-thanks');
    flush(0);
  }

  // Send anything left over from an earlier visit (e.g. answered while offline).
  responseId();
  flush(0);
})();
