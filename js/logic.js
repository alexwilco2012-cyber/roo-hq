/*
 * logic.js — Roo HQ
 * Pure week maths, generation, swap rules and progress — a faithful port of the iOS domain
 * layer so the two apps behave identically. Uses the device's LOCAL week (both phones are in
 * the same household / time zone, so instance ids line up for sync).
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";
  var Seed = RooHQ.Seed;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // 0 = Monday … 6 = Sunday for a date.
  function dayIndexOf(date) {
    return (date.getDay() + 6) % 7;
  }

  // Local midnight of the Monday of this date's week.
  function mondayStart(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - dayIndexOf(d));
    return d;
  }

  function stamp(d) {
    return "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  // Whole days between two local dates, via UTC midnights so DST never skews it.
  function daysBetween(a, b) {
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  // 2001-01-01 was a Monday — reference point for the fair "alternate" stagger.
  var REFERENCE_MONDAY = new Date(2001, 0, 1);

  function parity(monday) {
    var weeks = Math.floor(daysBetween(REFERENCE_MONDAY, monday) / 7);
    return ((weeks % 2) + 2) % 2;
  }

  function dateForDayIndex(monday, idx) {
    var d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    d.setDate(d.getDate() + idx);
    return d;
  }

  function addWeeks(monday, n) {
    var d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    d.setDate(d.getDate() + n * 7);
    return d;
  }

  // Resolve an "alternate" template to a concrete person, flipping by week parity.
  function resolveAssignee(assignee, dayIndex, parityValue) {
    if (assignee !== "alternate") return assignee;
    return ((dayIndex + parityValue) % 2 === 0) ? "me" : "anna";
  }

  function ordering(a, b) {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    var ta = Seed.TIME_ORDER[a.timeOfDay], tb = Seed.TIME_ORDER[b.timeOfDay];
    if (ta !== tb) return ta - tb;
    return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
  }

  // Generate the base chores for the week starting on `monday`.
  function generateWeek(monday) {
    var p = parity(monday);
    var st = stamp(monday);
    var out = [];
    Seed.TEMPLATES.forEach(function (tpl) {
      var days = Seed.SCHEDULE_DAYS[tpl.schedule] || [];
      days.forEach(function (di) {
        out.push({
          templateKey: tpl.key,
          title: tpl.title,
          category: tpl.category,
          timeOfDay: tpl.timeOfDay,
          dayIndex: di,
          assignee: resolveAssignee(tpl.defaultAssignee, di, p),
          locked: tpl.locked,
          swappable: tpl.swappable,
          notes: tpl.notes,
          instanceID: st + "|" + tpl.key + "|" + di
        });
      });
    });
    out.sort(ordering);
    return out;
  }

  function canSwap(chore) {
    return !chore.locked && chore.swappable;
  }

  function lockReason(chore) {
    if (chore.locked) {
      return chore.category === "garden"
        ? "Locked to Anna — Me's grass allergy."
        : "This chore is locked.";
    }
    if (!chore.swappable) return "This chore can't be reassigned.";
    return null;
  }

  // Only the mow can be hidden, by the seasonal toggle.
  function isHiddenMow(chore, mowingInSeason) {
    return chore.category === "garden" && chore.templateKey === "mow-edge" && !mowingInSeason;
  }

  function nextInCycle(role) {
    return role === "me" ? "anna" : (role === "anna" ? "both" : "me");
  }

  RooHQ.Logic = {
    dayIndexOf: dayIndexOf,
    mondayStart: mondayStart,
    stamp: stamp,
    parity: parity,
    dateForDayIndex: dateForDayIndex,
    addWeeks: addWeeks,
    resolveAssignee: resolveAssignee,
    generateWeek: generateWeek,
    canSwap: canSwap,
    lockReason: lockReason,
    isHiddenMow: isHiddenMow,
    nextInCycle: nextInCycle
  };
})(window.RooHQ);
