/*
 * sync.js — Roo HQ
 * Live sync over Firebase Realtime Database, keyed by a shared "household code".
 *
 * Model: we never sync the whole plan — only the small diff doc (overrides, settings, office
 * days), each field timestamped. On every remote update we merge by timestamp (newest wins);
 * we push our own newer fields back. This converges even with offline edits on both phones.
 *
 * Degrades gracefully: if Firebase isn't configured or the SDK didn't load (e.g. offline /
 * opened from a file), the app just runs locally.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";
  var Store = RooHQ.Store;

  var CODE_KEY = "roohq.household";
  var cbs = { onStatus: function () {}, onRemote: function () {} };
  var ref = null;
  var infoRef = null;
  var code = null;
  var attached = false;
  var firstSnapshot = true;    // suppress "what changed" toasts on the initial pull
  var statusValue = "local";   // local | connecting | connected | error

  function isConfigured() {
    return typeof firebase !== "undefined" &&
           RooHQ.firebaseConfig &&
           !!RooHQ.firebaseConfig.databaseURL;
  }

  function ensureApp() {
    if (!isConfigured()) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(RooHQ.firebaseConfig);
      return true;
    } catch (e) {
      return false;
    }
  }

  function setStatus(s) {
    if (s === statusValue) return;
    statusValue = s;
    cbs.onStatus(s);
  }

  function init(callbacks) {
    if (callbacks) cbs = callbacks;
    // Push local edits to the cloud as they happen.
    Store.onChange(function (ev) {
      if (ev.source === "local" && attached && ref && ev.patches && ev.patches.length) {
        pushPatches(ev.patches);
      }
    });
    cbs.onStatus(statusValue);
  }

  function autoConnect() {
    var saved = localStorage.getItem(CODE_KEY);
    if (saved && isConfigured()) connect(saved);
  }

  function connect(householdCode) {
    if (!isConfigured()) { setStatus("error"); return; }
    if (!ensureApp()) { setStatus("error"); return; }

    disconnect(true);
    code = String(householdCode).trim();
    if (!code) { setStatus("error"); return; }
    localStorage.setItem(CODE_KEY, code);
    attached = true;
    firstSnapshot = true;
    setStatus("connecting");

    var db = firebase.database();
    ref = db.ref("households/" + code);
    ref.on("value", onValue, onError);

    // Reflect online/offline.
    infoRef = db.ref(".info/connected");
    infoRef.on("value", function (snap) {
      if (!attached) return;
      setStatus(snap.val() ? "connected" : "connecting");
    });
  }

  function disconnect(silent) {
    if (ref) { ref.off(); ref = null; }
    if (infoRef) { infoRef.off(); infoRef = null; }
    attached = false;
    if (!silent) {
      localStorage.removeItem(CODE_KEY);
      code = null;
      setStatus("local");
    }
  }

  function onValue(snapshot) {
    var remote = snapshot.val() || {};
    setStatus("connected");
    Store.mergeRemote(remote, !firstSnapshot); // announce only incremental changes
    firstSnapshot = false;
    pushLocalNewer(remote);                    // send anything of ours that's newer
  }

  function onError(err) {
    setStatus("error");
    if (window.console) console.warn("Roo HQ sync error:", err && err.message);
  }

  function pushPatches(patches) {
    if (!ref) return;
    var updates = {};
    patches.forEach(function (p) { updates[p.path] = p.value; });
    if (Object.keys(updates).length) ref.update(updates).catch(function () {});
  }

  // Send any local field that's newer than (or missing from) the remote doc.
  function pushLocalNewer(remote) {
    if (!ref) return;
    var up = RooHQ.Merge.newerFields(Store.getDoc(), remote || {});
    if (Object.keys(up).length) ref.update(up).catch(function () {});
  }

  RooHQ.Sync = {
    init: init,
    autoConnect: autoConnect,
    connect: connect,
    disconnect: disconnect,
    isConfigured: isConfigured,
    status: function () { return statusValue; },
    currentCode: function () { return code || localStorage.getItem(CODE_KEY) || ""; }
  };
})(window.RooHQ);
