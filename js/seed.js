/*
 * seed.js — Roo HQ
 * The household's actual plan (spec §6) plus the small enums the app needs.
 * Roo is female — she/her throughout.
 *
 * No modules / no build step: everything hangs off window.RooHQ so the app works
 * when opened straight from a file or hosted anywhere static.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";

  // Owner colour-coding (spec palette). Honey is the "Roo-care" accent.
  var ROLES = {
    me:   { key: "me",   defaultName: "Alex", initial: "A", color: "#2E6E72" },
    anna: { key: "anna", defaultName: "Anna", initial: "A", color: "#C05A6E" },
    both: { key: "both", defaultName: "Both", initial: "B", color: "#7E5A86" }
  };
  // The three roles a chore can be swapped between.
  var SWAP_TARGETS = ["me", "anna", "both"];

  // Category → label + emoji icon. Dog = Roo-care (honey).
  var CATEGORIES = {
    dog:      { label: "Roo-care", icon: "🐾", rooCare: true },
    kitchen:  { label: "Kitchen",  icon: "🍴" },
    cleaning: { label: "Cleaning", icon: "✨" },
    laundry:  { label: "Laundry",  icon: "🧺" },
    garden:   { label: "Garden",   icon: "🌿" },
    gym:      { label: "Gym",      icon: "🏋️" },
    bins:     { label: "Bins",     icon: "🗑️" },
    mealprep: { label: "Meal prep",icon: "🥕" }
  };

  var TIME_ORDER = { morning: 0, midday: 1, evening: 2, anytime: 3 };
  var TIME_LABEL = { morning: "Morning", midday: "Midday", evening: "Evening", anytime: "" };

  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Schedule kind → day indices (0 = Mon … 6 = Sun).
  var SCHEDULE_DAYS = {
    daily:            [0, 1, 2, 3, 4, 5, 6],
    weekday:          [0, 1, 2, 3, 4],
    monday:           [0],
    tuesday:          [1],
    wednesday:        [2],
    thursday:         [3],
    friday:           [4],
    saturday:         [5],
    sunday:           [6],
    "weekly-in-season": [5] // Saturday "jobs day"
  };

  // t(key, title, category, schedule, timeOfDay, assignee, opts)
  function t(key, title, category, schedule, timeOfDay, assignee, opts) {
    opts = opts || {};
    return {
      key: key, title: title, category: category, schedule: schedule,
      timeOfDay: timeOfDay || "anytime", defaultAssignee: assignee,
      locked: !!opts.locked, swappable: opts.swappable !== false, notes: opts.notes || null
    };
  }

  var TEMPLATES = [
    // Every day
    t("roo-breakfast", "Roo's breakfast, toilet & water", "dog", "daily", "morning", "me"),
    t("roo-morning-walk", "Roo morning walk", "dog", "daily", "morning", "anna",
      { notes: "WFH days; Me does a short one on Anna's office days." }),
    t("roo-lunch-walk", "Roo lunchtime walk", "dog", "weekday", "midday", "anna",
      { notes: "Doubles as Anna's screen break. Book a walker on her office days." }),
    t("laundry-load-daily", "Put a laundry load on", "laundry", "weekday", "midday", "anna"),
    t("roo-evening-walk", "Roo's main evening walk", "dog", "daily", "evening", "alternate",
      { notes: "Alternates day to day; pairs with the gym stagger — whoever trains, the other walks her." }),
    t("roo-dinner-kitchen", "Roo's dinner + reheat meal + wash up + wipe kitchen", "kitchen", "daily", "evening", "me"),
    t("brush-roo", "Brush Roo after her walk", "dog", "daily", "evening", "anna",
      { notes: "Mucky Aberdeenshire paths." }),
    t("living-tidy-bin", "10-minute living-areas tidy + kitchen bin", "cleaning", "daily", "evening", "both"),
    t("make-bed", "Make the bed", "cleaning", "daily", "morning", "both"),

    // Monday
    t("mon-hoover", "Hoover hall, stairs & living room", "cleaning", "monday", "anytime", "anna"),
    t("mon-laundry-gym", "Laundry load 1 — gym kit & towels", "laundry", "monday", "anytime", "anna"),
    t("mon-bins-in", "Bring the bins back in", "bins", "monday", "anytime", "me",
      { notes: "After Monday collection." }),

    // Tuesday
    t("tue-ensuite", "Clean the ensuite", "cleaning", "tuesday", "anytime", "me"),
    t("tue-family-bath", "Clean the family bathroom", "cleaning", "tuesday", "anytime", "anna"),

    // Wednesday
    t("wed-kitchen-deepwipe", "Kitchen deep-wipe (cupboards + appliances)", "kitchen", "wednesday", "anytime", "me"),
    t("wed-dust-living", "Dust the living room", "cleaning", "wednesday", "anytime", "anna"),
    t("wed-tidy-study", "Tidy your own study", "cleaning", "wednesday", "anytime", "both"),

    // Thursday
    t("thu-3rd-bath", "Clean the 3rd bathroom + mop bathroom floors", "cleaning", "thursday", "anytime", "anna"),
    t("thu-laundry-clothes", "Laundry load 2 — clothes", "laundry", "thursday", "anytime", "anna"),
    t("thu-roo-bowls", "Scrub Roo's bowls + restock her supplies", "dog", "thursday", "anytime", "me"),

    // Friday (both home)
    t("fri-midday-hoover", "Midday hoover of the main areas", "cleaning", "friday", "anytime", "me"),
    t("fri-bed-linen", "Change the bed linen", "laundry", "friday", "anytime", "both"),
    t("fri-roo-blanket", "Wash Roo's bed cover / blanket", "laundry", "friday", "anytime", "anna"),
    t("fri-reset-desks", "Reset both desks", "cleaning", "friday", "anytime", "both"),

    // Saturday (jobs day)
    t("sat-full-hoover", "Full hoover — whole house incl. bedrooms", "cleaning", "saturday", "anytime", "anna"),
    t("sat-mop-floors", "Mop all hard floors", "cleaning", "saturday", "anytime", "me"),
    t("sat-gym", "Clean the gym", "gym", "saturday", "anytime", "me"),
    t("mow-edge", "Mow + edge", "garden", "weekly-in-season", "anytime", "anna",
      { locked: true, swappable: false, notes: "Locked to Anna — Me's grass allergy. Weekly in season, fortnightly at most." }),
    t("sat-garden-project", "Garden project task (non-grass)", "garden", "saturday", "anytime", "me"),
    t("sat-roo-adventure", "Roo's adventure walk", "dog", "saturday", "anytime", "both"),

    // Sunday (prep & reset)
    t("sun-meal-plan-shop", "Plan the week's meals + food shop", "mealprep", "sunday", "anytime", "anna"),
    t("sun-meal-prep-cook", "Cook & portion the meal prep, store, wash up", "mealprep", "sunday", "anytime", "me"),
    t("sun-final-laundry", "Final laundry + ironing + wipe kitchen", "laundry", "sunday", "anytime", "anna"),
    t("sun-bins-out", "Bins out — Monday collection", "bins", "sunday", "evening", "me")
  ];

  var RULES = {
    grassAllergy: "Mowing and edging are locked to Anna; Me avoids cut grass.",
    foodAndDishes: "Cooking, washing-up and food handling default to Me; balanced back to Anna with extra cleaning, laundry and walking.",
    binDay: "Monday — out Sunday night.",
    mealPrep: "Sunday."
  };

  RooHQ.Seed = {
    ROLES: ROLES,
    SWAP_TARGETS: SWAP_TARGETS,
    CATEGORIES: CATEGORIES,
    TIME_ORDER: TIME_ORDER,
    TIME_LABEL: TIME_LABEL,
    DAY_SHORT: DAY_SHORT,
    DAY_FULL: DAY_FULL,
    SCHEDULE_DAYS: SCHEDULE_DAYS,
    TEMPLATES: TEMPLATES,
    RULES: RULES,
    DOG: { name: "Roo", type: "Golden Retriever", pronouns: "she/her" },
    GYM: {
      me: ["Mon pm", "Wed pm", "Fri pm", "Sat am"],
      anna: ["Tue lunch", "Thu lunch", "Sat am", "+1 flexible"]
    }
  };
})(window.RooHQ);
