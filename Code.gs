/** IENN Native Plant Poll: anonymous response storage. Bound to the "IENN Native Plant Poll" sheet.
 *  POST (Content-Type: text/plain) body JSON: {"response_id":"<8-64 chars A-Za-z0-9_->","q1":1-5,"q2":1-5,"q3":1-5,"src":"jerky-promo","ua":"optional short"}
 *  Also accepts form-encoded fields with the same names. Upserts by response_id. Returns {"ok":true} or {"ok":false,"error":"..."}.
 *  Stores no IP, names or contact details. */
var POLL_SHEET = 'Responses';
var POLL_HEAD = ['timestamp', 'response_id', 'q1', 'q2', 'q3', 'src', 'user_agent_short'];

function pollOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function pollSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(POLL_SHEET);
  if (!sh) { sh = ss.insertSheet(POLL_SHEET); }
  if (sh.getLastRow() === 0) { sh.appendRow(POLL_HEAD); sh.setFrozenRows(1); }
  return sh;
}

function pollParse_(e) {
  var d = {};
  try { if (e && e.postData && e.postData.contents && /^\s*\{/.test(e.postData.contents)) d = JSON.parse(e.postData.contents); } catch (err) { d = {}; }
  var p = (e && e.parameter) || {};
  ['response_id', 'q1', 'q2', 'q3', 'src', 'ua'].forEach(function (k) { if (d[k] === undefined && p[k] !== undefined) d[k] = p[k]; });
  return d;
}

function pollValidate_(d) {
  var id = String(d.response_id || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return 'bad response_id';
  var q = [];
  for (var i = 1; i <= 3; i++) {
    var v = d['q' + i], n = Number(v);
    if (v === '' || v === null || v === undefined || !isFinite(n) || n !== Math.floor(n) || n < 1 || n > 5) return 'q' + i + ' must be an integer 1-5';
    q.push(n);
  }
  var src = String(d.src || '');
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(src)) return 'bad src';
  var ua = String(d.ua || '').replace(/[\r\n\t]+/g, ' ').slice(0, 80);
  if (/^[=+\-@]/.test(ua)) ua = "'" + ua;
  return { id: id, q: q, src: src, ua: ua };
}

function doPost(e) {
  var v = pollValidate_(pollParse_(e));
  if (typeof v === 'string') return pollOut_({ ok: false, error: v });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return pollOut_({ ok: false, error: 'busy, try again' }); }
  try {
    var sh = pollSheet_(), row = [new Date(), v.id, v.q[0], v.q[1], v.q[2], v.src, v.ua], last = sh.getLastRow(), at = -1;
    if (last > 1) {
      var ids = sh.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === v.id) { at = i + 2; break; }
    }
    if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    return pollOut_({ ok: true });
  } finally { lock.releaseLock(); }
}

function doGet() { return pollOut_({ ok: true, service: 'IENN Native Plant Poll', usage: 'POST text/plain JSON' }); }

/** Run once from the editor to create the header row and authorize. */
function pollSetup() { pollSheet_(); }
