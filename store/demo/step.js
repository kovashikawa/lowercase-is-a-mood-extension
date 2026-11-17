// A single OS-level input action via CoreGraphics, for calibration probes and
// for the reset phase of record.sh.
//
// Must be run by a process that holds the Accessibility grant. Posting a mouse
// event from a process without it silently does nothing: the event is accepted
// and the cursor does not move, so always verify with 'where'.
//
// Playwright's page.mouse cannot be used for any of this, because the toolbar
// is outside the page viewport.
ObjC.import('CoreGraphics');

var TAP = 0;
var MOVED = 5;
var DOWN = 1;
var UP = 2;

function post(type, x, y) {
  $.CGEventPost(TAP, $.CGEventCreateMouseEvent(null, type, $.CGPointMake(x, y), 0));
}

function here() {
  var p = $.CGEventGetLocation($.CGEventCreate(null));
  return { x: p.x, y: p.y };
}

function glide(x1, y1) {
  var s = here();
  var d = Math.sqrt(Math.pow(x1 - s.x, 2) + Math.pow(y1 - s.y, 2));
  if (d < 2) { post(MOVED, x1, y1); return; }
  var n = Math.max(12, Math.min(200, Math.round(d / 12)));
  for (var i = 1; i <= n; i++) {
    var t = i / n;
    var e = 1 - Math.pow(1 - t, 3);
    post(MOVED, s.x + (x1 - s.x) * e, s.y + (y1 - s.y) * e);
    delay(0.008);
  }
  post(MOVED, x1, y1);
  delay(0.12);
}

function run(argv) {
  var cmd = argv[0];
  if (cmd === 'where') return JSON.stringify(here());
  if (cmd === 'move') { glide(+argv[1], +argv[2]); return 'MOVED'; }
  if (cmd === 'click') {
    glide(+argv[1], +argv[2]);
    post(DOWN, +argv[1], +argv[2]);
    delay(0.09);
    post(UP, +argv[1], +argv[2]);
    delay(0.12);
    return 'CLICKED ' + argv[1] + ',' + argv[2];
  }
  if (cmd === 'scroll') {
    post(MOVED, +argv[1], +argv[2]);
    delay(0.2);
    var n = +argv[4] || 10;
    for (var j = 0; j < n; j++) {
      $.CGEventPost(TAP, $.CGEventCreateScrollWheelEvent(null, 0, 1, +argv[3]));
      delay(0.03);
    }
    return 'SCROLLED';
  }
  if (cmd === 'esc') {
    Application('System Events').keyCode(53);
    delay(0.3);
    return 'ESC';
  }
  if (cmd === 'back') {
    Application('System Events').keyCode(33, { using: 'command down' });
    delay(0.4);
    return 'BACK';
  }
  if (cmd === 'activate') {
    Application('Google Chrome for Testing').activate();
    delay(1.0);
    return 'ACTIVATED';
  }
  return 'UNKNOWN ' + cmd;
}
