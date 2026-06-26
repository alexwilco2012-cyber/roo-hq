/*
 * seed.js — Roo HQ
 * Alex and Anna's actual household chores, organised by how often they recur
 * (daily / weekly / fortnightly / monthly / quarterly). Roo is female — she/her throughout.
 * This file is generated from their chore list; edit chores in-app rather than here.
 */
window.RooHQ = window.RooHQ || {};

(function (RooHQ) {
  "use strict";

  var ROLES = {
    me:   { key: "me",   defaultName: "Alex", initial: "A", color: "#2E6E72" },
    anna: { key: "anna", defaultName: "Anna", initial: "A", color: "#C05A6E" }
  };
  var SWAP_TARGETS = ["me", "anna", "both"];

  var CATEGORIES = {
    dog:      { label: "Roo-care", icon: "\u{1F43E}", rooCare: true },
    kitchen:  { label: "Kitchen",  icon: "\u{1F374}" },
    cleaning: { label: "Cleaning", icon: "✨" },
    laundry:  { label: "Laundry",  icon: "\u{1F9FA}" },
    garden:   { label: "Garden",   icon: "\u{1F33F}" },
    gym:      { label: "Gym",      icon: "\u{1F3CB}️" },
    bins:     { label: "Bins",     icon: "\u{1F5D1}️" },
    mealprep: { label: "Meal prep",icon: "\u{1F955}" },
    social:   { label: "Social",   icon: "\u{1F942}" }
  };

  var TIME_ORDER = { morning: 0, midday: 1, evening: 2, anytime: 3 };
  var TIME_LABEL = { morning: "Morning", midday: "Midday", evening: "Evening", anytime: "" };

  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var TEMPLATES = [
    { key: 'empty-dishwasher', title: 'Empty dishwasher', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'load-dishwasher', title: 'Load dishwasher', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'wipe-down-sink-backsplash-and-windowsill', title: 'Wipe down sink, backsplash and windowsill', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'unload-drying-rack', title: 'Unload drying rack', category: 'laundry', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'wipe-tablecloth', title: 'Wipe tablecloth', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'make-bed', title: 'Make bed', category: 'cleaning', cadence: 'daily', dayIndex: 0, timeOfDay: 'morning', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'wipe-around-shower-tray', title: 'Wipe around shower tray', category: 'cleaning', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'recycling-to-the-girls', title: 'Recycling to the girls', category: 'bins', cadence: 'daily', dayIndex: 0, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'load-laundry', title: 'Load laundry', category: 'laundry', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'empty-laundry', title: 'Empty laundry', category: 'laundry', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hang-laundry', title: 'Hang laundry', category: 'laundry', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'put-away-laundry', title: 'Put away laundry', category: 'laundry', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'walk-roo-in-the-morning', title: 'Walk Roo in the morning', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'morning', defaultAssignee: 'alternate', slot: 0, locked: false, seasonal: false, notes: 'Before work — whoever is up; alternates.' },
    { key: 'walk-roo-in-the-evening', title: 'Walk Roo in the evening', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'evening', defaultAssignee: 'alternate', slot: 0, locked: false, seasonal: false, notes: 'Main evening walk; alternate between Alex and Anna.' },
    { key: 'play-with-roo', title: 'Play with Roo', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'pick-up-roo-s-poops', title: 'Pick up Roo\'s poops', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'gym-workout-together', title: 'Gym — workout together', category: 'gym', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, notes: 'The joint Saturday session.' },
    { key: 'gym-alex-mon', title: 'Gym — Alex', category: 'gym', cadence: 'weekly', dayIndex: 0, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: 'Staggered with Anna so one walks Roo while the other trains.' },
    { key: 'gym-alex-wed', title: 'Gym — Alex', category: 'gym', cadence: 'weekly', dayIndex: 2, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'gym-alex-fri', title: 'Gym — Alex', category: 'gym', cadence: 'weekly', dayIndex: 4, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'gym-anna-tue', title: 'Gym — Anna', category: 'gym', cadence: 'weekly', dayIndex: 1, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Evening session, staggered with Alex.' },
    { key: 'gym-anna-thu', title: 'Gym — Anna', category: 'gym', cadence: 'weekly', dayIndex: 3, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Evening session.' },
    { key: 'gym-anna-flex', title: 'Gym — Anna (flexible)', category: 'gym', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Fourth session — move it to whenever suits.' },
    { key: 'date-night', title: 'Date night', category: 'social', cadence: 'weekly', dayIndex: 6, timeOfDay: 'evening', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, notes: 'Protect a shared evening — your overlapping rest day.' },
    { key: 'tidy-kitchen-top', title: 'Tidy kitchen top', category: 'kitchen', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-kitchen-top', title: 'Clean kitchen top', category: 'kitchen', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-kitchen-appliances', title: 'Clean kitchen appliances', category: 'kitchen', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-kitchen-hob', title: 'Clean kitchen hob', category: 'kitchen', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'wash-kitchen-cupboard-doors', title: 'Wash kitchen cupboard doors', category: 'kitchen', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'empty-food-bin', title: 'Empty food bin', category: 'bins', cadence: 'weekly', dayIndex: 4, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-small-fridge', title: 'Clean small fridge', category: 'kitchen', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-dining-room', title: 'Hoover dining room', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-dining-table-base', title: 'Clean dining table base', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-all-windowsills', title: 'Clean all windowsills', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'swap-hank-mops', title: 'Swap Hank mops', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'swap-hank-water', title: 'Swap Hank water', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'clean-downstairs-toilet-and-sink', title: 'Clean downstairs toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-downstairs-toilet-surround', title: 'Clean downstairs toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-downstairs-toilet-mirror', title: 'Clean downstairs toilet mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-downstairs-floor', title: 'Clean downstairs floor', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-stairs', title: 'Hoover stairs', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-upstairs-landing', title: 'Hoover upstairs landing', category: 'cleaning', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-main-bathroom-floor', title: 'Hoover main bathroom floor', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'mop-main-bathroom-floor', title: 'Mop main bathroom floor', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-main-toilet-and-sink', title: 'Clean main toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-main-toilet-surround', title: 'Clean main toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-main-toilet-mirror', title: 'Clean main toilet mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-master-bedroom', title: 'Hoover master bedroom', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-en-suite-floor', title: 'Hoover en-suite floor', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'mop-en-suite-floor', title: 'Mop en-suite floor', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-en-suite-toilet-and-sink', title: 'Clean en-suite toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-en-suite-toilet-surround', title: 'Clean en-suite toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-en-suite-mirror', title: 'Clean en-suite mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'dust-venjakob-and-tv', title: 'Dust Venjakob and TV', category: 'cleaning', cadence: 'fortnightly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: 'Living room Venjakob furniture and TV unit.' },
    { key: 'spot-clean-living-room-throws', title: 'Spot clean living room throws', category: 'cleaning', cadence: 'fortnightly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'clean-arm-rests', title: 'Clean arm rests', category: 'cleaning', cadence: 'fortnightly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-sofa-and-chair-gaps', title: 'Hoover sofa and chair gaps', category: 'cleaning', cadence: 'fortnightly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'hoover-and-mop-conservatory', title: 'Hoover and mop conservatory', category: 'cleaning', cadence: 'fortnightly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-sofa-and-chairs-in-conservatory', title: 'Hoover sofa and chairs in conservatory', category: 'cleaning', cadence: 'fortnightly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'use-brush-on-stairs', title: 'Use brush on stairs', category: 'cleaning', cadence: 'fortnightly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Stair edges and corners.' },
    { key: 'wipe-bannisters-and-slats', title: 'Wipe bannisters and slats', category: 'cleaning', cadence: 'fortnightly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'clean-main-bathroom-bathtub', title: 'Clean main bathroom bathtub', category: 'cleaning', cadence: 'fortnightly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-main-bathroom-shower', title: 'Clean main bathroom shower', category: 'cleaning', cadence: 'fortnightly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'dust-master-bedroom-bedside-tables', title: 'Dust master bedroom bedside tables', category: 'cleaning', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'hoover-guest-bedroom', title: 'Hoover guest bedroom', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'dust-guest-bedroom-bedside-tables', title: 'Dust guest bedroom bedside tables', category: 'cleaning', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'dust-garage-storage', title: 'Dust garage storage', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'dust-garage-walls', title: 'Dust garage walls', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'edge-grass-front-and-back', title: 'Edge grass front and back', category: 'garden', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 1, locked: true, seasonal: true, notes: 'Alex has a severe grass allergy; Anna handles all grass cutting.' },
    { key: 'change-master-bedroom-bed-sheets', title: 'Change master bedroom bed sheets', category: 'laundry', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'morning', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-microwave', title: 'Clean microwave', category: 'kitchen', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-oven', title: 'Clean oven', category: 'kitchen', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, notes: 'Heavier job, suits Saturday.' },
    { key: 'clean-all-light-switches', title: 'Clean all light switches', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'clean-all-door-handles', title: 'Clean all door handles', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'dust-all-light-shades-and-lights', title: 'Dust all light shades and lights', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'clean-all-skirting-boards', title: 'Clean all skirting boards', category: 'cleaning', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'clean-all-radiators', title: 'Clean all radiators', category: 'cleaning', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 3, locked: false, seasonal: false, notes: null },
    { key: 'water-dining-room-plant', title: 'Water dining room plant', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'morning', defaultAssignee: 'me', slot: 3, locked: false, seasonal: false, notes: null },
    { key: 'clean-hank-base', title: 'Clean Hank base', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'hoover-downstairs-cupboard-shoe-and-stor', title: 'Hoover downstairs cupboard (shoe and storage)', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'wash-utility-floor-mat', title: 'Wash utility floor mat', category: 'laundry', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'anna-s-office-clean-desk', title: 'Anna\'s office: clean desk', category: 'cleaning', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'anna-s-office-clean-mirror', title: 'Anna\'s office: clean mirror', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'anna-s-office-clean-cabinet-top', title: 'Anna\'s office: clean cabinet top', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'anna-s-office-clean-chair', title: 'Anna\'s office: clean chair', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 3, locked: false, seasonal: false, notes: null },
    { key: 'alex-s-office-clean-desk', title: 'Alex\'s office: clean desk', category: 'cleaning', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 3, locked: false, seasonal: false, notes: null },
    { key: 'alex-s-office-hoover-floor', title: 'Alex\'s office: hoover floor', category: 'cleaning', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'hoover-under-sofa-and-chairs', title: 'Hoover under sofa and chairs', category: 'cleaning', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'organise-airing-cupboard-shelf', title: 'Organise airing cupboard shelf', category: 'cleaning', cadence: 'monthly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'clean-wardrobe-doors', title: 'Clean wardrobe doors', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: null },
    { key: 'clean-utility-freezer', title: 'Clean utility freezer', category: 'kitchen', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 3, locked: false, seasonal: false, notes: null },
    { key: 'organise-utility-cupboard', title: 'Organise utility cupboard', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, notes: null },
    { key: 'plan-activity-with-friends', title: 'Plan an activity with friends', category: 'social', cadence: 'monthly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 1, locked: false, seasonal: false, notes: 'Two activities with friends, spread over the month.' },
    { key: 'clean-front-door-and-entry', title: 'Clean front door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, notes: 'Interior front door and entry area.' },
    { key: 'clean-back-door-and-entry', title: 'Clean back door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 2, locked: false, seasonal: false, notes: null },
    { key: 'clean-conservatory-door-and-entry', title: 'Clean conservatory door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 4, locked: false, seasonal: false, notes: null },
    { key: 'clean-washing-machine', title: 'Clean washing machine', category: 'laundry', cadence: 'quarterly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 6, locked: false, seasonal: false, notes: 'Run a maintenance/cleaning cycle.' },
    { key: 'clean-dishwasher', title: 'Clean dishwasher', category: 'kitchen', cadence: 'quarterly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 8, locked: false, seasonal: false, notes: 'Run a maintenance/cleaning cycle.' },
    { key: 'clean-garage-doors', title: 'Clean garage doors', category: 'garden', cadence: 'quarterly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 10, locked: false, seasonal: false, notes: 'Exterior garage doors.' },
    { key: 'clean-gutters-and-roof', title: 'Clean gutters and roof', category: 'garden', cadence: 'quarterly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 12, locked: false, seasonal: false, notes: 'Heavier outdoor job; suits a Saturday/weekend.' }
  ];

  var RULES = {
    grassAllergy: "Edging and grass cutting are locked to Anna — Alex's grass allergy.",
    foodAndDishes: "Kitchen, dishes and bins default to Alex; cleaning and laundry are split so the weekly time is about even for both of you.",
    sharing: "Owners are balanced by time, not task count — and every chore is a one-tap swap. Both start chores after 5pm.",
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
    TEMPLATES: TEMPLATES,
    RULES: RULES,
    DOG: { name: "Roo", type: "Golden Retriever", pronouns: "she/her" },
    GYM: { note: 'Gym sessions run four times a week each for Anna and Alex, staggered, with a together workout on Saturday. One rest period is aligned for both so it can be used for date night or a leisure activity. Anna can take one lunchtime gym session a week if needed to make the arrangement work.' }
  };
})(window.RooHQ);