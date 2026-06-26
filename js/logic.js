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

  function mod(n, m) { return ((n % m) + m) % m; }

  // 2001-01-01 was a Monday — reference point for week cadences and the "alternate" stagger.
  var REFERENCE_MONDAY = new Date(2001, 0, 1);

  // Whole weeks since the reference Monday (drives fortnightly/monthly/quarterly cadences).
  function weekIndex(monday) {
    return Math.floor(daysBetween(REFERENCE_MONDAY, monday) / 7);
  }

  function parity(monday) {
    return mod(weekIndex(monday), 2);
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

  // Which days (0=Mon…6=Sun) a template lands on in the week with index `W`.
  // Cadences: daily (every day), weekly (its day every week), fortnightly (its day every other
  // week), monthly (one week in four), quarterly (one week in thirteen). `slot` picks which of
  // those weeks. Falls back to the old `schedule` field for any legacy custom chores.
  function occurrenceDays(tpl, W) {
    var c = tpl.cadence;
    if (!c && tpl.schedule) {
      switch (tpl.schedule) {
        case "daily": return [0, 1, 2, 3, 4, 5, 6];
        case "weekday": return [0, 1, 2, 3, 4];
        case "monday": return [0]; case "tuesday": return [1]; case "wednesday": return [2];
        case "thursday": return [3]; case "friday": return [4]; case "saturday": return [5];
        case "sunday": return [6]; case "weekly-in-season": return [5];
        default: return [];
      }
    }
    var di = (typeof tpl.dayIndex === "number") ? tpl.dayIndex : 5;
    var slot = tpl.slot || 0;
    switch (c) {
      case "daily":       return [0, 1, 2, 3, 4, 5, 6];
      case "weekday":     return [0, 1, 2, 3, 4];
      case "weekly":      return [di];
      case "fortnightly": return (mod(W, 2) === mod(slot, 2)) ? [di] : [];
      case "monthly":     return (mod(W, 4) === mod(slot, 4)) ? [di] : [];
      case "quarterly":   return (mod(W, 13) === mod(slot, 13)) ? [di] : [];
      default:            return [];
    }
  }

  // Generate the chores for the week starting on `monday`.
  // `customTemplates` (optional) are user-created chores that sync between phones.
  function generateWeek(monday, customTemplates) {
    var W = weekIndex(monday);
    var p = mod(W, 2);
    var st = stamp(monday);
    var out = [];
    var templates = (customTemplates && customTemplates.length)
      ? Seed.TEMPLATES.concat(customTemplates)
      : Seed.TEMPLATES;
    templates.forEach(function (tpl) {
      // A 'rotation' array varies the owner week to week (mixes up who does what),
      // while staying balanced. Falls back to defaultAssignee / alternate resolution.
      var rotated = (tpl.rotation && tpl.rotation.length)
        ? tpl.rotation[mod(W, tpl.rotation.length)]
        : null;
      occurrenceDays(tpl, W).forEach(function (di) {
        out.push({
          templateKey: tpl.key,
          title: tpl.title,
          category: tpl.category,
          timeOfDay: tpl.timeOfDay || "anytime",
          dayIndex: di,
          assignee: rotated || resolveAssignee(tpl.defaultAssignee, di, p),
          locked: !!tpl.locked,
          swappable: tpl.swappable !== false,
          seasonal: !!tpl.seasonal,
          notes: tpl.notes || null,
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
        ? "Locked to Anna — Alex's grass allergy."
        : "This chore is locked.";
    }
    if (!chore.swappable) return "This chore can't be reassigned.";
    return null;
  }

  // Seasonal chores (grass edging) can be hidden by the in-season toggle.
  function isHiddenSeasonal(chore, inSeason) {
    return !!chore.seasonal && !inSeason;
  }

  function nextInCycle(role) {
    return role === "me" ? "anna" : (role === "anna" ? "both" : "me");
  }

  RooHQ.Logic = {
    dayIndexOf: dayIndexOf,
    mondayStart: mondayStart,
    stamp: stamp,
    parity: parity,
    weekIndex: weekIndex,
    mod: mod,
    dateForDayIndex: dateForDayIndex,
    addWeeks: addWeeks,
    resolveAssignee: resolveAssignee,
    occurrenceDays: occurrenceDays,
    generateWeek: generateWeek,
    canSwap: canSwap,
    lockReason: lockReason,
    isHiddenSeasonal: isHiddenSeasonal,
    isHiddenMow: isHiddenSeasonal,  // back-compat alias
    nextInCycle: nextInCycle
  };
})(window.RooHQ);
