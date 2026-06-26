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
        meName: { v: "Alex", ts: 0 },
        annaName: { v: "Anna", ts: 0 },
        mowingInSeason: { v: true, ts: 0 }
      },
      overrides: {},        // instanceID -> { assignee:{v,ts}, done:{v,by,at,ts} }
      officeDays: {},       // yyyymmdd -> { v:bool, ts }
      customTemplates: {},  // key -> { v: templateObject | null (deleted), ts }
      templateEdits: {}     // seed key -> { v: { ...patched fields, deleted? }, ts }
    };
  }

  var doc = emptyDoc();
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      doc = raw ? normalize(JSON.parse(raw)) : emptyDoc();
    } catch (e) { doc = emptyDoc(); }
    return doc;
  }

  function normalize(d) {
    var base = emptyDoc();
    if (!d || typeof d !== "object") return base;
    if (d.settings) {
      ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
        // Only adopt explicitly-set values (ts > 0). A ts:0 entry is just the old default,
        // so we fall back to the current code default — this lets default renames roll out.
        if (d.settings[k] && typeof d.settings[k].ts === "number" && d.settings[k].ts > 0) {
          base.settings[k] = d.settings[k];
        }
      });
    }
    if (d.overrides && typeof d.overrides === "object") base.overrides = d.overrides;
    if (d.officeDays && typeof d.officeDays === "object") base.officeDays = d.officeDays;
    if (d.customTemplates && typeof d.customTemplates === "object") base.customTemplates = d.customTemplates;
    if (d.templateEdits && typeof d.templateEdits === "object") base.templateEdits = d.templateEdits;
    return base;
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch (e) {}
  }

  function emit(source, patches, extra) {
    var ev = { source: source, patches: patches || [] };
    if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) ev[k] = extra[k]; } }
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](ev); } catch (e) {}
    }
  }

  // --- reads -------------------------------------------------------------

  function name(role) {
    if (role === "me") return doc.settings.meName.v || "Alex";
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
    var field = { v: clean || (role === "me" ? "Alex" : "Anna"), ts: now() };
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

  // --- custom chores (user-created, shared) ------------------------------

  // Active custom templates as plain template objects (with their key), deleted ones omitted.
  function getCustomTemplates() {
    var out = [];
    Object.keys(doc.customTemplates).forEach(function (key) {
      var f = doc.customTemplates[key];
      if (f && f.v) {
        var tpl = {};
        for (var k in f.v) { if (f.v.hasOwnProperty(k)) tpl[k] = f.v[k]; }
        tpl.key = key;
        tpl.locked = false;
        tpl.swappable = true;
        out.push(tpl);
      }
    });
    return out;
  }

  function getCustomTemplate(key) {
    var f = doc.customTemplates[key];
    return f && f.v ? f.v : null;
  }

  function setCustomTemplate(key, tpl) {
    var field = { v: tpl, ts: now() };
    doc.customTemplates[key] = field;
    save();
    emit("local", [{ path: "customTemplates/" + key, value: field }]);
  }

  function deleteCustomTemplate(key) {
    var field = { v: null, ts: now() };          // tombstone so the delete syncs
    doc.customTemplates[key] = field;
    save();
    emit("local", [{ path: "customTemplates/" + key, value: field }]);
  }

  // --- editing / removing the BUILT-IN (seed) chores ---------------------
  // An edit is a patch of changed fields (or { deleted:true }). All synced.

  function getTemplateEdit(key) {
    var f = doc.templateEdits[key];
    return f && f.v ? f.v : null;
  }

  // The seed templates with edits applied and removed ones dropped.
  function effectiveBaseTemplates() {
    var Seed = RooHQ.Seed;
    var out = [];
    Seed.TEMPLATES.forEach(function (t) {
      var e = getTemplateEdit(t.key);
      if (e && e.deleted) return;                 // user removed it
      if (!e) { out.push(t); return; }
      var m = {};
      for (var k in t) { if (t.hasOwnProperty(k)) m[k] = t[k]; }
      ["title", "category", "cadence", "dayIndex", "timeOfDay", "defaultAssignee", "notes", "slot"].forEach(function (f) {
        if (e[f] !== undefined) m[f] = e[f];
      });
      if (e.defaultAssignee !== undefined) m.rotation = undefined; // manual owner overrides the rotation
      out.push(m);
    });
    return out;
  }

  // Effective template for a key (seed-with-edits or custom).
  function getEffectiveTemplate(key) {
    if (key.indexOf("custom-") === 0) return getCustomTemplate(key);
    var arr = effectiveBaseTemplates();
    for (var i = 0; i < arr.length; i++) { if (arr[i].key === key) return arr[i]; }
    var s = RooHQ.Seed.TEMPLATES.filter(function (t) { return t.key === key; })[0];
    return s || null;
  }

  // Merge `patch` into the stored edit for a seed key (cumulative).
  function setTemplateEdit(key, patch) {
    var prev = (doc.templateEdits[key] && doc.templateEdits[key].v) || {};
    var merged = {};
    for (var a in prev) { if (prev.hasOwnProperty(a)) merged[a] = prev[a]; }
    for (var b in patch) { if (patch.hasOwnProperty(b)) merged[b] = patch[b]; }
    var field = { v: merged, ts: now() };
    doc.templateEdits[key] = field;
    save();
    emit("local", [{ path: "templateEdits/" + key, value: field }]);
  }

  function removeTemplate(key) {
    setTemplateEdit(key, { deleted: true });
  }

  // Bring back any built-in chores that were removed (keeps other edits). Returns count.
  function restoreRemovedTemplates() {
    var n = 0;
    Object.keys(doc.templateEdits).forEach(function (key) {
      var f = doc.templateEdits[key];
      if (f && f.v && f.v.deleted) {
        var v = {};
        for (var k in f.v) { if (f.v.hasOwnProperty(k) && k !== "deleted") v[k] = f.v[k]; }
        doc.templateEdits[key] = { v: v, ts: now() };
        n++;
      }
    });
    if (n) { save(); emit("local", docAsPatches()); }
    return n;
  }

  // --- merge (remote) ----------------------------------------------------

  // Merge an incoming remote doc (delegates to the pure Merge engine).
  // `announce` flags incremental changes that the UI may surface as a toast.
  // Returns the list of changes that were applied.
  function mergeRemote(remote, announce) {
    var changes = RooHQ.Merge.mergeDocInto(doc, remote);
    if (changes.length) {
      save();
      emit("remote", [], { announce: !!announce, changes: changes });
    }
    return changes;
  }

  // --- backup / reset ----------------------------------------------------

  function exportJSON() {
    return JSON.stringify({ app: "Roo HQ", exportedAt: new Date().toISOString(), doc: doc }, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);
    var incoming = parsed && parsed.doc ? parsed.doc : parsed;
    mergeRemote(incoming, false);
    // Refresh the UI and push the merged plan up to the cloud (whole doc as local patches).
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
    Object.keys(doc.customTemplates).forEach(function (key) {
      patches.push({ path: "customTemplates/" + key, value: doc.customTemplates[key] });
    });
    Object.keys(doc.templateEdits).forEach(function (key) {
      patches.push({ path: "templateEdits/" + key, value: doc.templateEdits[key] });
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
    getCustomTemplates: getCustomTemplates,
    getCustomTemplate: getCustomTemplate,
    setCustomTemplate: setCustomTemplate,
    deleteCustomTemplate: deleteCustomTemplate,
    getTemplateEdit: getTemplateEdit,
    effectiveBaseTemplates: effectiveBaseTemplates,
    getEffectiveTemplate: getEffectiveTemplate,
    setTemplateEdit: setTemplateEdit,
    removeTemplate: removeTemplate,
    restoreRemovedTemplates: restoreRemovedTemplates,
    mergeRemote: mergeRemote,
    exportJSON: exportJSON,
    importJSON: importJSON,
    reset: reset,
    docAsPatches: docAsPatches,
    getDoc: getDoc,
    onChange: onChange
  };
})(window.RooHQ);
