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

  // edit/remove built-ins: generateWeek honours a supplied (edited) base template list
  (function () {
    var base = [
      { key: "b-keep", title: "Keep", category: "cleaning", cadence: "daily", dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "me" },
      { key: "b-edited", title: "Edited title", category: "cleaning", cadence: "weekly", dayIndex: 3, timeOfDay: "anytime", defaultAssignee: "anna" }
      // a removed chore is simply absent from the base list
    ];
    var g = Logic.generateWeek(monday, null, base);
    var keys = g.map(function (c) { return c.templateKey; });
    assert("edited base: provided templates generate", keys.indexOf("b-keep") >= 0 && keys.indexOf("b-edited") >= 0);
    assert("edited base: seed templates excluded when base supplied", keys.indexOf("make-bed") < 0);
    var ed = g.filter(function (c) { return c.templateKey === "b-edited"; })[0];
    eq("edited base: new title used", ed.title, "Edited title");
    eq("edited base: new day used", ed.dayIndex, 3);
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

  // ============ Game layer ============
  var Game = RooHQ.Game;
  function same(name, a, b) { eq(name, JSON.stringify(a), JSON.stringify(b)); }

  // points = max(1, round(minutes / 5))
  eq("points: 30 min -> 6", Game.points(30), 6);
  eq("points: 5 min -> 1", Game.points(5), 1);
  eq("points: 2 min -> 1 (minimum)", Game.points(2), 1);
  eq("points: 12 min -> 2", Game.points(12), 2);
  eq("points: 13 min -> 3", Game.points(13), 3);
  eq("points: 150 min -> 30", Game.points(150), 30);
  eq("points: missing minutes -> default 10 -> 2", Game.points(undefined), 2);

  // credit rules
  same("credit: ticker gets the points", Game.creditFor({ v: true, by: "anna" }, "me"), ["anna"]);
  same("credit: 'both' chore credits both", Game.creditFor({ v: true, by: "me" }, "both"), ["me", "anna"]);
  same("credit: missing by -> assignee", Game.creditFor({ v: true }, "anna"), ["anna"]);
  same("credit: stored owner wins over lookup", Game.creditFor({ v: true, owner: "both" }, "me"), ["me", "anna"]);
  same("credit: not done -> nobody", Game.creditFor({ v: false, by: "me" }, "me"), []);

  (function () {
    var ov = {
      "20261116|a|0": { done: { v: true, by: "me", pts: 6, ts: 1 } },
      "20261116|b|0": { done: { v: true, by: "anna", pts: 3, owner: "both", ts: 1 } },
      "20261116|c|1": { done: { v: true, ts: 1 } },                    // old data: no by, no pts
      "20261116|d|1": { done: { v: false, by: null, ts: 2 } },         // unticked: no credit
      "20261109|e|2": { done: { v: true, by: "anna", pts: 4, ts: 1 } }  // previous week
    };
    var opts = { prefix: "20261116", ptsOf: function () { return 2; }, assigneeOf: function () { return "anna"; } };
    var t = Game.tally(ov, opts);
    eq("tally week: Alex = 6 + 3", t.me, 9);
    eq("tally week: Anna = 3 + 2 (old data credits assignee)", t.anna, 5);
    eq("tally week: team counts 'both' once", t.team, 11);
    opts.prefix = null;
    var life = Game.tally(ov, opts);
    eq("tally lifetime includes other weeks", life.anna, 9);
  })();

  // levels
  eq("level: 0 pts -> 1", Game.level(0).level, 1);
  eq("level: 249 pts -> 1", Game.level(249).level, 1);
  eq("level: 250 pts -> 2", Game.level(250).level, 2);
  eq("level: 300 pts -> 50 into level 2", Game.level(300).into, 50);
  eq("level: 300 pts -> 20% to level 3", Game.level(300).pct, 20);

  // streaks — synthetic weeks: each day Alex has one core chore and a shared 'both' core chore,
  // plus a bonus chore. Sunday 15 Nov 2026 has no core chores at all.
  (function () {
    function weekFn(mon) {
      var st = Logic.stamp(mon), out = [];
      for (var di = 0; di < 7; di++) {
        var noCore = st === "20261109" && di === 6;
        if (!noCore) {
          out.push({ instanceID: st + "|core-me|" + di, dayIndex: di, core: true, assignee: "me" });
          out.push({ instanceID: st + "|core-both|" + di, dayIndex: di, core: true, assignee: "both" });
        }
        out.push({ instanceID: st + "|bonus|" + di, dayIndex: di, core: false, assignee: "me" });
      }
      return out;
    }
    function asg(c) { return c.assignee; }
    var done = {};
    function isDone(id) { return !!done[id]; }
    function tick(st, di) { done[st + "|core-me|" + di] = true; done[st + "|core-both|" + di] = true; }
    var today = new Date(2026, 10, 18); // Wednesday
    tick("20261116", 1); tick("20261116", 0);   // Tue 17, Mon 16
    tick("20261109", 5);                        // Sat 14 (Sun 15 has no core chores)
    eq("streak: today incomplete does not break it", Game.streak("me", today, weekFn, asg, isDone, 60), 4);
    tick("20261116", 2);
    eq("streak: today complete extends it", Game.streak("me", today, weekFn, asg, isDone, 60), 5);
    eq("streak: only 'both' chores count for Anna", Game.streak("anna", today, weekFn, asg, isDone, 60), 5);
    delete done["20261116|core-me|0"];          // Mon 16: Alex's own chore not done
    eq("streak: a missed core chore breaks it", Game.streak("me", today, weekFn, asg, isDone, 60), 2);
    eq("streak: Alex's miss doesn't break Anna's", Game.streak("anna", today, weekFn, asg, isDone, 60), 5);
    assert("streak: day with no core chores is kept", Game.dayKept(weekFn(new Date(2026, 10, 9)).filter(function (c) { return c.dayIndex === 6; }), "me", asg, isDone));
    eq("streak: capped at 60 days of lookback", Game.streak("me", today, weekFn, asg, function () { return true; }, 60), 61);
  })();

  // team target: core points, 'both' counted once, bonus excluded
  eq("team target", Game.teamTarget([
    { core: true, minutes: 30, assignee: "me" },
    { core: true, minutes: 5, assignee: "anna" },
    { core: true, minutes: 60, assignee: "both" },
    { core: false, minutes: 30, assignee: "me" }
  ]), 19);
  assert("team target for a real seed week is positive", Game.teamTarget(Logic.generateWeek(new Date(2026, 10, 16))) > 0);

  // bins: Monday collections, black -> blue -> orange
  eq("bin 16 Nov 2026 is black", Logic.binFor(new Date(2026, 10, 16)).key, "black");
  eq("bin 23 Nov 2026 is blue", Logic.binFor(new Date(2026, 10, 23)).key, "blue");
  eq("bin 30 Nov 2026 is orange", Logic.binFor(new Date(2026, 10, 30)).key, "orange");
  eq("bin 7 Dec 2026 is black again", Logic.binFor(new Date(2026, 11, 7)).key, "black");
  eq("bin before the reference wraps (9 Nov 2026 is orange)", Logic.binFor(new Date(2026, 10, 9)).key, "orange");
  eq("bin title on Sunday names Monday's bin", Logic.binTitle(new Date(2026, 10, 15)), "Put the black bin out (general waste)");
  (function () {
    var bin = Logic.generateWeek(new Date(2026, 10, 16)).filter(function (c) { return c.templateKey === "bin-out"; });
    eq("bin chore: once a week", bin.length, 1);
    eq("bin chore: Sunday", bin[0] && bin[0].dayIndex, 6);
    eq("bin chore: 19:00", bin[0] && bin[0].time, "19:00");
    eq("bin chore: Anna", bin[0] && bin[0].assignee, "anna");
    assert("bin chore: core", bin[0] && bin[0].core === true);
    eq("bin chore: title for 23 Nov collection", bin[0] && bin[0].title, "Put the blue bin out (cardboard and paper)");
  })();

  // days field
  (function () {
    var tpls = [
      { key: "t-days", title: "Mon-Thu", category: "dog", cadence: "daily", days: [0, 1, 2, 3], dayIndex: 0, timeOfDay: "morning", defaultAssignee: "me" },
      { key: "t-days2", title: "Tue+Fri", category: "dog", cadence: "weekly", days: [4, 1], dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "me" },
      { key: "t-bad", title: "Bad days", category: "dog", cadence: "daily", days: [9], dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "me" },
      { key: "t-none", title: "Cleared days", category: "dog", cadence: "daily", days: "none", dayIndex: 0, timeOfDay: "anytime", defaultAssignee: "me" }
    ];
    var g = genKeys(monday, tpls);
    same("days: Mon-Thu only", g.filter(function (c) { return c.templateKey === "t-days"; }).map(function (c) { return c.dayIndex; }), [0, 1, 2, 3]);
    same("days: weekly with two days", g.filter(function (c) { return c.templateKey === "t-days2"; }).map(function (c) { return c.dayIndex; }).sort(), [1, 4]);
    eq("days: invalid list falls back to the cadence", countKey(monday, tpls, "t-bad"), 7);
    eq("days: 'none' means the cadence default", countKey(monday, tpls, "t-none"), 7);
    same("days: Firebase object form accepted", Logic.validDays({ 0: 6, 1: 5 }), [5, 6]);
    eq("days: instance id stays stamp|key|dayIndex", g.filter(function (c) { return c.templateKey === "t-days"; })[2].instanceID, "20240101|t-days|2");
    var fort = [{ key: "t-fd", title: "F", category: "dog", cadence: "fortnightly", days: [0, 3], slot: 0, defaultAssignee: "me" }];
    eq("days: fortnightly with days appears in one of two weeks", countKey(monday, fort, "t-fd") + countKey(Logic.addWeeks(monday, 1), fort, "t-fd"), 2);
  })();

  // startsOn
  (function () {
    var tpls = [{ key: "t-start", title: "S", category: "gym", cadence: "daily", days: [0, 2, 4], defaultAssignee: "me", startsOn: "20240103" }];
    same("startsOn: nothing before the start date", genKeys(monday, tpls).map(function (c) { return c.dayIndex; }), [2, 4]);
    var gym9 = Logic.generateWeek(new Date(2026, 10, 9)).filter(function (c) { return c.templateKey === "gym-alex-home"; }).length;
    var gym16 = Logic.generateWeek(new Date(2026, 10, 16)).filter(function (c) { return c.templateKey === "gym-alex-home"; });
    eq("Alex's home gym: not before 16 Nov 2026", gym9, 0);
    same("Alex's home gym: Mon, Wed, Fri from 16 Nov", gym16.map(function (c) { return c.dayIndex; }), [0, 2, 4]);
    eq("Alex's home gym: 05:30", gym16[0] && gym16[0].time, "05:30");
  })();

  // time ordering: timed chores first by time, then the existing order
  (function () {
    var tpls = [
      { key: "o-a", title: "A untimed morning", category: "cleaning", cadence: "weekly", dayIndex: 0, timeOfDay: "morning", defaultAssignee: "me" },
      { key: "o-b", title: "B at 18:00", category: "cleaning", cadence: "weekly", dayIndex: 0, time: "18:00", timeOfDay: "evening", defaultAssignee: "me" },
      { key: "o-c", title: "C at 06:00", category: "cleaning", cadence: "weekly", dayIndex: 0, time: "06:00", timeOfDay: "morning", defaultAssignee: "me" },
      { key: "o-d", title: "D bad time", category: "cleaning", cadence: "weekly", dayIndex: 0, time: "25:00", timeOfDay: "anytime", defaultAssignee: "me" }
    ];
    same("time ordering", genKeys(monday, tpls).map(function (c) { return c.templateKey; }), ["o-c", "o-b", "o-a", "o-d"]);
  })();

  // the routine
  (function () {
    var wk = Logic.generateWeek(new Date(2026, 10, 16));
    function on(di, filter) { return wk.filter(function (c) { return c.dayIndex === di && filter(c); }); }
    // A "Walk Roo, then her breakfast" card counts as one walk and one meal.
    function isWalk(c) { return c.category === "dog" && /walk|morning out/i.test(c.title); }
    function isMeal(c) { return c.category === "dog" && /breakfast|dinner/.test(c.title); }
    function who(list) { return list.map(function (c) { return c.assignee + "@" + c.time; }); }
    var ok = true;
    for (var di = 0; di < 7; di++) { if (on(di, isWalk).length !== 2 || on(di, isMeal).length !== 2) ok = false; }
    assert("routine: two walks and two meals every day", ok);
    assert("routine: old alternate walks removed", !wk.some(function (c) { return /^walk-roo-in-the/.test(c.templateKey); }));
    same("routine: Monday walks are Alex's at 06:00 and 17:30", who(on(0, isWalk)), ["me@06:00", "me@17:30"]);
    same("routine: Tuesday evening card is Anna's at 17:00", who(on(1, isWalk)), ["me@06:00", "anna@17:00"]);
    same("routine: Wednesday evening card is Alex's at 17:30", who(on(2, isWalk)), ["me@06:00", "me@17:30"]);
    same("routine: Thursday evening card is Anna's at 17:00", who(on(3, isWalk)), ["me@06:00", "anna@17:00"]);
    same("routine: Friday walks are Alex 06:45, Anna 18:15", who(on(4, isWalk)), ["me@06:45", "anna@18:15"]);
    same("routine: Sunday walks are shared at 08:30 and 17:45", who(on(6, isWalk)), ["both@08:30", "both@17:45"]);
    eq("routine: week check-in on Sunday 17:30", on(6, function (c) { return c.templateKey === "week-check-in"; }).map(function (c) { return c.time + c.assignee; })[0], "17:30both");

    // merged cards
    // Mon-Thu: morning and evening are both walk-then-meal cards; Friday only the morning one.
    same("merged: walk-then-meal cards per weekday (first is Alex's morning, 35 min)",
      [0, 1, 2, 3, 4].map(function (d) { var m = on(d, isWalk).filter(isMeal); return m.length + ":" + (m[0] && m[0].assignee) + ":" + (m[0] && m[0].minutes); }),
      ["2:me:35", "2:me:35", "2:me:35", "2:me:35", "1:me:35"]);
    eq("merged: Monday morning card keeps the leave-at-07:00 note", on(0, isMeal)[0].notes, "Back by 06:30, then 30 minutes to get ready. Leave at 07:00.");
    eq("merged: Friday dinner stays separate from Anna's walk", on(4, isMeal).filter(function (c) { return !isWalk(c); }).map(function (c) { return c.assignee + "@" + c.time; })[0], "me@17:30");
    var kitchen = wk.filter(function (c) { return c.templateKey === "kitchen-reset"; });
    eq("merged: one kitchen reset card a day", kitchen.length, 7);
    assert("merged: kitchen reset is Alex's, core, 25 minutes", kitchen.every(function (c) { return c.assignee === "me" && c.core && c.minutes === 25; }));
    var laundryOk = true;
    for (var ld = 0; ld < 7; ld++) {
      var l = on(ld, function (c) { return c.category === "laundry" && c.core; });
      if (l.length !== 1 || l[0].minutes !== 35) laundryOk = false;
    }
    assert("merged: one 35-minute laundry card a day", laundryOk);
    var retired = ["empty-dishwasher", "load-dishwasher", "wipe-down-sink-backsplash-and-windowsill", "unload-drying-rack",
      "load-laundry", "empty-laundry", "hang-laundry", "put-away-laundry", "roo-walk-am-mon-thu", "roo-breakfast-mon-thu",
      "roo-walk-pm-mon-thu", "roo-dinner-mon-thu", "roo-walk-am-fri", "roo-breakfast-fri", "walk-roo-in-the-morning", "walk-roo-in-the-evening"];
    assert("merged: retired keys are gone from the plan", !Seed.TEMPLATES.some(function (t) { return retired.indexOf(t.key) >= 0; }));
    assert("merged: retired keys keep their minutes for old ticks", retired.every(function (k) { return Seed.RETIRED_MINUTES[k] > 0; }));
    var rooCore = [0, 4, 5].map(function (d) { return on(d, function (c) { return c.core && c.category === "dog"; }).length; });
    same("Roo's day counts the merged cards (Mon, Fri, Sat)", rooCore, [2, 3, 4]);
  })();

  // laundry alternates fairly: Alex has two Monday-to-Thursday days every week, which two flips weekly
  (function () {
    var a = Logic.generateWeek(new Date(2026, 10, 16)), b = Logic.generateWeek(new Date(2026, 10, 23));
    function alexDays(wk) { return wk.filter(function (c) { return c.category === "laundry" && c.core && c.assignee === "me"; }).map(function (c) { return c.dayIndex; }); }
    eq("laundry: Alex has two days a week", alexDays(a).length + "," + alexDays(b).length, "2,2");
    assert("laundry: Alex's days flip week to week", alexDays(a).join() !== alexDays(b).join());
  })();

  // no more than 6 core chores per person per day, across the 4 rotation weeks
  (function () {
    var worst = 0, where = "";
    for (var w = 0; w < 4; w++) {
      var mon = Logic.addWeeks(new Date(2026, 10, 16), w);
      var wk = Logic.generateWeek(mon);
      for (var di = 0; di < 7; di++) {
        var day = wk.filter(function (c) { return c.dayIndex === di; });
        ["me", "anna"].forEach(function (p) {
          var n = Game.coreFor(day, p, function (c) { return c.assignee; }).length;
          if (n > worst) { worst = n; where = Logic.stamp(mon) + " day " + di + " " + p; }
        });
      }
    }
    assert("core list: at most 6 per person per day over 4 rotation weeks", worst <= 6, "max " + worst + " at " + where);
  })();

  // office days: Anna's Roo-care before 18:00 moves to Alex at 17:30 unless swapped by hand
  (function () {
    var mon = new Date(2026, 10, 16);
    var wk = Logic.generateWeek(mon);
    var tueId = "20261116|roo-pm-tue-thu|1", friId = "20261116|roo-walk-pm-fri|4";
    function find(list, id) { return list.filter(function (c) { return c.instanceID === id; })[0]; }
    function office(days) { return function (ymd) { return days.indexOf(ymd) >= 0; }; }
    var none = function () { return false; };

    var flagged = Logic.applyOfficeDays(wk, mon, office(["20261117"]), none);
    var tue = find(flagged, tueId);
    eq("office day: Anna's Tuesday evening card moves to Alex", tue.assignee, "me");
    eq("office day: ...at 17:30", tue.time, "17:30");
    eq("office day: Thursday not flagged, still Anna's", find(flagged, "20261116|roo-pm-tue-thu|3").assignee, "anna");
    eq("office day: Anna's laundry (not Roo-care) unaffected",
      flagged.filter(function (c) { return c.dayIndex === 1 && c.category === "laundry"; })[0].assignee,
      wk.filter(function (c) { return c.dayIndex === 1 && c.category === "laundry"; })[0].assignee);
    eq("office day: not flagged -> unchanged", find(Logic.applyOfficeDays(wk, mon, none, none), tueId).assignee, "anna");
    var swapped = Logic.applyOfficeDays(wk, mon, office(["20261117"]), function (id) { return id === tueId; });
    eq("office day: a manual swap wins", find(swapped, tueId).assignee + "@" + find(swapped, tueId).time, "anna@17:00");
    var fri = find(Logic.applyOfficeDays(wk, mon, office(["20261120"]), none), friId);
    eq("office day: Friday 18:15 walk unaffected", fri.assignee + "@" + fri.time, "anna@18:15");
    eq("office day: original chore not mutated", find(wk, tueId).assignee, "anna");
    var weekend = Logic.applyOfficeDays(wk, mon, office(["20261121", "20261122"]), none);
    assert("office day: a flag on Saturday or Sunday changes nothing",
      weekend.every(function (c, i) { return c.assignee === wk[i].assignee && c.time === wk[i].time; }));
    var core = Game.coreFor(flagged.filter(function (c) { return c.dayIndex === 1; }), "me", function (c) { return c.assignee; });
    assert("office day: the moved card counts as Alex's core", core.some(function (c) { return c.instanceID === tueId; }));
  })();

  // rewards, team goal and balances
  (function () {
    var seedR = [
      { key: "t1", kind: "team", title: "Takeaway" },
      { key: "t2", kind: "team", title: "Film" },
      { key: "p1", kind: "personal", title: "Pick the film", cost: 40 }
    ];
    var docR = {
      t2: { ts: 5 },                                                 // tombstone (as Firebase returns it)
      p1: { v: { kind: "personal", title: "Pick the film", cost: 45 }, ts: 6 },
      "rw-x": { v: { kind: "personal", title: "Lie-in", cost: 100 }, ts: 7 }
    };
    var eff = Game.effectiveRewards(seedR, docR);
    same("rewards: tombstone removes, edit applies, new one added", eff.map(function (r) { return r.key + ":" + (r.cost || ""); }), ["t1:", "p1:45", "rw-x:100"]);
    var teams = [{ key: "t1", title: "A" }, { key: "t2", title: "B" }, { key: "t3", title: "C" }];
    eq("team goal: stored choice", Game.teamGoalFor(teams, "t3", 0).key, "t3");
    eq("team goal: default takes turns by week", Game.teamGoalFor(teams, null, 4).key, "t2");
    eq("team goal: removed choice falls back", Game.teamGoalFor(teams, "gone", 0).key, "t1");
    var reds = Game.redemptionList({
      a: { v: { who: "me", cost: 40, at: 1, fulfilled: true }, ts: 1 },
      b: { v: { who: "anna", cost: 60, at: 2 }, ts: 1 },
      c: { v: { who: "me", cost: 50, at: 3 }, ts: 1 },
      d: { ts: 9 }                                                   // cancelled
    });
    eq("balance: lifetime minus own redemptions", Game.balance(200, reds, "me"), 110);
    eq("balance: cancelled redemption refunds", Game.balance(200, reds, "anna"), 140);
    same("redemptions: outstanding first, newest first", Game.sortRedemptions(reds).map(function (r) { return r.key; }), ["c", "b", "a"]);
  })();

  // sync of the new sections (two-device simulation)
  (function () {
    var a = makeDoc(), b = makeDoc(), cloud = {};
    // A changes a reward and adds one; B receives
    a.rewards = { "p-pick-film": { v: { kind: "personal", title: "Pick the film", cost: 45 }, ts: 100 } };
    converge(a, b, cloud);
    eq("sync rewards: B receives the edit", b.rewards["p-pick-film"].v.cost, 45);
    // B deletes it (tombstone); A sees the deletion
    b.rewards["p-pick-film"] = { v: null, ts: 200 };
    converge(a, b, cloud);
    assert("sync rewards: A sees the tombstone", !a.rewards["p-pick-film"].v);
    assert("sync rewards: deleted reward gone from A's list",
      !Game.effectiveRewards(Seed.REWARDS, a.rewards).some(function (r) { return r.key === "p-pick-film"; }));

    // same-field conflict on the week's team goal: newer wins on both
    a.teamGoals = { "20261116": { v: "team-film", ts: 300 } };
    b.teamGoals = b.teamGoals || {};
    b.teamGoals["20261116"] = { v: "team-meal-out", ts: 301 };
    converge(a, b, cloud);
    eq("sync team goal conflict: A -> newer", a.teamGoals["20261116"].v, "team-meal-out");
    eq("sync team goal conflict: B -> newer", b.teamGoals["20261116"].v, "team-meal-out");

    // A redeems; B gets a 'redeem' change to announce, then marks it given
    a.redemptions = { "r-1": { v: { who: "me", key: "p-takeaway", title: "Choose the takeaway", cost: 60, at: 400, fulfilled: false }, ts: 400 } };
    syncRound(a, cloud);
    var ch = Merge.mergeDocInto(b, cloud);
    assert("sync redeem: B is told 'redeem' with who and title",
      ch.some(function (c) { return c.kind === "redeem" && c.who === "me" && c.title === "Choose the takeaway"; }));
    var rec = JSON.parse(JSON.stringify(b.redemptions["r-1"].v));
    rec.fulfilled = true;
    b.redemptions["r-1"] = { v: rec, ts: 500 };
    syncRound(b, cloud);
    var ch2 = Merge.mergeDocInto(a, cloud);
    assert("sync redeem: A is told it was given", ch2.some(function (c) { return c.kind === "redeemFulfilled" && c.value === true; }));
    eq("sync redeem: A sees fulfilled", a.redemptions["r-1"].v.fulfilled, true);

    // done field carries pts and owner through sync
    a.overrides["20261116|load-dishwasher|0"] = { done: { v: true, by: "me", at: 600, ts: 600, pts: 2, owner: "me" } };
    converge(a, b, cloud);
    eq("sync done: points travel with the tick", b.overrides["20261116|load-dishwasher|0"].done.pts, 2);
  })();

  // an old-shaped doc (no game sections) loads and merges without breaking
  (function () {
    var old = { settings: { meName: { v: "Alex", ts: 5 } }, overrides: {}, officeDays: {}, customTemplates: {}, templateEdits: {} };
    var n = RooHQ.Store.normalize(old);
    assert("normalize: old doc gains empty game sections", n.rewards && n.teamGoals && n.redemptions &&
      !Object.keys(n.rewards).length);
    var n2 = RooHQ.Store.normalize({ redemptions: { x: { v: { who: "me", cost: 1 }, ts: 1 } } });
    eq("normalize: keeps redemptions", n2.redemptions.x.v.cost, 1);
    var bare = makeDoc();
    var ok = true;
    try { Merge.mergeDocInto(bare, { rewards: { k: { v: { kind: "team", title: "T" }, ts: 1 } } }); Merge.newerFields(bare, {}); }
    catch (e) { ok = false; }
    assert("merge: doc without game sections takes them in", ok && bare.rewards.k.v.title === "T");
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
