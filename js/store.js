/*
 * store.js — Roo HQ
 * Local-first state. The base plan is generated from the seed on each device; we persist only
 * the *diffs*: per-chore overrides (who's it / done) keyed by a deterministic instance id, plus
 * a few settings and Anna's office days. Every field carries a timestamp so two phones merge
 * cleanly (last edit to a given field wins). This is also exactly what gets synced.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";

  var LS_KEY = "roohq.doc.v1";

  function now() { return Date.now(); }

  function emptyDoc() {
    return {
      settings: {
        meName: { v: "Me", ts: 0 },
        annaName: { v: "Anna", ts: 0 },
        mowingInSeason: { v: true, ts: 0 }
      },
      overrides: {},   // instanceID -> { assignee:{v,ts}, done:{v,by,at,ts} }
      officeDays: {}    // yyyymmdd -> { v:bool, ts }
    };
  }

  var doc = emptyDoc();
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) doc = normalize(JSON.parse(raw));
    } catch (e) { /* fall back to empty */ }
    return doc;
  }

  function normalize(d) {
    var base = emptyDoc();
    if (!d || typeof d !== "object") return base;
    if (d.settings) {
      ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
        if (d.settings[k] && typeof d.settings[k].ts === "number") base.settings[k] = d.settings[k];
      });
    }
    if (d.overrides && typeof d.overrides === "object") base.overrides = d.overrides;
    if (d.officeDays && typeof d.officeDays === "object") base.officeDays = d.officeDays;
    return base;
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch (e) {}
  }

  function emit(source, patches) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i]({ source: source, patches: patches || [] }); } catch (e) {}
    }
  }

  // --- reads -------------------------------------------------------------

  function name(role) {
    if (role === "me") return doc.settings.meName.v || "Me";
    if (role === "anna") return doc.settings.annaName.v || "Anna";
    if (role === "both") return "Both";
    return role;
  }

  function mowingInSeason() { return !!doc.settings.mowingInSeason.v; }

  function assigneeFor(chore) {
    var o = doc.overrides[chore.instanceID];
    if (o && o.assignee && typeof o.assignee.v === "string") return o.assignee.v;
    return chore.assignee;
  }

  function doneInfo(instanceID) {
    var o = doc.overrides[instanceID];
    if (o && o.done) return { done: !!o.done.v, by: o.done.by || null, at: o.done.at || null };
    return { done: false, by: null, at: null };
  }

  function isDone(instanceID) { return doneInfo(instanceID).done; }

  function isOfficeDay(ymd) {
    var f = doc.officeDays[ymd];
    return !!(f && f.v);
  }

  // --- writes (local) ----------------------------------------------------

  function setName(role, value) {
    var key = role === "me" ? "meName" : "annaName";
    var clean = (value || "").trim();
    var field = { v: clean || (role === "me" ? "Me" : "Anna"), ts: now() };
    doc.settings[key] = field;
    save();
    var patches = [{ path: "settings/" + key, value: field }];
    emit("local", patches);
  }

  function setMowingInSeason(on) {
    var field = { v: !!on, ts: now() };
    doc.settings.mowingInSeason = field;
    save();
    emit("local", [{ path: "settings/mowingInSeason", value: field }]);
  }

  function setAssignee(instanceID, role) {
    var o = doc.overrides[instanceID] || (doc.overrides[instanceID] = {});
    o.assignee = { v: role, ts: now() };
    save();
    emit("local", [{ path: "overrides/" + instanceID + "/assignee", value: o.assignee }]);
  }

  function setDone(instanceID, done, by) {
    var o = doc.overrides[instanceID] || (doc.overrides[instanceID] = {});
    o.done = { v: !!done, by: done ? (by || null) : null, at: done ? now() : null, ts: now() };
    save();
    emit("local", [{ path: "overrides/" + instanceID + "/done", value: o.done }]);
  }

  function setOfficeDay(ymd, on) {
    var field = { v: !!on, ts: now() };
    doc.officeDays[ymd] = field;
    save();
    emit("local", [{ path: "officeDays/" + ymd, value: field }]);
  }

  // --- merge (remote) ----------------------------------------------------

  // Keep whichever field has the larger ts. Returns true if local changed.
  function mergeField(container, key, remote) {
    if (!remote || typeof remote.ts !== "number") return false;
    var local = container[key];
    if (!local || remote.ts > local.ts) {
      container[key] = remote;
      return true;
    }
    return false;
  }

  // Merge an incoming remote doc; returns true if anything changed locally.
  function mergeRemote(remote) {
    if (!remote || typeof remote !== "object") return false;
    var changed = false;

    if (remote.settings) {
      ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
        if (mergeField(doc.settings, k, remote.settings[k])) changed = true;
      });
    }
    if (remote.overrides) {
      Object.keys(remote.overrides).forEach(function (id) {
        var ro = remote.overrides[id];
        if (!ro) return;
        var lo = doc.overrides[id] || (doc.overrides[id] = {});
        if (ro.assignee && mergeField(lo, "assignee", ro.assignee)) changed = true;
        if (ro.done && mergeField(lo, "done", ro.done)) changed = true;
      });
    }
    if (remote.officeDays) {
      Object.keys(remote.officeDays).forEach(function (ymd) {
        if (mergeField(doc.officeDays, ymd, remote.officeDays[ymd])) changed = true;
      });
    }

    if (changed) { save(); emit("remote", []); }
    return changed;
  }

  // --- backup / reset ----------------------------------------------------

  function exportJSON() {
    return JSON.stringify({ app: "Roo HQ", exportedAt: new Date().toISOString(), doc: doc }, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var incoming = parsed && parsed.doc ? parsed.doc : parsed;
    var changed = mergeRemote(incoming);
    if (!changed) { save(); emit("local", []); } // still refresh UI
    // Importing should also broadcast to the cloud — emit the whole doc as local patches.
    emit("local", docAsPatches());
    return true;
  }

  function reset() {
    doc = emptyDoc();
    save();
    emit("local", docAsPatches());
  }

  // Whole doc expressed as RTDB paths (used by import and first cloud push).
  function docAsPatches() {
    var patches = [];
    ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
      patches.push({ path: "settings/" + k, value: doc.settings[k] });
    });
    Object.keys(doc.overrides).forEach(function (id) {
      var o = doc.overrides[id];
      if (o.assignee) patches.push({ path: "overrides/" + id + "/assignee", value: o.assignee });
      if (o.done) patches.push({ path: "overrides/" + id + "/done", value: o.done });
    });
    Object.keys(doc.officeDays).forEach(function (ymd) {
      patches.push({ path: "officeDays/" + ymd, value: doc.officeDays[ymd] });
    });
    return patches;
  }

  function getDoc() { return doc; }
  function onChange(fn) { listeners.push(fn); }

  RooHQ.Store = {
    load: load,
    save: save,
    name: name,
    mowingInSeason: mowingInSeason,
    assigneeFor: assigneeFor,
    isDone: isDone,
    doneInfo: doneInfo,
    isOfficeDay: isOfficeDay,
    setName: setName,
    setMowingInSeason: setMowingInSeason,
    setAssignee: setAssignee,
    setDone: setDone,
    setOfficeDay: setOfficeDay,
    mergeRemote: mergeRemote,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    docAsPatches: docAsPatches,
    getDoc: getDoc,
    onChange: onChange
  };
})(window.RooHQ);
