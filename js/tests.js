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
      overrides: {}, officeDays: {}, customTemplates: {}
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

  // ============ Logic (cadence engine) ============
  var monday = Logic.mondayStart(new Date(2024, 0, 1)); // 2024-01-01 is a Monday
  eq("known Monday has dayIndex 0", Logic.dayIndexOf(monday), 0);

  // Test with synthetic templates passed as customTemplates, filtered by their unique keys
  // so these tests don't depend on the actual seed content.
  function genKeys(mon, tpls) {
    var keys = tpls.map(function (t) { return t.key; });
    return Logic.generateWeek(mon, tpls).filter(function (c) { return keys.indexOf(c.templateKey) >= 0; });
  }
  function countKey(mon, tpls, key) {
    return genKeys(mon, tpls).filter(function (c) { return c.templateKey === key; }).length;
  }

  var T = [
    { key: "t-daily",  title: "Daily",  category: "cleaning", cadence: "daily",       dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "both" },
    { key: "t-weekly", title: "Weekly", category: "cleaning", cadence: "weekly",      dayIndex: 2, timeOfDay: "anytime", defaultAssignee: "anna" },
    { key: "t-edge",   title: "Edge",   category: "garden",   cadence: "fortnightly", dayIndex: 5, timeOfDay: "anytime", defaultAssignee: "anna", slot: 0, locked: true, seasonal: true, swappable: false }
  ];

  eq("daily template -> 7 instances", countKey(monday, T, "t-daily"), 7);
  var wk = genKeys(monday, T).filter(function (c) { return c.templateKey === "t-weekly"; });
  eq("weekly template -> 1 instance", wk.length, 1);
  eq("weekly lands on its day (Wed)", wk[0].dayIndex, 2);
  eq("weekly owner = anna", wk[0].assignee, "anna");

  // fortnightly: appears in exactly one of two consecutive weeks
  var fortThis = countKey(monday, T, "t-edge");
  var fortNext = countKey(Logic.addWeeks(monday, 1), T, "t-edge");
  eq("fortnightly appears once across two weeks", fortThis + fortNext, 1);

  // monthly: once in any 4 consecutive weeks
  var monthlyTpl = [{ key: "t-monthly", title: "M", category: "cleaning", cadence: "monthly", dayIndex: 3, timeOfDay: "anytime", defaultAssignee: "both", slot: 2 }];
  var mHits = 0;
  for (var mi = 0; mi < 4; mi++) { mHits += countKey(Logic.addWeeks(monday, mi), monthlyTpl, "t-monthly"); }
  eq("monthly appears once in 4 weeks", mHits, 1);

  // quarterly: once in any 13 consecutive weeks
  var qTpl = [{ key: "t-q", title: "Q", category: "garden", cadence: "quarterly", dayIndex: 5, timeOfDay: "anytime", defaultAssignee: "both", slot: 7 }];
  var qHits = 0;
  for (var qi = 0; qi < 13; qi++) { qHits += countKey(Logic.addWeeks(monday, qi), qTpl, "t-q"); }
  eq("quarterly appears once in 13 weeks", qHits, 1);

  // locked + seasonal behaviour on the fortnightly edge task
  var edge = null;
  for (var ek = 0; ek < 2 && !edge; ek++) {
    var arr = genKeys(Logic.addWeeks(monday, ek), T).filter(function (c) { return c.templateKey === "t-edge"; });
    if (arr.length) edge = arr[0];
  }
  assert("edge instance exists in one of two weeks", !!edge);
  assert("edge is locked", edge && edge.locked === true);
  assert("canSwap(edge) is false", edge && Logic.canSwap(edge) === false);
  assert("edge hidden out of season", edge && Logic.isHiddenSeasonal(edge, false) === true);
  assert("edge shown in season", edge && Logic.isHiddenSeasonal(edge, true) === false);

  // alternate resolution
  eq("alt parity0 day0 -> me", Logic.resolveAssignee("alternate", 0, 0), "me");
  eq("alt parity0 day1 -> anna", Logic.resolveAssignee("alternate", 1, 0), "anna");
  eq("alt parity1 day0 -> anna (flips)", Logic.resolveAssignee("alternate", 0, 1), "anna");

  // seed sanity: exactly one locked task, and it's Anna + garden + seasonal
  var lockedSeen = {};
  for (var sw = 0; sw < 4; sw++) {
    Logic.generateWeek(Logic.addWeeks(monday, sw)).forEach(function (c) {
      if (c.locked) lockedSeen[c.templateKey] = { assignee: c.assignee, category: c.category, seasonal: c.seasonal };
    });
  }
  var lockedKeys = Object.keys(lockedSeen);
  eq("seed has exactly one locked task", lockedKeys.length, 1);
  assert("locked task is anna + garden + seasonal",
    lockedKeys.length === 1 &&
    lockedSeen[lockedKeys[0]].assignee === "anna" &&
    lockedSeen[lockedKeys[0]].category === "garden" &&
    lockedSeen[lockedKeys[0]].seasonal === true);
  assert("no generated seed instance is 'alternate' raw",
    !Logic.generateWeek(monday).some(function (c) { return c.assignee === "alternate"; }));

  // rotation: a template with a rotation array varies owner across weeks
  (function () {
    var rotTpl = [{ key: "t-rot", title: "R", category: "cleaning", cadence: "weekly", dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "me", rotation: ["me", "anna", "me", "anna"] }];
    var seen = [];
    for (var w = 0; w < 4; w++) {
      var g = Logic.generateWeek(Logic.addWeeks(monday, w), rotTpl).filter(function (c) { return c.templateKey === "t-rot"; });
      if (g.length) seen.push(g[0].assignee);
    }
    assert("rotation shows both owners across 4 weeks", seen.indexOf("me") >= 0 && seen.indexOf("anna") >= 0);
    assert("rotation owners are concrete", seen.every(function (v) { return v === "me" || v === "anna"; }));
  })();

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

  // 7) custom chore: add on A syncs to B; delete on B syncs back to A
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    a.customTemplates["custom-1"] = {
      v: { title: "Water the plants", category: "garden", schedule: "daily", timeOfDay: "morning", defaultAssignee: "me" },
      ts: 600
    };
    converge(a, b, cloud);
    eq("custom: B receives the new chore", b.customTemplates["custom-1"].v.title, "Water the plants");

    b.customTemplates["custom-1"] = { v: null, ts: 700 }; // delete (tombstone)
    converge(a, b, cloud);
    eq("custom: A sees the deletion", a.customTemplates["custom-1"].v, null);
  })();

  // 8) a custom 'daily' template generates 7 instances in a week
  (function () {
    var custom = [{ key: "custom-x", title: "Feed the fish", category: "kitchen", schedule: "daily", timeOfDay: "morning", defaultAssignee: "both", locked: false, swappable: true }];
    var g = Logic.generateWeek(monday, custom).filter(function (c) { return c.templateKey === "custom-x"; });
    eq("custom daily chore appears 7×", g.length, 7);
    assert("custom chore is swappable", Logic.canSwap(g[0]));
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
