/*
 * tests.js — Roo HQ
 * Runs in the browser (open tests.html). Two groups:
 *   1) Logic — week generation, owners, the locked mow, "alternate" resolution, seasonal hide.
 *   2) Sync  — a TWO-DEVICE SIMULATION of the merge engine: two phones + a shared "cloud",
 *      exercising simple propagation, concurrent edits, same-field conflicts, offline edits,
 *      and settings/office-day sync. This is what gives confidence the live sync is correct
 *      without needing a real Firebase project.
 */
(function () {
  "use strict";
  var Logic = RooHQ.Logic, Merge = RooHQ.Merge, Seed = RooHQ.Seed;

  var results = [];
  function assert(name, cond, detail) { results.push({ name: name, pass: !!cond, detail: detail || "" }); }
  function eq(name, a, b) { assert(name, a === b, "got " + JSON.stringify(a) + ", expected " + JSON.stringify(b)); }

  // ---- doc helpers (mirror Store's shape) ----
  function makeDoc() {
    return {
      settings: { meName: { v: "Me", ts: 0 }, annaName: { v: "Anna", ts: 0 }, mowingInSeason: { v: true, ts: 0 } },
      overrides: {}, officeDays: {}
    };
  }
  function setAssignee(doc, id, v, ts) { (doc.overrides[id] = doc.overrides[id] || {}).assignee = { v: v, ts: ts }; }
  function setDone(doc, id, v, by, ts) { (doc.overrides[id] = doc.overrides[id] || {}).done = { v: v, by: by, at: ts, ts: ts }; }

  // Apply an RTDB-style update map { "a/b/c": field } to a plain doc (our fake "cloud").
  function applyUpdate(doc, map) {
    Object.keys(map).forEach(function (path) {
      var parts = path.split("/");
      var node = doc;
      for (var i = 0; i < parts.length - 1; i++) { node = node[parts[i]] = node[parts[i]] || {}; }
      node[parts[parts.length - 1]] = map[path];
    });
  }
  // One device <-> cloud exchange: pull newer from cloud, push our newer up.
  function syncRound(device, cloud) {
    Merge.mergeDocInto(device, cloud);
    applyUpdate(cloud, Merge.newerFields(device, cloud));
  }
  function converge(a, b, cloud) { for (var i = 0; i < 3; i++) { syncRound(a, cloud); syncRound(b, cloud); } }

  // ============ Logic ============
  var monday = Logic.mondayStart(new Date(2024, 0, 1)); // 2024-01-01 is a Monday
  eq("known Monday has dayIndex 0", Logic.dayIndexOf(monday), 0);

  var gen = Logic.generateWeek(monday);
  var daily = gen.filter(function (c) { return c.templateKey === "roo-breakfast"; });
  eq("daily chore appears 7×", daily.length, 7);
  assert("daily owner is Me", daily.every(function (c) { return c.assignee === "me"; }));

  var lunch = gen.filter(function (c) { return c.templateKey === "roo-lunch-walk"; });
  eq("weekday chore appears 5×", lunch.length, 5);

  var ensuite = gen.filter(function (c) { return c.templateKey === "tue-ensuite"; });
  eq("ensuite on Tuesday", ensuite[0].dayIndex, 1);
  eq("ensuite owner Me", ensuite[0].assignee, "me");

  var mow = gen.filter(function (c) { return c.templateKey === "mow-edge"; })[0];
  eq("mow on Saturday", mow.dayIndex, 5);
  eq("mow owner Anna", mow.assignee, "anna");
  assert("mow locked & not swappable", mow.locked && !mow.swappable);
  assert("canSwap(mow) is false", !Logic.canSwap(mow));
  assert("canSwap(ensuite) is true", Logic.canSwap(ensuite[0]));

  var expected = Seed.TEMPLATES.reduce(function (s, t) { return s + Seed.SCHEDULE_DAYS[t.schedule].length; }, 0);
  eq("total weekly chores", gen.length, expected);

  eq("alt parity0 day0 → Me", Logic.resolveAssignee("alternate", 0, 0), "me");
  eq("alt parity0 day1 → Anna", Logic.resolveAssignee("alternate", 1, 0), "anna");
  eq("alt parity1 day0 → Anna (flips)", Logic.resolveAssignee("alternate", 0, 1), "anna");
  assert("no generated instance is 'alternate'", !gen.some(function (c) { return c.assignee === "alternate"; }));

  assert("mow hidden out of season", Logic.isHiddenMow(mow, false));
  assert("mow shown in season", !Logic.isHiddenMow(mow, true));

  // ============ Sync (two-device simulation) ============
  var ID = "20240101|tue-ensuite|1";

  // 1) simple propagation
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    setAssignee(a, ID, "anna", 100);
    converge(a, b, cloud);
    eq("propagate: B sees A's swap", b.overrides[ID].assignee.v, "anna");
    eq("propagate: cloud holds it", cloud.overrides[ID].assignee.v, "anna");
  })();

  // 2) concurrent edits to DIFFERENT fields both survive
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    setAssignee(a, ID, "anna", 100);   // A swaps owner
    setDone(b, ID, true, "anna", 101); // B ticks done
    converge(a, b, cloud);
    assert("concurrent: A has owner=anna", a.overrides[ID].assignee.v === "anna");
    assert("concurrent: A has done=true", a.overrides[ID].done.v === true);
    assert("concurrent: B has owner=anna", b.overrides[ID].assignee.v === "anna");
    assert("concurrent: B has done=true", b.overrides[ID].done.v === true);
  })();

  // 3) SAME-field conflict → higher timestamp wins, both converge
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    setAssignee(a, ID, "anna", 200);
    setAssignee(b, ID, "both", 201); // later
    converge(a, b, cloud);
    eq("conflict: A → both (newer)", a.overrides[ID].assignee.v, "both");
    eq("conflict: B → both", b.overrides[ID].assignee.v, "both");
    eq("conflict: cloud → both", cloud.overrides[ID].assignee.v, "both");
  })();

  // 4) offline edit reconciles on reconnect
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    setAssignee(b, ID, "anna", 100);
    converge(a, b, cloud);             // cloud + A now "anna"
    setAssignee(a, ID, "me", 300);     // A edits while "offline"
    converge(a, b, cloud);             // reconnect
    eq("offline: A's later edit wins", a.overrides[ID].assignee.v, "me");
    eq("offline: B receives it", b.overrides[ID].assignee.v, "me");
  })();

  // 5) settings + office day sync
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    a.settings.mowingInSeason = { v: false, ts: 500 };
    a.settings.meName = { v: "Wilco", ts: 500 };
    a.officeDays["20240103"] = { v: true, ts: 500 };
    converge(a, b, cloud);
    eq("settings: B sees season off", b.settings.mowingInSeason.v, false);
    eq("settings: B sees renamed Me", b.settings.meName.v, "Wilco");
    eq("office: B sees the office day", b.officeDays["20240103"].v, true);
  })();

  // 6) untouched default settings are NOT pushed (won't clobber a partner's edit)
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    b.settings.annaName = { v: "Anna B", ts: 700 }; // B renamed Anna
    converge(a, b, cloud);
    eq("no-clobber: A's default doesn't overwrite B", a.settings.annaName.v, "Anna B");
  })();

  // ---- report ----
  var pass = results.filter(function (r) { return r.pass; }).length;
  var total = results.length;
  window.__rooTests = { pass: pass, total: total, results: results };

  var out = document.getElementById("out");
  if (out) {
    out.innerHTML =
      '<h2 class="' + (pass === total ? "ok" : "bad") + '">' +
      (pass === total ? "✓ " : "✗ ") + pass + " / " + total + " passed</h2>" +
      results.map(function (r) {
        return '<div class="t ' + (r.pass ? "ok" : "bad") + '">' +
          (r.pass ? "✓" : "✗") + " " + r.name + (r.pass ? "" : " — " + r.detail) + "</div>";
      }).join("");
  }
})();
