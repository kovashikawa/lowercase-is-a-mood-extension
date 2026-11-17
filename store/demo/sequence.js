// Run the whole demo input sequence inside ONE osascript process.
//
// Spawning osascript per step costs roughly 0.3s of unpredictable startup, so
// a sequence built from separate processes cannot be paced reliably. Doing it
// in one process means the only delays are the ones asked for.
//
// Steps file: [{c:'click'|'move'|'scroll'|'back'|'hold', x, y, dy, n, p, g}]
//   p = pause after the step, ms
//   g = cursor travel time, ms (default scales with distance)
// Returns a journal of "label@offset_ms" so the recording can be checked
// against what was actually driven.
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

function glide(x1, y1, ms) {
  var s = here();
  var d = Math.sqrt(Math.pow(x1 - s.x, 2) + Math.pow(y1 - s.y, 2));
  if (d < 2) { post(MOVED, x1, y1); return; }
  var n = Math.max(10, Math.min(150, Math.round(d / 14)));
  var per = (ms ? ms : Math.min(900, 180 + d * 0.55)) / n / 1000;
  for (var i = 1; i <= n; i++) {
    var t = i / n;
    // ease in/out, so the pointer reads as hand-driven rather than linear
    var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    post(MOVED, s.x + (x1 - s.x) * e, s.y + (y1 - s.y) * e);
    delay(per);
  }
  post(MOVED, x1, y1);
  delay(0.1);
}

function run(argv) {
  var steps = JSON.parse(ObjC.unwrap($.NSString.stringWithContentsOfFile(argv[0])));
  var t0 = $.NSDate.date;
  var journal = [];

  for (var i = 0; i < steps.length; i++) {
    var st = steps[i];
    var at = Math.round(-t0.timeIntervalSinceNow * 1000);
    if (st.c === 'move') {
      glide(st.x, st.y, st.g);
    } else if (st.c === 'click') {
      glide(st.x, st.y, st.g);
      post(DOWN, st.x, st.y);
      delay(0.08);
      post(UP, st.x, st.y);
      delay(0.1);
    } else if (st.c === 'scroll') {
      post(MOVED, st.x, st.y);
      delay(0.15);
      var n = st.n || 10;
      for (var j = 0; j < n; j++) {
        $.CGEventPost(TAP, $.CGEventCreateScrollWheelEvent(null, 0, 1, st.dy));
        delay(st.sd !== undefined ? st.sd / 1000 : 0.028);
      }
    } else if (st.c === 'back') {
      Application('System Events').keyCode(33, { using: 'command down' });
      delay(0.3);
    } else if (st.c === 'hold') {
      // nothing but the pause
    }
    journal.push((st.label || st.c) + '@' + at);
    if (st.p) delay(st.p / 1000);
  }

  var total = Math.round(-t0.timeIntervalSinceNow * 1000);
  return 'SEQ_DONE total_ms=' + total + ' ' + journal.join(' ');
}
