/*
 * app.js — Roo HQ
 * Rendering + interactions: the weekly view, one-tap swapping, completion, week navigation,
 * the scoreboard and rewards, settings, backup. Talks to Store (state), Game (scoring) and
 * Sync (cloud). Re-renders on any state change.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";
  var Seed = RooHQ.Seed, Logic = RooHQ.Logic, Store = RooHQ.Store, Sync = RooHQ.Sync, Game = RooHQ.Game;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var BONUS_KEY = "roohq.ui.bonusOpen";   // local only: which days have "Bonus jobs" expanded
  var currentMonday;
  var choreMap = {};       // instanceID -> chore (current week)
  var lastStamp = null;    // to decide when to refocus "today"
  var opened = false;      // first render done
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
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  // ---------- init ----------
  function init() {
    // Always open on today rather than wherever the page was last scrolled.
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
    Store.load();
    currentMonday = Logic.mondayStart(new Date());
    cacheEls();
    wireTopbar();
    wireSettings();
    wireChoreForm();
    wireRewards();
    wireWhoSheet();

    Store.onChange(function (ev) {
      render();
      if (!els.rewardsSheet.hidden && !editingInRewards()) renderRewards();
      if (ev && ev.source === "remote" && ev.announce) {
        var msg = describeChanges(ev.changes);
        if (msg) toast(msg);
      }
    });

    Sync.init({ onStatus: onSyncStatus });
    Sync.autoConnect();

    render();
    if (!Store.phoneRole()) openWhoSheet();
    window.addEventListener("resize", measureTopbar);
    registerServiceWorker();
  }

  function cacheEls() {
    ["days", "weekRange", "weekSub", "scoreboard",
     "filterRow", "prevWeek", "nextWeek", "weekLabelBtn", "settingsBtn", "syncChip", "syncLabel",
     "settingsSheet", "meName", "annaName", "meAvatar", "annaAvatar", "seasonToggle", "phoneRoleRow",
     "householdCode", "connectBtn", "disconnectBtn", "randomCodeBtn", "syncStatus", "firebaseHint",
     "exportBtn", "importBtn", "importFile", "resetBtn", "rulesList", "gymMe", "gymAnna", "toast",
     "addChoreBtn", "choreSheet", "choreSheetTitle", "choreTitle", "choreCategory", "choreSchedule",
     "choreDay", "choreDayRow", "choreDaysRow", "choreDays", "choreClock", "choreMinutes", "chorePtsHint",
     "choreCore", "choreTime", "choreWho", "choreNotes", "saveChoreBtn", "deleteChoreBtn",
     "rewardsSheet", "rewardsBody", "whoSheet"
    ].forEach(function (id) { els[id] = $(id); });
  }

  // ---------- derived game state (recomputed on each render) ----------
  var genCache = {};   // week stamp -> generated chores (all, including hidden seasonal)
  var tplIndex = null; // template key -> effective template

  function resetCaches() { genCache = {}; tplIndex = null; }

  function templates() {
    if (!tplIndex) {
      tplIndex = {};
      Store.effectiveBaseTemplates().concat(Store.getCustomTemplates()).forEach(function (t) { tplIndex[t.key] = t; });
    }
    return tplIndex;
  }

  // A week's chores with the office-day rule applied, so every reader (cards, points, streaks,
  // core counts, filters) sees the same owner. A manual swap still wins via Store.assigneeFor.
  function generated(monday) {
    var st = Logic.stamp(monday);
    if (!genCache[st]) {
      genCache[st] = Logic.applyOfficeDays(
        Logic.generateWeek(monday, Store.getCustomTemplates(), Store.effectiveBaseTemplates()),
        monday, Store.isOfficeDay, Store.hasAssigneeOverride);
    }
    return genCache[st];
  }

  // A week's chores as they count: hidden out-of-season chores left out.
  function weekChores(monday) {
    var inSeason = Store.mowingInSeason();
    return generated(monday).filter(function (c) { return !Logic.isHiddenSeasonal(c, inSeason); });
  }

  // Points for an old done field without `pts`: from the chore's minutes.
  function ptsOfId(id) {
    var key = (id || "").split("|")[1];
    var t = templates()[key];
    if (t) return Game.points(Logic.minutesOf(t));
    if (Seed.RETIRED_MINUTES[key]) return Game.points(Seed.RETIRED_MINUTES[key]);
    return Game.points(Seed.DEFAULT_MINUTES);
  }

  // Assignee for an instance id (override, else the generated owner).
  function assigneeOfId(id) {
    var o = Store.getDoc().overrides[id];
    if (o && o.assignee && typeof o.assignee.v === "string") return o.assignee.v;
    var st = (id || "").split("|")[0];
    if (!/^\d{8}$/.test(st)) return null;
    var list = generated(Logic.dateFromStamp(st));
    for (var i = 0; i < list.length; i++) { if (list[i].instanceID === id) return list[i].assignee; }
    return null;
  }

  function tallyOpts(prefix) { return { prefix: prefix, ptsOf: ptsOfId, assigneeOf: assigneeOfId }; }
  function lifetime() { return Game.tally(Store.getDoc().overrides, tallyOpts(null)); }
  function weekTally(monday) { return Game.tally(Store.getDoc().overrides, tallyOpts(Logic.stamp(monday))); }

  function streakOf(person) {
    return Game.streak(person, new Date(), weekChores, Store.assigneeFor, Store.isDone, 60);
  }

  function teamRewards() { return Store.getRewards().filter(function (r) { return r.kind === "team"; }); }
  function personalRewards() {
    return Store.getRewards().filter(function (r) { return r.kind === "personal"; })
      .sort(function (a, b) { return a.cost - b.cost; });
  }

  function teamInfo(monday) {
    var target = Game.teamTarget(weekChores(monday));
    var total = weekTally(monday).team;
    var goal = Game.teamGoalFor(teamRewards(), Store.teamGoalKey(Logic.stamp(monday)), Logic.weekIndex(monday));
    return { target: target, total: total, goal: goal, full: target > 0 && total >= target };
  }

  function balances() {
    var life = lifetime();
    var reds = Store.getRedemptions();
    return {
      life: life,
      me: Game.balance(life.me, reds, "me"),
      anna: Game.balance(life.anna, reds, "anna")
    };
  }

  // ---------- render ----------
  function render() {
    resetCaches();
    renderFilters();

    var all = weekChores(currentMonday);
    var chores = all.filter(function (c) { return matchesFilter(Store.assigneeFor(c)); });
    choreMap = {};
    chores.forEach(function (c) { choreMap[c.instanceID] = c; });

    var thisWeek = isThisWeek();
    els.weekRange.textContent = weekRangeLabel();
    els.weekSub.textContent = thisWeek ? "This week" : "Plan";

    renderScoreboard(thisWeek);

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
    measureTopbar();

    // focus today when the week changes
    if (thisWeek && lastStamp !== Logic.stamp(currentMonday)) {
      var el = $("day-" + todayIdx);
      var first = !opened;   // jump straight to today on open; glide when coming back to this week
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "start" }); }, 60);
    }
    opened = true;
    lastStamp = Logic.stamp(currentMonday);
  }

  function isThisWeek() {
    return Logic.stamp(currentMonday) === Logic.stamp(Logic.mondayStart(new Date()));
  }

  // Keep "scroll to today" clear of the sticky header, whatever its height.
  function measureTopbar() {
    var tb = document.querySelector(".topbar");
    if (tb) document.documentElement.style.setProperty("--topbar-h", tb.offsetHeight + "px");
  }

  function renderScoreboard(thisWeek) {
    var me = Store.phoneRole();
    var wk = weekTally(currentMonday);
    var life = lifetime();
    var team = teamInfo(currentMonday);

    var h = "";
    // Roo's day: today's core Roo-care (walks and meals).
    var todayMon = Logic.mondayStart(new Date());
    var todayIdx = Logic.dayIndexOf(new Date());
    var roo = weekChores(todayMon).filter(function (c) {
      return c.dayIndex === todayIdx && c.core && c.category === "dog";
    });
    if (roo.length) {
      var rd = roo.filter(function (c) { return Store.isDone(c.instanceID); }).length;
      h += '<div class="roo-day' + (rd === roo.length ? " all" : "") + '"><span aria-hidden="true">🐾</span> Roo\'s day: ' +
           (rd === roo.length ? "all " + roo.length + " done" : rd + " of " + roo.length + " done") + "</div>";
    }

    h += '<div class="score-cards">';
    Game.PEOPLE.forEach(function (p) {
      var lv = Game.level(life[p]);
      var st = streakOf(p);
      var nm = Store.name(p);
      h += '<div class="score-card" style="--c:' + colorVar(p) + '">';
      h += '<div class="sc-head"><b>' + esc(nm) + "</b>" + (me === p ? '<span class="you">You</span>' : "") +
           '<span class="sc-pts" title="Points ' + (thisWeek ? "this week" : "that week") + '"><strong>' + wk[p] + "</strong> pts</span></div>";
      h += '<div class="sc-meta"><span title="Streak: days in a row with every core job done">🔥 ' + plural(st, "day") +
           "</span><span>Level " + lv.level + "</span></div>";
      h += '<div class="lvl-bar" title="' + lv.toNext + ' points to level ' + (lv.level + 1) + '"><div style="width:' + lv.pct + '%"></div></div>';
      h += "</div>";
    });
    h += "</div>";

    var pct = team.target ? Math.min(100, Math.round(team.total / team.target * 100)) : 0;
    var goalTitle = team.goal ? team.goal.title : "the team reward";
    h += '<div class="team' + (team.full ? " full" : "") + '">';
    h += '<div class="team-head"><span>' + (team.full
          ? "Unlocked: <b>" + esc(goalTitle) + "</b>"
          : "Team goal: <b>" + esc(goalTitle) + "</b>") + "</span>" +
         "<strong>" + team.total + "/" + team.target + '</strong><span class="link">Rewards ›</span></div>';
    h += '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>';
    h += "</div>";
    els.scoreboard.innerHTML = h;
  }

  function dayHTML(di, items, isToday) {
    items = items.slice().sort(Logic.ordering);
    var core = items.filter(function (c) { return c.core; });
    var bonus = items.filter(function (c) { return !c.core; });

    var coreDone = 0;
    core.forEach(function (c) { if (Store.isDone(c.instanceID)) coreDone++; });
    var complete = core.length > 0 && coreDone === core.length;

    var ymd = Logic.stamp(Logic.dateForDayIndex(currentMonday, di));
    var isWorkday = di <= 4;                       // office days only exist Monday to Friday
    var officeOn = isWorkday && Store.isOfficeDay(ymd);

    var h = "";
    h += '<div class="day-head" id="day-' + di + '">';
    h += '<div class="day-title"><b>' + Seed.DAY_FULL[di] + '</b><small>' + dayDateLabel(di) + '</small></div>';
    if (isToday) h += '<span class="today-pill">Today</span>';
    h += '<div class="day-spacer"></div>';
    if (isWorkday) {
      h += '<button class="office-btn ' + (officeOn ? "on" : "") + '" data-act="office" data-di="' + di +
           '" aria-label="Toggle ' + esc(Store.name("anna")) + ' office day">💼</button>';
    }
    h += '<div class="day-progress" title="Core jobs done">' + coreDone + "/" + core.length + (complete ? " ✓" : "") + "</div>";
    h += "</div>";

    if (officeOn) {
      h += '<div class="office-banner"><span class="ico">💼</span><span>' + esc(officeText(di)) + "</span></div>";
    }

    h += '<div class="section-label">' + (isToday ? "Today's core" : "Core jobs") + "</div>";
    h += '<div class="day-chores">';
    if (!core.length) h += '<p class="none">No core jobs.</p>';
    core.forEach(function (c) { h += choreHTML(c); });
    h += "</div>";

    if (bonus.length) {
      var open = isBonusOpen(ymd);
      var avail = 0, bonusDone = 0;
      bonus.forEach(function (c) {
        if (Store.isDone(c.instanceID)) bonusDone++;
        else avail += Game.points(c.minutes);
      });
      h += '<button class="bonus-toggle' + (open ? " open" : "") + '" data-act="bonus" data-ymd="' + ymd +
           '" aria-expanded="' + open + '"><span>Bonus jobs <span class="muted">· ' + bonus.length +
           (bonusDone ? " (" + bonusDone + " done)" : "") + '</span></span><span class="bonus-pts">' +
           (avail ? "+" + avail + " pts" : "all done") + '</span><span class="chev" aria-hidden="true">›</span></button>';
      if (open) {
        h += '<div class="day-chores bonus">';
        bonus.forEach(function (c) { h += choreHTML(c); });
        h += "</div>";
      }
    }
    return h;
  }

  // Office-day reminder (Anna at the office 08:00 to 18:00).
  function officeText(di) {
    if (di <= 3) return "Roo is with " + Store.name("anna") + "'s mum today, or she comes over.";
    return Store.name("me") + " is home today, so Roo is covered.";
  }

  function choreHTML(c) {
    var assignee = Store.assigneeFor(c);
    var done = Store.isDone(c.instanceID);
    var cat = Seed.CATEGORIES[c.category] || { label: c.category, icon: "•" };
    var ownerCol = colorVar(assignee);
    var pts = Game.points(c.minutes);

    var h = '<article class="chore ' + (done ? "done" : "") + (cat.rooCare ? " roo" : "") +
            '" style="--owner:' + ownerCol + '">';

    // Every chore can be edited or removed.
    h += '<button class="edit-btn" data-act="edit" data-key="' + esc(c.templateKey) +
         '" aria-label="Edit chore">✏️</button>';

    h += '<div class="chore-top">';
    h += '<button class="done-btn ' + (done ? "checked" : "") + '" data-act="done" data-id="' + esc(c.instanceID) +
         '" aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + (done ? "✓" : "○") + "</button>";
    h += '<div class="chore-main">';
    h += '<div class="chore-title">' + esc(c.title) + "</div>";
    var time = c.time || Seed.TIME_LABEL[c.timeOfDay];
    h += '<div class="chore-meta"><span class="pts" title="' + plural(pts, "point") + '">+' + pts + "</span>" +
         '<span class="cat-ico">' + cat.icon + "</span> " + esc(cat.label) +
         (time ? " · " + esc(time) : "") + "</div>";
    if (c.notes) h += '<div class="chore-notes">' + esc(c.notes) + "</div>";
    h += "</div></div>";

    if (Logic.canSwap(c)) {
      h += '<div class="owner-picker">';
      Seed.SWAP_TARGETS.forEach(function (role) {
        var sel = role === assignee;
        h += '<button class="seg ' + (sel ? "sel" : "") + '" style="--c:' + colorVar(role) +
             '" data-act="swap" data-id="' + esc(c.instanceID) + '" data-role="' + role +
             '" aria-label="Assign to ' + esc(Store.name(role)) + '"' + (sel ? ' aria-pressed="true"' : "") + ">" +
             (sel ? '<span class="tick">✓</span>' : "") + esc(Store.name(role)) + "</button>";
      });
      h += "</div>";
    } else {
      var nm = Store.name(assignee);
      h += '<button class="locked-chip" style="--owner:' + ownerCol + '" data-act="locked" data-id="' + esc(c.instanceID) + '">';
      h += '<span class="av" style="background:' + ownerCol + '">' + initialOf(nm, "A") + "</span>";
      h += esc(nm) + " 🔒</button>";
    }

    h += "</article>";
    return h;
  }

  // ---------- bonus section open/closed (local only) ----------
  function readBonusOpen() {
    try { return JSON.parse(localStorage.getItem(BONUS_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function isBonusOpen(ymd) { return !!readBonusOpen()[ymd]; }
  function toggleBonus(ymd) {
    var m = readBonusOpen();
    if (m[ymd]) delete m[ymd]; else m[ymd] = 1;
    // keep it small: forget days more than five weeks old
    var cutoff = Logic.stamp(Logic.addWeeks(Logic.mondayStart(new Date()), -5));
    Object.keys(m).forEach(function (k) { if (k < cutoff) delete m[k]; });
    try { localStorage.setItem(BONUS_KEY, JSON.stringify(m)); } catch (e) {}
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
    els.scoreboard.addEventListener("click", openRewards);
    els.scoreboard.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRewards(); }
    });
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
    // Redemptions are always worth saying, even in a big batch.
    var redeems = changes.filter(function (c) { return c.kind === "redeem"; }).map(function (c) {
      return Store.name(c.who) + " redeemed: " + (c.title || "a reward");
    });
    if (redeems.length) return redeems.join(" · ");
    if (changes.length > 2) return "Plan updated.";
    return changes.map(function (c) {
      if (c.kind === "assignee") return Store.name(c.value) + ": “" + shorten(titleFromId(c.id)) + "”";
      if (c.kind === "done") return (c.value ? "✓ " : "○ ") + "“" + shorten(titleFromId(c.id)) + "”";
      if (c.kind === "name") return "Name updated";
      if (c.kind === "season") return "Mowing " + (c.value ? "in season" : "off");
      if (c.kind === "office") return "Office day " + (c.value ? "set" : "cleared");
      if (c.kind === "customAdd") return "＋ New chore: “" + shorten(c.title || "chore") + "”";
      if (c.kind === "customRemove") return "Chore removed";
      if (c.kind === "templateEdit") return "A chore was edited";
      if (c.kind === "templateRemove") return "A chore was removed";
      if (c.kind === "rewardEdit" || c.kind === "rewardRemove") return "Rewards updated";
      if (c.kind === "teamGoal") return "Team reward: " + rewardTitle(c.value);
      if (c.kind === "redeemFulfilled") return (c.value ? "Reward given: " : "Reward not given yet: ") + (c.title || "");
      if (c.kind === "redeemCancel") return "Redemption cancelled: " + (c.title || "");
      return "Updated";
    }).join(" · ");
  }

  function rewardTitle(key) {
    var r = Store.getRewards().filter(function (x) { return x.key === key; })[0];
    return r ? r.title : "changed";
  }

  function titleFromId(id) {
    var key = (id || "").split("|")[1];
    var t = templates()[key];
    if (t) return t.binColour ? "Put the bin out" : t.title;
    return "a chore";
  }

  function shorten(s) { return s.length > 32 ? s.slice(0, 30) + "…" : s; }

  function onDayClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");

    if (act === "done") {
      onTick(btn);
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
    } else if (act === "bonus") {
      toggleBonus(btn.getAttribute("data-ymd"));
      render();
    }
  }

  // ---------- ticking + feedback ----------
  // Who has finished all their core jobs on a day of the current week (and has some).
  function coreStatus(di) {
    var day = weekChores(currentMonday).filter(function (c) { return c.dayIndex === di; });
    var out = {};
    Game.PEOPLE.forEach(function (p) {
      out[p] = Game.coreFor(day, p, Store.assigneeFor).length > 0 &&
               Game.dayKept(day, p, Store.assigneeFor, Store.isDone);
    });
    return out;
  }

  function onTick(btn) {
    var id = btn.getAttribute("data-id");
    var chore = choreMap[id];
    if (!chore) return;
    if (Store.isDone(id)) { Store.setDone(id, false, null); return; }

    var assignee = Store.assigneeFor(chore);
    var by = Store.phoneRole() || (assignee === "both" ? null : assignee);
    var pts = Game.points(chore.minutes);
    var rect = btn.getBoundingClientRect();
    var before = coreStatus(chore.dayIndex);
    var teamBefore = teamInfo(currentMonday).full;

    Store.setDone(id, true, by, { pts: pts, owner: assignee });   // re-renders
    floatPoints(rect, pts);

    var after = coreStatus(chore.dayIndex);
    var isToday = isThisWeek() && chore.dayIndex === Logic.dayIndexOf(new Date());
    var msgs = [];
    Game.PEOPLE.forEach(function (p) {
      if (before[p] || !after[p]) return;
      var who = (p === Store.phoneRole()) ? "Your" : Store.name(p) + "'s";
      var when = isToday ? "today" : Seed.DAY_FULL[chore.dayIndex];
      var m = who + " core jobs are done for " + when + ".";
      if (isToday) m += " Streak: " + plural(streakOf(p), "day") + ".";
      msgs.push(m);
    });
    var team = teamInfo(currentMonday);
    if (!teamBefore && team.full) {
      msgs.push("Team goal reached. " + (team.goal ? team.goal.title + " is unlocked." : "Reward unlocked."));
      var sb = els.scoreboard.querySelector(".team");
      if (sb) sb.classList.add("just-filled");
    }
    if (msgs.length) toast(msgs.join(" "), 4200);
  }

  // A brief "+N" that rises from the tick button.
  function floatPoints(rect, pts) {
    var el = document.createElement("div");
    el.className = "pts-float";
    el.textContent = "+" + pts;
    el.setAttribute("aria-hidden", "true");
    el.style.left = Math.round(rect.left + rect.width / 2) + "px";
    el.style.top = Math.round(rect.top) + "px";
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
  }

  // ---------- whose phone ----------
  function wireWhoSheet() {
    els.whoSheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-role]");
      if (!b) return;
      Store.setPhoneRole(b.getAttribute("data-role"));
      els.whoSheet.hidden = true;
      toast("Got it. This is " + Store.name(b.getAttribute("data-role")) + "'s phone.");
    });
  }

  function openWhoSheet() {
    els.whoSheet.querySelectorAll("[data-role]").forEach(function (b) {
      b.textContent = Store.name(b.getAttribute("data-role"));
    });
    els.whoSheet.hidden = false;
  }

  function renderPhoneRoleRow() {
    var role = Store.phoneRole();
    els.phoneRoleRow.innerHTML = ["me", "anna"].map(function (r) {
      var sel = role === r;
      return '<button class="seg ' + (sel ? "sel" : "") + '" type="button" style="--c:' + colorVar(r) +
             '" data-phone="' + r + '"' + (sel ? ' aria-pressed="true"' : "") + ">" +
             (sel ? '<span class="tick">✓</span>' : "") + esc(Store.name(r)) + "</button>";
    }).join("");
  }

  // ---------- settings ----------
  function wireSettings() {
    document.querySelectorAll('[data-close="settings"]').forEach(function (b) {
      b.addEventListener("click", closeSettings);
    });

    els.meName.addEventListener("input", function () { els.meAvatar.textContent = initialOf(els.meName.value, "A"); });
    els.annaName.addEventListener("input", function () { els.annaAvatar.textContent = initialOf(els.annaName.value, "A"); });
    els.meName.addEventListener("change", function () { Store.setName("me", els.meName.value); });
    els.annaName.addEventListener("change", function () { Store.setName("anna", els.annaName.value); });

    els.phoneRoleRow.addEventListener("click", function (e) {
      var b = e.target.closest("[data-phone]");
      if (!b) return;
      Store.setPhoneRole(b.getAttribute("data-phone"));
      renderPhoneRoleRow();
    });

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
    var restoreBtn = $("restoreBtn");
    if (restoreBtn) restoreBtn.addEventListener("click", function () {
      var n = Store.restoreRemovedTemplates();
      toast(n ? (n + " chore" + (n === 1 ? "" : "s") + " restored.") : "No removed chores to restore.");
    });
  }

  function openSettings() {
    els.meName.value = Store.name("me");
    els.annaName.value = Store.name("anna");
    els.meAvatar.textContent = initialOf(Store.name("me"), "A");
    els.annaAvatar.textContent = initialOf(Store.name("anna"), "A");
    els.seasonToggle.checked = Store.mowingInSeason();
    els.householdCode.value = Sync.currentCode() || "";
    renderPhoneRoleRow();
    renderRules();
    els.gymMe.textContent = "🏋️ " + Seed.GYM.note;
    els.gymAnna.textContent = "";
    refreshSyncUI();
    els.settingsSheet.hidden = false;
  }
  function closeSettings() { els.settingsSheet.hidden = true; }

  function renderRules() {
    var r = Seed.RULES;
    var items = [
      ["🌿", r.grassAllergy],
      ["🍴", r.foodAndDishes],
      ["🔄", r.sharing],
      ["🐾", Seed.DOG.name + " is a golden retriever (she/her). She gets two 30-minute walks and two meals a day. At the weekend it's a morning out together."],
      ["🗑️", r.bins],
      ["⭐", r.points]
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

  // ---------- rewards ----------
  var rewardsUI = { confirmKey: null, editing: false };

  function wireRewards() {
    document.querySelectorAll('[data-close="rewards"]').forEach(function (b) {
      b.addEventListener("click", closeRewards);
    });
    els.rewardsBody.addEventListener("click", onRewardsClick);
  }

  function openRewards() {
    rewardsUI.confirmKey = null;
    rewardsUI.editing = false;
    renderRewards();
    els.rewardsSheet.hidden = false;
  }
  function closeRewards() { els.rewardsSheet.hidden = true; }

  function editingInRewards() {
    var a = document.activeElement;
    return !!(a && els.rewardsBody.contains(a) && (a.tagName === "INPUT" || a.tagName === "SELECT"));
  }

  function renderRewards() {
    resetCaches();
    var role = Store.phoneRole();
    var other = role === "me" ? "anna" : (role === "anna" ? "me" : null);
    var bal = balances();
    var team = teamInfo(currentMonday);
    var h = "";

    // Balances
    h += '<section class="card-group"><h3>Points to spend</h3><div class="balances">';
    Game.PEOPLE.forEach(function (p) {
      h += '<div class="balance" style="--c:' + colorVar(p) + '"><span class="who">' + esc(Store.name(p)) +
           (role === p ? ' <span class="you">You</span>' : "") + "</span><strong>" + bal[p] + "</strong>" +
           '<small>' + bal.life[p] + " earned in total</small></div>";
    });
    h += "</div></section>";

    // Team reward for the week on screen
    var pct = team.target ? Math.min(100, Math.round(team.total / team.target * 100)) : 0;
    h += '<section class="card-group"><h3>' + (isThisWeek() ? "This week" : "Week of " + fmtDate(currentMonday)) +
         " we are playing for</h3>";
    h += '<div class="goal-list">';
    teamRewards().forEach(function (r) {
      var sel = team.goal && team.goal.key === r.key;
      h += '<button class="goal ' + (sel ? "sel" : "") + '" type="button" data-act="goal" data-key="' + esc(r.key) + '"' +
           (sel ? ' aria-pressed="true"' : "") + ">" + (sel ? "✓ " : "") + esc(r.title) + "</button>";
    });
    if (!teamRewards().length) h += '<p class="hint">No team rewards yet. Add one below.</p>';
    h += "</div>";
    h += '<div class="team' + (team.full ? " full" : "") + '"><div class="team-head"><span>' +
         (team.full ? "Unlocked. Enjoy it." : "Team points") + "</span><strong>" + team.total + "/" + team.target +
         '</strong></div><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    h += '<p class="hint">Fill the bar together. The target is the points of all core jobs this week.</p>';
    h += "</section>";

    // Shop
    h += '<section class="card-group"><h3>Personal rewards</h3>';
    if (!role) h += '<p class="hint">Choose whose phone this is in Settings to redeem rewards.</p>';
    h += '<ul class="shop">';
    personalRewards().forEach(function (r) {
      var afford = role && bal[role] >= r.cost;
      h += '<li class="shop-item">';
      h += '<div class="shop-main"><span class="shop-title">' + esc(r.title) + '</span><span class="cost">' + r.cost + " pts</span></div>";
      if (role && rewardsUI.confirmKey === r.key) {
        h += '<div class="confirm"><span>Spend ' + r.cost + " points on this?</span>" +
             '<button class="btn primary" type="button" data-act="redeem-yes" data-key="' + esc(r.key) + '">Yes, redeem</button>' +
             '<button class="btn ghost" type="button" data-act="redeem-no">Cancel</button></div>';
      } else if (role) {
        h += '<button class="btn small' + (afford ? " primary" : "") + '" type="button" data-act="redeem" data-key="' +
             esc(r.key) + '"' + (afford ? "" : " disabled") + ">" +
             (afford ? "Redeem" : "Need " + (r.cost - bal[role]) + " more") + "</button>";
      }
      h += "</li>";
    });
    h += "</ul></section>";

    // History
    var reds = Game.sortRedemptions(Store.getRedemptions());
    h += '<section class="card-group"><h3>Redeemed</h3>';
    if (!reds.length) h += '<p class="hint">Nothing redeemed yet.</p>';
    h += '<ul class="history">';
    reds.forEach(function (r) {
      var mine = role === r.who;
      // Synced values: never trust them as markup. Whitelist the role, force the cost to a number.
      var whoRole = (r.who === "me" || r.who === "anna") ? r.who : "both";
      var costNum = Number(r.cost) || 0;
      h += '<li class="hist' + (r.fulfilled ? " given" : "") + '" style="--c:' + colorVar(whoRole) + '">';
      h += '<div class="hist-main"><b>' + esc(r.title) + "</b><small>" + esc(Store.name(r.who)) + " · " + costNum + " pts · " +
           fmtDate(new Date(r.at || 0)) + (r.fulfilled ? " · given" : "") + "</small></div>";
      if (!r.fulfilled) {
        if (mine) {
          h += '<span class="waiting">Waiting for ' + esc(Store.name(other)) + "</span>" +
               '<button class="btn small ghost" type="button" data-act="cancel-redeem" data-id="' + esc(r.key) + '">Cancel</button>';
        } else {
          h += '<button class="btn small primary" type="button" data-act="fulfil" data-id="' + esc(r.key) + '">Mark given</button>';
        }
      } else if (!mine) {
        h += '<button class="btn small ghost" type="button" data-act="unfulfil" data-id="' + esc(r.key) + '">Undo</button>';
      }
      h += "</li>";
    });
    h += "</ul></section>";

    // Editing
    h += '<section class="card-group"><h3>Edit rewards</h3>';
    if (!rewardsUI.editing) {
      h += '<p class="hint">Change names and costs, remove rewards or add your own. Changes sync to both phones.</p>' +
           '<div class="row-btns"><button class="btn" type="button" data-act="edit-rewards">Edit rewards</button></div>';
    } else {
      h += "<h4>Team rewards</h4>";
      teamRewards().forEach(function (r) { h += rewardEditRow(r); });
      h += rewardAddRow("team");
      h += "<h4>Personal rewards</h4>";
      personalRewards().forEach(function (r) { h += rewardEditRow(r); });
      h += rewardAddRow("personal");
      h += '<div class="row-btns"><button class="btn" type="button" data-act="edit-rewards">Done editing</button></div>';
    }
    h += "</section>";

    els.rewardsBody.innerHTML = h;
  }

  function rewardEditRow(r) {
    return '<div class="reward-edit" data-key="' + esc(r.key) + '" data-kind="' + r.kind + '">' +
      '<input type="text" class="rw-title" value="' + esc(r.title) + '" aria-label="Reward name" />' +
      (r.kind === "personal" ? '<input type="number" class="rw-cost" min="1" max="9999" inputmode="numeric" value="' + r.cost + '" aria-label="Cost in points" /><span class="pts-unit">pts</span>' : "") +
      '<button class="btn small" type="button" data-act="reward-save">Save</button>' +
      '<button class="btn small ghost danger" type="button" data-act="reward-delete" aria-label="Remove reward">Remove</button></div>';
  }

  function rewardAddRow(kind) {
    return '<div class="reward-edit add" data-kind="' + kind + '">' +
      '<input type="text" class="rw-title" placeholder="New ' + (kind === "team" ? "team" : "personal") + ' reward" aria-label="New reward name" />' +
      (kind === "personal" ? '<input type="number" class="rw-cost" min="1" max="9999" inputmode="numeric" value="50" aria-label="Cost in points" /><span class="pts-unit">pts</span>' : "") +
      '<button class="btn small primary" type="button" data-act="reward-add">Add</button></div>';
  }

  function readRewardRow(row) {
    var kind = row.getAttribute("data-kind");
    var title = (row.querySelector(".rw-title").value || "").trim();
    var r = { kind: kind, title: title };
    if (kind === "personal") {
      var cost = parseInt(row.querySelector(".rw-cost").value, 10);
      r.cost = (cost > 0) ? cost : 50;
    }
    return r;
  }

  function onRewardsClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    var act = btn.getAttribute("data-act");
    var role = Store.phoneRole();

    if (act === "goal") {
      Store.setTeamGoal(Logic.stamp(currentMonday), btn.getAttribute("data-key"));
    } else if (act === "redeem") {
      rewardsUI.confirmKey = btn.getAttribute("data-key");
      renderRewards();
    } else if (act === "redeem-no") {
      rewardsUI.confirmKey = null;
      renderRewards();
    } else if (act === "redeem-yes") {
      var key = btn.getAttribute("data-key");
      var rw = personalRewards().filter(function (x) { return x.key === key; })[0];
      rewardsUI.confirmKey = null;
      if (!rw || !role) { renderRewards(); return; }
      if (balances()[role] < rw.cost) { toast("Not enough points yet."); renderRewards(); return; }
      Store.redeem(role, rw);
      toast("Redeemed: " + rw.title + ". " + Store.name(role === "me" ? "anna" : "me") + " will see it.");
    } else if (act === "fulfil" || act === "unfulfil") {
      Store.setRedemptionFulfilled(btn.getAttribute("data-id"), act === "fulfil");
    } else if (act === "cancel-redeem") {
      Store.cancelRedemption(btn.getAttribute("data-id"));
      toast("Cancelled. The points are back.");
    } else if (act === "edit-rewards") {
      rewardsUI.editing = !rewardsUI.editing;
      renderRewards();
    } else if (act === "reward-save") {
      var row = btn.closest(".reward-edit");
      var r = readRewardRow(row);
      if (!r.title) { toast("Give the reward a name."); return; }
      Store.setReward(row.getAttribute("data-key"), r);
      toast("Reward saved.");
    } else if (act === "reward-delete") {
      Store.deleteReward(btn.closest(".reward-edit").getAttribute("data-key"));
      toast("Reward removed.");
    } else if (act === "reward-add") {
      var addRow = btn.closest(".reward-edit");
      var nr = readRewardRow(addRow);
      if (!nr.title) { toast("Give the reward a name."); return; }
      Store.setReward("rw-" + Date.now() + "-" + Math.floor(Math.random() * 1e6).toString(36), nr);
      toast("Reward added.");
    }
  }

  // ---------- add / edit chores ----------
  var editingKey = null;

  var CADENCE_OPTIONS = [
    ["daily", "Every day"],
    ["weekly", "Weekly"],
    ["fortnightly", "Every 2 weeks"],
    ["monthly", "Monthly"],
    ["quarterly", "Every 3 months"]
  ];
  var DAY_OPTIONS = [["0", "Monday"], ["1", "Tuesday"], ["2", "Wednesday"], ["3", "Thursday"],
                     ["4", "Friday"], ["5", "Saturday"], ["6", "Sunday"]];
  var TIME_OPTIONS = [["anytime", "Anytime"], ["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]];

  function wireChoreForm() {
    document.querySelectorAll('[data-close="chore"]').forEach(function (b) {
      b.addEventListener("click", closeChoreForm);
    });
    els.saveChoreBtn.addEventListener("click", saveChore);
    els.deleteChoreBtn.addEventListener("click", deleteChore);
    els.choreSchedule.addEventListener("change", updateDayRowVisibility);
    els.choreMinutes.addEventListener("input", updatePtsHint);
  }

  function updateDayRowVisibility() {
    var daily = els.choreSchedule.value === "daily";
    els.choreDayRow.style.display = daily ? "none" : "";
    els.choreDaysRow.style.display = daily ? "" : "none";
  }

  function formMinutes() {
    var m = parseInt(els.choreMinutes.value, 10);
    return (m > 0) ? Math.min(m, 600) : Seed.DEFAULT_MINUTES;
  }

  function updatePtsHint() {
    els.chorePtsHint.textContent = "Worth " + plural(Game.points(formMinutes()), "point") + ".";
  }

  function fillSelect(sel, options, selected) {
    sel.innerHTML = options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === selected ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
  }

  function fillDays(days) {
    var on = Logic.validDays(days) || [0, 1, 2, 3, 4, 5, 6];
    els.choreDays.innerHTML = Seed.DAY_SHORT.map(function (d, i) {
      return '<label class="day-chip"><input type="checkbox" value="' + i + '"' + (on.indexOf(i) >= 0 ? " checked" : "") +
             " /><span>" + d + "</span></label>";
    }).join("");
  }

  function selectedDays() {
    var out = [];
    els.choreDays.querySelectorAll("input:checked").forEach(function (i) { out.push(+i.value); });
    return out;
  }

  function openChoreForm(key) {
    editingKey = key || null;
    var catOptions = Object.keys(Seed.CATEGORIES).map(function (k) { return [k, Seed.CATEGORIES[k].label]; });
    var whoOptions = [["both", Store.name("both")], ["me", Store.name("me")], ["anna", Store.name("anna")]];

    var tpl = editingKey ? Store.getEffectiveTemplate(editingKey) : null;
    var defaultDay = String(Logic.dayIndexOf(new Date()));
    els.choreSheetTitle.textContent = editingKey ? "Edit chore" : "New chore";
    els.choreTitle.value = tpl ? (tpl.title || "") : "";
    els.choreNotes.value = tpl ? (tpl.notes || "") : "";
    fillSelect(els.choreCategory, catOptions, tpl ? tpl.category : "cleaning");
    fillSelect(els.choreSchedule, CADENCE_OPTIONS, tpl ? (tpl.cadence || "weekly") : "weekly");
    fillSelect(els.choreDay, DAY_OPTIONS, tpl && typeof tpl.dayIndex === "number" ? String(tpl.dayIndex) : defaultDay);
    fillSelect(els.choreTime, TIME_OPTIONS, tpl ? (tpl.timeOfDay || "anytime") : "anytime");
    fillSelect(els.choreWho, whoOptions, tpl ? tpl.defaultAssignee : "both");
    fillDays(tpl ? tpl.days : null);
    els.choreClock.value = tpl ? (Logic.validTime(tpl.time) || "") : "";
    els.choreMinutes.value = tpl ? Logic.minutesOf(tpl) : Seed.DEFAULT_MINUTES;
    els.choreCore.checked = tpl ? !!tpl.core : false;
    updatePtsHint();
    els.deleteChoreBtn.hidden = !editingKey;
    updateDayRowVisibility();

    els.choreSheet.hidden = false;
    setTimeout(function () { els.choreTitle.focus(); }, 50);
  }

  function closeChoreForm() { els.choreSheet.hidden = true; editingKey = null; }

  function slotForCadence(cadence) {
    var W = Logic.weekIndex(currentMonday);
    if (cadence === "fortnightly") return Logic.mod(W, 2);
    if (cadence === "monthly") return Logic.mod(W, 4);
    if (cadence === "quarterly") return Logic.mod(W, 13);
    return 0;
  }

  function isCustomKey(key) { return key && key.indexOf("custom-") === 0; }

  function saveChore() {
    var title = (els.choreTitle.value || "").trim();
    if (!title) { els.choreTitle.focus(); toast("Give the chore a name."); return; }
    var cadence = els.choreSchedule.value;
    var dayIndex = parseInt(els.choreDay.value, 10) || 0;
    var timeOfDay = els.choreTime.value;
    var who = els.choreWho.value;
    var notes = (els.choreNotes.value || "").trim() || null;
    var clock = Logic.validTime(els.choreClock.value);
    var minutes = formMinutes();
    var core = !!els.choreCore.checked;
    var days = null;
    if (cadence === "daily") {
      days = selectedDays();
      if (!days.length) { toast("Pick at least one day."); return; }
    }

    // Editing a BUILT-IN chore: store only the changed fields as a synced override.
    // Cleared values are stored as "" or "none" (not null) so the clear survives sync.
    if (editingKey && !isCustomKey(editingKey)) {
      var eff = Store.getEffectiveTemplate(editingKey) || {};
      var patch = {};
      if (title !== eff.title) patch.title = title;
      if (els.choreCategory.value !== eff.category) patch.category = els.choreCategory.value;
      if (cadence !== eff.cadence) { patch.cadence = cadence; patch.slot = slotForCadence(cadence); }
      if (dayIndex !== eff.dayIndex) patch.dayIndex = dayIndex;
      if (timeOfDay !== (eff.timeOfDay || "anytime")) patch.timeOfDay = timeOfDay;
      if (who !== eff.defaultAssignee) patch.defaultAssignee = who;
      if (notes !== (eff.notes || null)) patch.notes = notes === null ? "" : notes;
      if (clock !== Logic.validTime(eff.time)) patch.time = clock || "";
      if (minutes !== Logic.minutesOf(eff)) patch.minutes = minutes;
      if (core !== !!eff.core) patch.core = core;
      var effDays = Logic.validDays(eff.days);
      var newDays = (days && days.length < 7) ? days : null;
      if (String(newDays) !== String(effDays)) patch.days = newDays || (effDays ? "none" : null);
      if (patch.days === null) delete patch.days;
      if (Object.keys(patch).length) Store.setTemplateEdit(editingKey, patch);
      closeChoreForm();
      toast("Chore updated.");
      return;
    }

    // New chore, or editing a custom one: store as a full custom template.
    var tpl = {
      title: title, category: els.choreCategory.value, cadence: cadence,
      dayIndex: dayIndex, timeOfDay: timeOfDay, defaultAssignee: who,
      slot: slotForCadence(cadence), notes: notes, locked: false, seasonal: false,
      minutes: minutes, core: core
    };
    if (clock) tpl.time = clock;
    if (days && days.length < 7) tpl.days = days;
    var key = editingKey || ("custom-" + Date.now() + "-" + Math.floor(Math.random() * 1e6).toString(36));
    Store.setCustomTemplate(key, tpl);
    closeChoreForm();
    toast(editingKey ? "Chore updated." : "Chore added.");
  }

  function deleteChore() {
    if (!editingKey) return;
    if (!confirm("Remove this chore from the plan? (Built-in chores can be brought back from Settings → Restore removed chores.)")) return;
    if (isCustomKey(editingKey)) Store.deleteCustomTemplate(editingKey);
    else Store.removeTemplate(editingKey);    // remove a built-in chore (synced)
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
  function toast(msg, ms) {
    if (!msg) return;
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, ms || 2400);
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
