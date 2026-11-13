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

  // yyyymmdd -> local midnight Date.
  function dateFromStamp(ymd) {
    ymd = String(ymd);
    return new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
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

  // A clock time "HH:MM", or null if missing or invalid.
  function validTime(t) {
    return (typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) ? t : null;
  }

  // A template's optional "days" list (0=Mon…6=Sun), cleaned up; null when absent or empty.
  // Tolerates the object form Firebase can hand back for arrays.
  function validDays(days) {
    if (!days || typeof days !== "object") return null;
    var list = Array.isArray(days) ? days : Object.keys(days).map(function (k) { return days[k]; });
    var seen = {}, out = [];
    list.forEach(function (d) {
      d = Number(d);
      if (d >= 0 && d <= 6 && Math.floor(d) === d && !seen[d]) { seen[d] = true; out.push(d); }
    });
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : null;
  }

  // Order within a week: by day, then timed chores first (by time), then time of day, then title.
  function ordering(a, b) {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    var ca = validTime(a.time), cb = validTime(b.time);
    if (!!ca !== !!cb) return ca ? -1 : 1;
    if (ca && ca !== cb) return ca < cb ? -1 : 1;
    var ta = Seed.TIME_ORDER[a.timeOfDay], tb = Seed.TIME_ORDER[b.timeOfDay];
    if (ta === undefined) ta = 3;
    if (tb === undefined) tb = 3;
    if (ta !== tb) return ta - tb;
    return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
  }

  // ---- bins: collected every Monday, colours in a fixed rotation (see Seed.BINS) ----

  // The bin collected in the week of `date` (its Monday collection).
  function binFor(date) {
    var weeks = Math.floor(daysBetween(dateFromStamp(Seed.BIN_REFERENCE_MONDAY), mondayStart(date)) / 7);
    return Seed.BINS[mod(weeks, Seed.BINS.length)];
  }

  // Title for the "bin out" chore on `choreDate`: names the colour of the next Monday collection.
  function binTitle(choreDate) {
    var next = new Date(choreDate.getFullYear(), choreDate.getMonth(), choreDate.getDate());
    next.setDate(next.getDate() + (7 - dayIndexOf(next)));
    var b = binFor(next);
    return "Put the " + b.label + " bin out (" + b.type + ")";
  }

  // Which days (0=Mon…6=Sun) a template lands on in the week with index `W`.
  // Cadences: daily (every day), weekly (its day every week), fortnightly (its day every other
  // week), monthly (one week in four), quarterly (one week in thirteen). `slot` picks which of
  // those weeks. An optional `days` list picks the weekdays instead of the cadence default,
  // e.g. Monday to Thursday only. Falls back to the old `schedule` field for legacy custom chores.
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
    var days = validDays(tpl.days);
    switch (c) {
      case "daily":       return days || [0, 1, 2, 3, 4, 5, 6];
      case "weekday":     return days || [0, 1, 2, 3, 4];
      case "weekly":      return days || [di];
      case "fortnightly": return (mod(W, 2) === mod(slot, 2)) ? (days || [di]) : [];
      case "monthly":     return (mod(W, 4) === mod(slot, 4)) ? (days || [di]) : [];
      case "quarterly":   return (mod(W, 13) === mod(slot, 13)) ? (days || [di]) : [];
      default:            return [];
    }
  }

  function minutesOf(tpl) {
    var m = tpl && Number(tpl.minutes);
    return (m > 0) ? m : Seed.DEFAULT_MINUTES;
  }

  // Generate the chores for the week starting on `monday`.
  // `customTemplates` (optional) are user-created chores that sync between phones.
  function generateWeek(monday, customTemplates, baseTemplates) {
    var W = weekIndex(monday);
    var p = mod(W, 2);
    var st = stamp(monday);
    var out = [];
    var base = baseTemplates || Seed.TEMPLATES;   // seed (optionally with user edits/removals applied)
    var templates = (customTemplates && customTemplates.length)
      ? base.concat(customTemplates)
      : base;
    templates.forEach(function (tpl) {
      // A 'rotation' array varies the owner week to week (mixes up who does what),
      // while staying balanced. Falls back to defaultAssignee / alternate resolution.
      var rotated = (tpl.rotation && tpl.rotation.length)
        ? tpl.rotation[mod(W, tpl.rotation.length)]
        : null;
      occurrenceDays(tpl, W).forEach(function (di) {
        var date = dateForDayIndex(monday, di);
        // `startsOn` (yyyymmdd) holds a chore back until that date.
        if (tpl.startsOn && stamp(date) < String(tpl.startsOn)) return;
        out.push({
          templateKey: tpl.key,
          title: tpl.binColour ? binTitle(date) : tpl.title,
          category: tpl.category,
          timeOfDay: tpl.timeOfDay || "anytime",
          time: validTime(tpl.time),
          minutes: minutesOf(tpl),
          core: !!tpl.core,
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

  // ---- Anna's office days (she is out 08:00 to 18:00) ----
  var OFFICE_COVER_BEFORE = "18:00";   // her Roo-care timed before this moves...
  var OFFICE_COVER_TIME = "17:30";     // ...to Alex, at this time

  // One generated chore on a given day: if it is Anna's office day, the chore is Roo-care, assigned
  // to Anna, timed before 18:00, and nobody swapped this instance by hand, it becomes Alex's at
  // 17:30. Returns the chore unchanged or an adjusted copy (flagged `officeCover`).
  function applyOfficeDay(chore, isOfficeDay, manuallySwapped) {
    if (!isOfficeDay || manuallySwapped) return chore;
    var cat = Seed.CATEGORIES[chore.category];
    if (!cat || !cat.rooCare || chore.assignee !== "anna") return chore;
    var t = validTime(chore.time);
    if (!t || t >= OFFICE_COVER_BEFORE) return chore;
    var c = {};
    for (var k in chore) { if (Object.prototype.hasOwnProperty.call(chore, k)) c[k] = chore[k]; }
    c.assignee = "me";
    c.time = OFFICE_COVER_TIME;
    c.officeCover = true;
    return c;
  }

  // The same rule over a generated week.
  //  isOfficeDay(yyyymmdd) -> bool; isSwapped(instanceID) -> bool (a manual owner override exists)
  function applyOfficeDays(chores, monday, isOfficeDay, isSwapped) {
    var flags = {};
    // Office days are Monday to Friday only; a flag on a weekend date is ignored.
    for (var di = 0; di < 7; di++) flags[di] = di <= 4 && !!isOfficeDay(stamp(dateForDayIndex(monday, di)));
    return chores.map(function (c) {
      return flags[c.dayIndex] ? applyOfficeDay(c, true, !!isSwapped(c.instanceID)) : c;
    });
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
    dateFromStamp: dateFromStamp,
    daysBetween: daysBetween,
    parity: parity,
    weekIndex: weekIndex,
    mod: mod,
    dateForDayIndex: dateForDayIndex,
    addWeeks: addWeeks,
    resolveAssignee: resolveAssignee,
    validTime: validTime,
    validDays: validDays,
    ordering: ordering,
    binFor: binFor,
    binTitle: binTitle,
    occurrenceDays: occurrenceDays,
    minutesOf: minutesOf,
    generateWeek: generateWeek,
    applyOfficeDay: applyOfficeDay,
    applyOfficeDays: applyOfficeDays,
    canSwap: canSwap,
    lockReason: lockReason,
    isHiddenSeasonal: isHiddenSeasonal,
    isHiddenMow: isHiddenSeasonal,  // back-compat alias
    nextInCycle: nextInCycle
  };
})(window.RooHQ);
