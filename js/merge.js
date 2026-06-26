/*
 * merge.js — Roo HQ
 * The sync engine, as pure functions so it can be unit-tested without Firebase.
 *
 * Every synced field is { v: value, ts: epoch-ms } (the `done` field also carries by/at).
 * Merging keeps whichever copy has the larger timestamp — a simple, robust last-writer-wins
 * per field. Because both phones generate the same base plan, this is all we ever exchange.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";

  // Keep whichever field has the larger ts. Returns true if `container[key]` changed.
  function mergeField(container, key, remote) {
    if (!remote || typeof remote.ts !== "number") return false;
    var local = container[key];
    if (!local || remote.ts > local.ts) {
      container[key] = remote;
      return true;
    }
    return false;
  }

  // Merge a remote doc into `local` in place. Returns a list of human-describable changes
  // (used to announce what the other phone just did).
  function mergeDocInto(local, remote) {
    var changes = [];
    if (!remote || typeof remote !== "object") return changes;

    if (remote.settings) {
      ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
        if (mergeField(local.settings, k, remote.settings[k])) {
          changes.push({ kind: k === "mowingInSeason" ? "season" : "name", key: k, value: local.settings[k].v });
        }
      });
    }
    if (remote.overrides) {
      Object.keys(remote.overrides).forEach(function (id) {
        var ro = remote.overrides[id];
        if (!ro) return;
        var lo = local.overrides[id] || (local.overrides[id] = {});
        if (ro.assignee && mergeField(lo, "assignee", ro.assignee)) {
          changes.push({ kind: "assignee", id: id, value: lo.assignee.v });
        }
        if (ro.done && mergeField(lo, "done", ro.done)) {
          changes.push({ kind: "done", id: id, value: lo.done.v, by: lo.done.by });
        }
      });
    }
    if (remote.officeDays) {
      Object.keys(remote.officeDays).forEach(function (ymd) {
        if (mergeField(local.officeDays, ymd, remote.officeDays[ymd])) {
          changes.push({ kind: "office", ymd: ymd, value: local.officeDays[ymd].v });
        }
      });
    }
    if (remote.customTemplates) {
      var lct = local.customTemplates || (local.customTemplates = {});
      Object.keys(remote.customTemplates).forEach(function (key) {
        if (mergeField(lct, key, remote.customTemplates[key])) {
          var f = lct[key];
          changes.push({ kind: f.v ? "customAdd" : "customRemove", key: key, title: f.v && f.v.title });
        }
      });
    }
    if (remote.templateEdits) {
      var lte = local.templateEdits || (local.templateEdits = {});
      Object.keys(remote.templateEdits).forEach(function (key) {
        if (mergeField(lte, key, remote.templateEdits[key])) {
          var ef = lte[key];
          var del = ef.v && ef.v.deleted;
          changes.push({ kind: del ? "templateRemove" : "templateEdit", key: key, title: ef.v && ef.v.title });
        }
      });
    }
    return changes;
  }

  // Fields where `local` is strictly newer than `remote` — i.e. what we should push up.
  // Returns an RTDB update map { "path/to/field": fieldObject }.
  function newerFields(local, remote) {
    remote = remote || {};
    var up = {};

    var rs = remote.settings || {};
    ["meName", "annaName", "mowingInSeason"].forEach(function (k) {
      var lf = local.settings[k];
      var rf = rs[k];
      if (lf && lf.ts > 0 && (!rf || lf.ts > rf.ts)) up["settings/" + k] = lf;
    });

    var ro = remote.overrides || {};
    Object.keys(local.overrides).forEach(function (id) {
      var lo = local.overrides[id];
      var r = ro[id] || {};
      if (lo.assignee && (!r.assignee || lo.assignee.ts > r.assignee.ts)) up["overrides/" + id + "/assignee"] = lo.assignee;
      if (lo.done && (!r.done || lo.done.ts > r.done.ts)) up["overrides/" + id + "/done"] = lo.done;
    });

    var rod = remote.officeDays || {};
    Object.keys(local.officeDays).forEach(function (ymd) {
      var lf = local.officeDays[ymd];
      var rf = rod[ymd];
      if (lf && (!rf || lf.ts > rf.ts)) up["officeDays/" + ymd] = lf;
    });

    var rct = remote.customTemplates || {};
    var lct = local.customTemplates || {};
    Object.keys(lct).forEach(function (key) {
      var lf = lct[key];
      var rf = rct[key];
      if (lf && (!rf || lf.ts > rf.ts)) up["customTemplates/" + key] = lf;
    });

    var rte = remote.templateEdits || {};
    var lte = local.templateEdits || {};
    Object.keys(lte).forEach(function (key) {
      var lf = lte[key];
      var rf = rte[key];
      if (lf && (!rf || lf.ts > rf.ts)) up["templateEdits/" + key] = lf;
    });

    return up;
  }

  RooHQ.Merge = {
    mergeField: mergeField,
    mergeDocInto: mergeDocInto,
    newerFields: newerFields
  };
})(window.RooHQ);
