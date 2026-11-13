/*
 * game.js — Roo HQ
 * The game layer as pure functions: points, credit, streaks, team target, levels, rewards and
 * balances. Nothing here reads storage; callers pass in lookups, so it is all unit-testable.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";
  var Seed = RooHQ.Seed, Logic = RooHQ.Logic;
  var PEOPLE = ["me", "anna"];

  // Points for a chore: one per 5 minutes, at least 1.
  function points(minutes) {
    var m = Number(minutes);
    if (!(m > 0)) m = Seed.DEFAULT_MINUTES;
    return Math.max(1, Math.round(m / 5));
  }

  // Who gets the points for a done field. `owner` is who the chore was assigned to (stored on
  // the done field at tick time, or looked up for old data).
  //  - a "both" chore credits both people
  //  - otherwise the person who ticked it (done.by)
  //  - old data without `by` credits the assignee
  function creditFor(done, owner) {
    if (!done || !done.v) return [];
    var asg = done.owner || owner;
    if (asg === "both") return PEOPLE.slice();
    if (done.by === "me" || done.by === "anna") return [done.by];
    if (asg === "me" || asg === "anna") return [asg];
    return [];
  }

  // Sum points from the overrides map.
  //  opts.prefix   — only instance ids starting with "<prefix>|" (a week stamp), or all if absent
  //  opts.ptsOf(id)      — points for an old done field that has no `pts`
  //  opts.assigneeOf(id) — assignee for an old done field that has no `owner`
  // Returns { me, anna, team } — `team` counts each done chore once.
  function tally(overrides, opts) {
    opts = opts || {};
    var out = { me: 0, anna: 0, team: 0 };
    var pre = opts.prefix ? opts.prefix + "|" : null;
    Object.keys(overrides || {}).forEach(function (id) {
      if (pre && id.indexOf(pre) !== 0) return;
      var o = overrides[id];
      var d = o && o.done;
      if (!d || !d.v) return;
      var pts = (typeof d.pts === "number") ? d.pts : (opts.ptsOf ? opts.ptsOf(id) : points());
      var who = creditFor(d, d.owner || (opts.assigneeOf ? opts.assigneeOf(id) : null));
      who.forEach(function (p) { out[p] += pts; });
      out.team += pts;
    });
    return out;
  }

  function isMine(assignee, person) {
    return assignee === person || assignee === "both";
  }

  // Core chores in a list that belong to `person` (their own plus "both").
  function coreFor(chores, person, assigneeOf) {
    return chores.filter(function (c) { return c.core && isMine(assigneeOf(c), person); });
  }

  // A day is kept when every core chore of `person` that day is done (none counts as kept).
  function dayKept(chores, person, assigneeOf, isDone) {
    return coreFor(chores, person, assigneeOf).every(function (c) { return isDone(c.instanceID); });
  }

  // Consecutive kept days for `person`, ending today. Today adds one once complete but does
  // not break the run while incomplete. Walks back from yesterday, at most `maxDays` days.
  //  weekFn(monday) -> that week's chores (already without hidden seasonal chores)
  function streak(person, today, weekFn, assigneeOf, isDone, maxDays) {
    if (maxDays == null) maxDays = 60;
    var cache = {};
    function choresOn(date) {
      var mon = Logic.mondayStart(date);
      var st = Logic.stamp(mon);
      if (!cache[st]) cache[st] = weekFn(mon) || [];
      var di = Logic.dayIndexOf(date);
      return cache[st].filter(function (c) { return c.dayIndex === di; });
    }
    var n = dayKept(choresOn(today), person, assigneeOf, isDone) ? 1 : 0;
    for (var i = 1; i <= maxDays; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (!dayKept(choresOn(d), person, assigneeOf, isDone)) break;
      n++;
    }
    return n;
  }

  // Team target for a week: points of every core chore scheduled (a "both" chore counts once).
  function teamTarget(chores) {
    var t = 0;
    chores.forEach(function (c) { if (c.core) t += points(c.minutes); });
    return t;
  }

  // Level from lifetime points: floor(lifetime / 250) + 1, with progress to the next level.
  function level(lifetime) {
    var per = Seed.POINTS_PER_LEVEL;
    var lp = Math.max(0, lifetime || 0);
    var into = lp % per;
    return { level: Math.floor(lp / per) + 1, into: into, per: per, toNext: per - into, pct: Math.round(into / per * 100) };
  }

  // ---- rewards ----

  // Effective rewards: seed defaults overlaid by the synced `rewards` section
  // (key -> { v: reward | null, ts }). A field without a value is a deletion.
  function effectiveRewards(seedRewards, docRewards) {
    docRewards = docRewards || {};
    var out = [], seen = {};
    (seedRewards || []).forEach(function (r) {
      seen[r.key] = true;
      var f = docRewards[r.key];
      if (f && typeof f.ts === "number") {
        if (f.v) out.push(withKey(f.v, r.key));
        return;
      }
      out.push(withKey(r, r.key));
    });
    Object.keys(docRewards).sort().forEach(function (key) {
      if (seen[key]) return;
      var f = docRewards[key];
      if (f && f.v) out.push(withKey(f.v, key));
    });
    return out.filter(function (r) { return r.kind === "team" || r.kind === "personal"; });
  }

  function withKey(obj, key) {
    var r = {};
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) r[k] = obj[k]; }
    r.key = key;
    if (r.kind === "personal") r.cost = Math.max(1, Math.round(Number(r.cost) || 0));
    return r;
  }

  // Which team reward a week plays for: the stored choice if it still exists, otherwise the
  // team rewards take turns by week.
  function teamGoalFor(teamRewards, chosenKey, weekIdx) {
    if (!teamRewards.length) return null;
    for (var i = 0; i < teamRewards.length; i++) {
      if (teamRewards[i].key === chosenKey) return teamRewards[i];
    }
    return teamRewards[Logic.mod(weekIdx || 0, teamRewards.length)];
  }

  // Active redemptions (key -> { v: record | null, ts }) as a list with ids.
  function redemptionList(docRedemptions) {
    var out = [];
    Object.keys(docRedemptions || {}).forEach(function (id) {
      var f = docRedemptions[id];
      if (f && f.v) out.push(withKey(f.v, id));
    });
    return out;
  }

  // Points spent by `person`.
  function spent(redemptions, person) {
    var s = 0;
    redemptions.forEach(function (r) { if (r.who === person) s += Number(r.cost) || 0; });
    return s;
  }

  // Spendable balance = lifetime points minus the cost of that person's redemptions.
  function balance(lifetime, redemptions, person) {
    return (lifetime || 0) - spent(redemptions, person);
  }

  // Outstanding first, then fulfilled; newest first within each.
  function sortRedemptions(list) {
    return list.slice().sort(function (a, b) {
      if (!!a.fulfilled !== !!b.fulfilled) return a.fulfilled ? 1 : -1;
      return (b.at || 0) - (a.at || 0);
    });
  }

  RooHQ.Game = {
    PEOPLE: PEOPLE,
    points: points,
    creditFor: creditFor,
    tally: tally,
    coreFor: coreFor,
    dayKept: dayKept,
    streak: streak,
    teamTarget: teamTarget,
    level: level,
    effectiveRewards: effectiveRewards,
    teamGoalFor: teamGoalFor,
    redemptionList: redemptionList,
    spent: spent,
    balance: balance,
    sortRedemptions: sortRedemptions
  };
})(window.RooHQ);
