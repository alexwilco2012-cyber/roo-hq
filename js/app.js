/*
 * app.js — Roo HQ
 * Rendering + interactions: the weekly view, one-tap swapping, completion, week navigation,
 * settings, backup. Talks to Store (state) and Sync (cloud). Re-renders on any state change.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";
  var Seed = RooHQ.Seed, Logic = RooHQ.Logic, Store = RooHQ.Store, Sync = RooHQ.Sync;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var currentMonday;
  var choreMap = {};       // instanceID -> chore (current week)
  var lastStamp = null;    // to decide when to refocus "today"
  var currentFilter = "all"; // all | me | anna
  var els = {};

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function colorVar(role) { return "var(--" + (role === "both" ? "both" : role) + ")"; }
  function initialOf(name, fallback) {
    var t = (name || "").trim();
    return t ? t.charAt(0).toUpperCase() : fallback;
  }

  // ---------- init ----------
  function init() {
    Store.load();
    currentMonday = Logic.mondayStart(new Date());
    cacheEls();
    wireTopbar();
    wireSettings();
    wireChoreForm();

    Store.onChange(function (ev) {
      render();
      if (ev && ev.source === "remote" && ev.announce) {
        var msg = describeChanges(ev.changes);
        if (msg) toast(msg);
      }
    });

    Sync.init({ onStatus: onSyncStatus });
    Sync.autoConnect();

    render();
    registerServiceWorker();
  }

  function cacheEls() {
    ["days", "weekRange", "weekSub", "weekProgressLabel", "weekProgressFill", "weekProgressScope",
     "filterRow", "prevWeek", "nextWeek", "weekLabelBtn", "settingsBtn", "syncChip", "syncLabel",
     "settingsSheet", "meName", "annaName", "meAvatar", "annaAvatar", "seasonToggle",
     "householdCode", "connectBtn", "disconnectBtn", "randomCodeBtn", "syncStatus", "firebaseHint",
     "exportBtn", "importBtn", "importFile", "resetBtn", "rulesList", "gymMe", "gymAnna", "toast",
     "addChoreBtn", "choreSheet", "choreSheetTitle", "choreTitle", "choreCategory", "choreSchedule",
     "choreTime", "choreWho", "choreNotes", "saveChoreBtn", "deleteChoreBtn"
    ].forEach(function (id) { els[id] = $(id); });
  }

  // ---------- render ----------
  function render() {
    renderFilters();

    var chores = Logic.generateWeek(currentMonday, Store.getCustomTemplates()).filter(function (c) {
      if (Logic.isHiddenMow(c, Store.mowingInSeason())) return false;
      return matchesFilter(Store.assigneeFor(c));
    });
    choreMap = {};
    chores.forEach(function (c) { choreMap[c.instanceID] = c; });

    var thisWeek = Logic.stamp(currentMonday) === Logic.stamp(Logic.mondayStart(new Date()));
    els.weekRange.textContent = weekRangeLabel();
    els.weekSub.textContent = thisWeek ? "This week" : "Plan";
    els.weekProgressScope.textContent = currentFilter === "all"
      ? "This week"
      : Store.name(currentFilter) + "'s chores";

    // overall progress
    var done = 0;
    chores.forEach(function (c) { if (Store.isDone(c.instanceID)) done++; });
    var total = chores.length;
    els.weekProgressLabel.textContent = (total > 0 && done === total) ? "All done 🎉" : (done + "/" + total);
    els.weekProgressFill.style.width = (total ? Math.round(done / total * 100) : 0) + "%";

    // group by day
    var byDay = {};
    chores.forEach(function (c) { (byDay[c.dayIndex] = byDay[c.dayIndex] || []).push(c); });
    var days = Object.keys(byDay).map(Number).sort(function (a, b) { return a - b; });

    var todayIdx = thisWeek ? Logic.dayIndexOf(new Date()) : -1;
    var html = "";
    if (!days.length) {
      html = '<div class="empty"><div class="big">🐾</div>Nothing scheduled this week.</div>';
    }
    days.forEach(function (di) {
      html += dayHTML(di, byDay[di], todayIdx === di);
    });
    els.days.innerHTML = html;

    // focus today when the week changes
    if (thisWeek && lastStamp !== Logic.stamp(currentMonday)) {
      var el = $("day-" + todayIdx);
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    }
    lastStamp = Logic.stamp(currentMonday);
  }

  function dayHTML(di, items, isToday) {
    items = items.slice().sort(function (a, b) {
      var ta = Seed.TIME_ORDER[a.timeOfDay], tb = Seed.TIME_ORDER[b.timeOfDay];
      if (ta !== tb) return ta - tb;
      return a.title < b.title ? -1 : 1;
    });

    var dayDone = 0;
    items.forEach(function (c) { if (Store.isDone(c.instanceID)) dayDone++; });
    var complete = items.length > 0 && dayDone === items.length;

    var ymd = Logic.stamp(Logic.dateForDayIndex(currentMonday, di));
    var officeOn = Store.isOfficeDay(ymd);

    var h = "";
    h += '<div class="day-head" id="day-' + di + '">';
    h += '<div class="day-title"><b>' + Seed.DAY_FULL[di] + '</b><small>' + dayDateLabel(di) + '</small></div>';
    if (isToday) h += '<span class="today-pill">Today</span>';
    h += '<div class="day-spacer"></div>';
    h += '<button class="office-btn ' + (officeOn ? "on" : "") + '" data-act="office" data-di="' + di +
         '" aria-label="Toggle ' + esc(Store.name("anna")) + ' office day">💼</button>';
    h += '<div class="day-progress">' + dayDone + "/" + items.length + (complete ? " ✓" : "") + "</div>";
    h += "</div>";

    if (officeOn) {
      h += '<div class="office-banner"><span class="ico">🚶</span><span>' +
           esc(Store.name("anna")) + "'s in Aberdeen — both out. " + esc(Store.name("me")) +
           " does a short morning walk before work, and book a midday dog walker for Roo.</span></div>";
    }

    h += '<div class="day-chores">';
    items.forEach(function (c) { h += choreHTML(c); });
    h += "</div>";
    return h;
  }

  function choreHTML(c) {
    var assignee = Store.assigneeFor(c);
    var done = Store.isDone(c.instanceID);
    var cat = Seed.CATEGORIES[c.category] || { label: c.category, icon: "•" };
    var ownerCol = colorVar(assignee);

    var isCustom = c.templateKey.indexOf("custom-") === 0;
    var h = '<article class="chore ' + (done ? "done" : "") + (cat.rooCare ? " roo" : "") +
            '" style="--owner:' + ownerCol + '">';

    if (isCustom) {
      h += '<button class="edit-btn" data-act="edit" data-key="' + c.templateKey +
           '" aria-label="Edit chore">✏️</button>';
    }

    h += '<div class="chore-top">';
    h += '<button class="done-btn ' + (done ? "checked" : "") + '" data-act="done" data-id="' + c.instanceID +
         '" aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + (done ? "✓" : "○") + "</button>";
    h += '<div class="chore-main">';
    h += '<div class="chore-title">' + esc(c.title) + "</div>";
    var time = Seed.TIME_LABEL[c.timeOfDay];
    h += '<div class="chore-meta"><span class="cat-ico">' + cat.icon + "</span> " + esc(cat.label) +
         (time ? " · " + time : "") + "</div>";
    if (c.notes) h += '<div class="chore-notes">' + esc(c.notes) + "</div>";
    h += "</div></div>";

    if (Logic.canSwap(c)) {
      h += '<div class="owner-picker">';
      Seed.SWAP_TARGETS.forEach(function (role) {
        var sel = role === assignee;
        h += '<button class="seg ' + (sel ? "sel" : "") + '" style="--c:' + colorVar(role) +
             '" data-act="swap" data-id="' + c.instanceID + '" data-role="' + role +
             '" aria-label="Assign to ' + esc(Store.name(role)) + '"' + (sel ? ' aria-pressed="true"' : "") + ">" +
             (sel ? '<span class="tick">✓</span>' : "") + esc(Store.name(role)) + "</button>";
      });
      h += "</div>";
    } else {
      var nm = Store.name(assignee);
      h += '<button class="locked-chip" style="--owner:' + ownerCol + '" data-act="locked" data-id="' + c.instanceID + '">';
      h += '<span class="av" style="background:' + ownerCol + '">' + initialOf(nm, "A") + "</span>";
      h += esc(nm) + " 🔒</button>";
    }

    h += "</article>";
    return h;
  }

  // ---------- interactions ----------
  function wireTopbar() {
    els.days.addEventListener("click", onDayClick);
    els.prevWeek.addEventListener("click", function () { currentMonday = Logic.addWeeks(currentMonday, -1); render(); });
    els.nextWeek.addEventListener("click", function () { currentMonday = Logic.addWeeks(currentMonday, 1); render(); });
    els.weekLabelBtn.addEventListener("click", function () { currentMonday = Logic.mondayStart(new Date()); lastStamp = null; render(); });
    els.settingsBtn.addEventListener("click", openSettings);
    els.syncChip.addEventListener("click", openSettings);
    els.addChoreBtn.addEventListener("click", function () { openChoreForm(null); });
    els.filterRow.addEventListener("click", function (e) {
      var b = e.target.closest("[data-filter]");
      if (!b) return;
      currentFilter = b.getAttribute("data-filter");
      render();
    });
  }

  function matchesFilter(assignee) {
    if (currentFilter === "all") return true;
    if (currentFilter === "me") return assignee === "me" || assignee === "both";
    if (currentFilter === "anna") return assignee === "anna" || assignee === "both";
    return true;
  }

  function renderFilters() {
    var defs = [["all", "All"], ["me", Store.name("me")], ["anna", Store.name("anna")]];
    els.filterRow.innerHTML = defs.map(function (d) {
      var active = currentFilter === d[0];
      return '<button class="chip ' + (active ? "active" : "") + '" data-filter="' + d[0] +
             '" role="tab" aria-selected="' + active + '">' + esc(d[1]) + "</button>";
    }).join("");
  }

  // Build a short toast describing what just synced in from the other phone.
  function describeChanges(changes) {
    if (!changes || !changes.length) return null;
    if (changes.length > 2) return "Plan updated.";
    return changes.map(function (c) {
      if (c.kind === "assignee") return Store.name(c.value) + ": “" + shorten(titleFromId(c.id)) + "”";
      if (c.kind === "done") return (c.value ? "✓ " : "○ ") + "“" + shorten(titleFromId(c.id)) + "”";
      if (c.kind === "name") return "Name updated";
      if (c.kind === "season") return "Mowing " + (c.value ? "in season" : "off");
      if (c.kind === "office") return "Office day " + (c.value ? "set" : "cleared");
      if (c.kind === "customAdd") return "＋ New chore: “" + shorten(c.title || "chore") + "”";
      if (c.kind === "customRemove") return "Chore removed";
      return "Updated";
    }).join(" · ");
  }

  function titleFromId(id) {
    var key = (id || "").split("|")[1];
    for (var i = 0; i < Seed.TEMPLATES.length; i++) {
      if (Seed.TEMPLATES[i].key === key) return Seed.TEMPLATES[i].title;
    }
    return "a chore";
  }

  function shorten(s) { return s.length > 32 ? s.slice(0, 30) + "…" : s; }

  function onDayClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");

    if (act === "done") {
      var id = btn.getAttribute("data-id");
      var chore = choreMap[id];
      var assignee = Store.assigneeFor(chore);
      Store.setDone(id, !Store.isDone(id), assignee === "both" ? null : assignee);
    } else if (act === "swap") {
      var id2 = btn.getAttribute("data-id");
      var role = btn.getAttribute("data-role");
      var chore2 = choreMap[id2];
      if (!Logic.canSwap(chore2)) { toast(Logic.lockReason(chore2)); return; }
      if (Store.assigneeFor(chore2) !== role) Store.setAssignee(id2, role);
    } else if (act === "locked") {
      toast(Logic.lockReason(choreMap[btn.getAttribute("data-id")]) || "Locked.");
    } else if (act === "office") {
      var di = +btn.getAttribute("data-di");
      var ymd = Logic.stamp(Logic.dateForDayIndex(currentMonday, di));
      Store.setOfficeDay(ymd, !Store.isOfficeDay(ymd));
    } else if (act === "edit") {
      openChoreForm(btn.getAttribute("data-key"));
    }
  }

  // ---------- settings ----------
  function wireSettings() {
    document.querySelectorAll('[data-close="settings"]').forEach(function (b) {
      b.addEventListener("click", closeSettings);
    });

    els.meName.addEventListener("input", function () { els.meAvatar.textContent = initialOf(els.meName.value, "M"); });
    els.annaName.addEventListener("input", function () { els.annaAvatar.textContent = initialOf(els.annaName.value, "A"); });
    els.meName.addEventListener("change", function () { Store.setName("me", els.meName.value); });
    els.annaName.addEventListener("change", function () { Store.setName("anna", els.annaName.value); });

    els.seasonToggle.addEventListener("change", function () { Store.setMowingInSeason(els.seasonToggle.checked); });

    els.connectBtn.addEventListener("click", function () {
      var code = (els.householdCode.value || "").trim();
      if (!code) { setSyncStatus("Enter a household code first.", "err"); return; }
      Sync.connect(code);
    });
    els.disconnectBtn.addEventListener("click", function () { Sync.disconnect(); refreshSyncUI(); });
    els.randomCodeBtn.addEventListener("click", function () {
      els.householdCode.value = randomCode();
    });

    els.exportBtn.addEventListener("click", exportPlan);
    els.importBtn.addEventListener("click", function () { els.importFile.click(); });
    els.importFile.addEventListener("change", importPlan);
    els.resetBtn.addEventListener("click", function () {
      if (confirm("Reset this device's swaps, completions and settings? (This also updates the shared plan if connected.)")) {
        Store.reset();
        toast("Reset done.");
      }
    });
  }

  function openSettings() {
    els.meName.value = Store.name("me");
    els.annaName.value = Store.name("anna");
    els.meAvatar.textContent = initialOf(Store.name("me"), "M");
    els.annaAvatar.textContent = initialOf(Store.name("anna"), "A");
    els.seasonToggle.checked = Store.mowingInSeason();
    els.householdCode.value = Sync.currentCode() || "";
    renderRules();
    els.gymMe.textContent = "Gym — " + Store.name("me") + ": " + Seed.GYM.me.join(", ");
    els.gymAnna.textContent = "Gym — " + Store.name("anna") + ": " + Seed.GYM.anna.join(", ");
    refreshSyncUI();
    els.settingsSheet.hidden = false;
  }
  function closeSettings() { els.settingsSheet.hidden = true; }

  function renderRules() {
    var r = Seed.RULES;
    var items = [
      ["🌿", r.grassAllergy],
      ["🍴", r.foodAndDishes],
      ["🗑️", "Bins: " + r.binDay],
      ["🐾", "Roo (" + Seed.DOG.name + ") is a golden retriever — she/her. Morning, midday (WFH) and a 45–60 min evening walk daily."]
    ];
    els.rulesList.innerHTML = items.map(function (it) {
      return '<li><span class="ico">' + it[0] + "</span><span>" + esc(it[1]) + "</span></li>";
    }).join("");
  }

  function refreshSyncUI() {
    var connected = Sync.status() === "connected";
    els.disconnectBtn.hidden = !connected && Sync.status() !== "connecting";
    els.connectBtn.textContent = connected ? "Reconnect" : "Connect";
    if (!Sync.isConfigured()) {
      els.firebaseHint.textContent = "Live sync needs a free Firebase project. Paste your config into js/firebase-config.js — see the README. Until then the app works fully on this device.";
      setSyncStatus("Not configured — running locally.", "");
    } else {
      els.firebaseHint.textContent = "Both phones must use the same household code. Keep it private — anyone with the code and your Firebase URL can see the plan.";
      var s = Sync.status();
      if (s === "connected") setSyncStatus("Connected — syncing live with the shared plan.", "ok");
      else if (s === "connecting") setSyncStatus("Connecting…", "");
      else if (s === "error") setSyncStatus("Couldn't connect. Check the config and your connection.", "err");
      else setSyncStatus("Ready. Enter a household code and Connect.", "");
    }
  }
  function setSyncStatus(text, cls) {
    els.syncStatus.textContent = text;
    els.syncStatus.className = "status" + (cls ? " " + cls : "");
  }

  function onSyncStatus(status) {
    var chip = els.syncChip;
    chip.className = "sync-chip " + (status === "connected" ? "connected" : status === "connecting" ? "connecting" : status === "error" ? "error" : "");
    els.syncLabel.textContent = status === "connected" ? "Synced" : status === "connecting" ? "Syncing…" : status === "error" ? "Sync off" : "Local";
    if (!els.settingsSheet.hidden) refreshSyncUI();
  }

  // ---------- add / edit chores ----------
  var editingKey = null;

  var SCHEDULE_OPTIONS = [
    ["daily", "Every day"],
    ["weekday", "Weekdays (Mon–Fri)"],
    ["monday", "Mondays"], ["tuesday", "Tuesdays"], ["wednesday", "Wednesdays"],
    ["thursday", "Thursdays"], ["friday", "Fridays"], ["saturday", "Saturdays"], ["sunday", "Sundays"]
  ];
  var TIME_OPTIONS = [["anytime", "Anytime"], ["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]];

  function wireChoreForm() {
    document.querySelectorAll('[data-close="chore"]').forEach(function (b) {
      b.addEventListener("click", closeChoreForm);
    });
    els.saveChoreBtn.addEventListener("click", saveChore);
    els.deleteChoreBtn.addEventListener("click", deleteChore);
  }

  function fillSelect(sel, options, selected) {
    sel.innerHTML = options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === selected ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
  }

  function openChoreForm(key) {
    editingKey = key || null;
    var catOptions = Object.keys(Seed.CATEGORIES).map(function (k) { return [k, Seed.CATEGORIES[k].label]; });
    var whoOptions = [["both", Store.name("both")], ["me", Store.name("me")], ["anna", Store.name("anna")]];

    var tpl = editingKey ? Store.getCustomTemplate(editingKey) : null;
    els.choreSheetTitle.textContent = editingKey ? "Edit chore" : "New chore";
    els.choreTitle.value = tpl ? (tpl.title || "") : "";
    els.choreNotes.value = tpl ? (tpl.notes || "") : "";
    fillSelect(els.choreCategory, catOptions, tpl ? tpl.category : "cleaning");
    fillSelect(els.choreSchedule, SCHEDULE_OPTIONS, tpl ? tpl.schedule : "daily");
    fillSelect(els.choreTime, TIME_OPTIONS, tpl ? tpl.timeOfDay : "anytime");
    fillSelect(els.choreWho, whoOptions, tpl ? tpl.defaultAssignee : "both");
    els.deleteChoreBtn.hidden = !editingKey;

    els.choreSheet.hidden = false;
    setTimeout(function () { els.choreTitle.focus(); }, 50);
  }

  function closeChoreForm() { els.choreSheet.hidden = true; editingKey = null; }

  function saveChore() {
    var title = (els.choreTitle.value || "").trim();
    if (!title) { els.choreTitle.focus(); toast("Give the chore a name."); return; }
    var tpl = {
      title: title,
      category: els.choreCategory.value,
      schedule: els.choreSchedule.value,
      timeOfDay: els.choreTime.value,
      defaultAssignee: els.choreWho.value,
      notes: (els.choreNotes.value || "").trim() || null
    };
    var key = editingKey || ("custom-" + Date.now() + "-" + Math.floor(Math.random() * 1e6).toString(36));
    Store.setCustomTemplate(key, tpl);
    closeChoreForm();
    toast(editingKey ? "Chore updated." : "Chore added.");
  }

  function deleteChore() {
    if (!editingKey) return;
    Store.deleteCustomTemplate(editingKey);
    closeChoreForm();
    toast("Chore removed.");
  }

  // ---------- backup ----------
  function exportPlan() {
    var blob = new Blob([Store.exportJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "RooHQ-plan-" + Logic.stamp(Logic.mondayStart(new Date())) + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Plan exported.");
  }
  function importPlan(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { Store.importJSON(reader.result); toast("Plan imported."); }
      catch (err) { toast("Couldn't read that file."); }
      els.importFile.value = "";
    };
    reader.readAsText(file);
  }

  // ---------- helpers ----------
  function weekRangeLabel() {
    var end = Logic.dateForDayIndex(currentMonday, 6);
    return fmtDate(currentMonday) + " – " + fmtDate(end);
  }
  function fmtDate(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function dayDateLabel(di) { return fmtDate(Logic.dateForDayIndex(currentMonday, di)); }

  function randomCode() {
    var words = ["roo", "oak", "fern", "moss", "wren", "sky", "pine", "dune", "bay", "elm"];
    var w = words[Math.floor(Math.random() * words.length)];
    var n = Math.floor(1000 + Math.random() * 9000);
    return w + "-" + n + "-" + Math.random().toString(36).slice(2, 6);
  }

  var toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 2400);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    }
  }

  RooHQ.App = { toast: toast };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.RooHQ);
