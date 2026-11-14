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
    me:   { key: "me",   defaultName: "Alex", initial: "A", color: "#2B4F8F" },
    anna: { key: "anna", defaultName: "Anna", initial: "A", color: "#7A3F9E" }
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
    social:   { label: "Social",   icon: "\u{1F942}" },
    plan:     { label: "Planning", icon: "\u{1F5D3}️" }
  };

  var TIME_ORDER = { morning: 0, midday: 1, evening: 2, anytime: 3 };
  var TIME_LABEL = { morning: "Morning", midday: "Midday", evening: "Evening", anytime: "" };

  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var TEMPLATES = [
    // Daily kitchen reset: one card for emptying and loading the dishwasher and wiping the sink, backsplash and windowsill.
    { key: 'kitchen-reset', title: 'Kitchen reset: dishwasher, sink and surfaces', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 25, core: true, notes: 'Empty and load the dishwasher. Wipe the sink, backsplash and windowsill.' },
    // Daily laundry: one card for load, empty, hang, put away and unload the drying rack.
    // Monday to Thursday alternates day by day and flips each week, so Alex has two of those days every week.
    // Friday to Sunday is Anna's: Alex has the Sunday cook, and this keeps the weekly time balanced.
    { key: 'laundry', title: 'Laundry: wash, hang and put away', category: 'laundry', cadence: 'daily', days: [0, 1, 2, 3], dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'alternate', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: 'Load, empty, hang and put away. Unload the drying rack.' },
    { key: 'laundry-fri-sun', title: 'Laundry: wash, hang and put away', category: 'laundry', cadence: 'daily', days: [4, 5, 6], dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: 'Load, empty, hang and put away. Unload the drying rack.' },
    { key: 'wipe-tablecloth', title: 'Wipe tablecloth', category: 'kitchen', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 2, core: false, notes: null },
    { key: 'make-bed', title: 'Make bed', category: 'cleaning', cadence: 'daily', dayIndex: 0, timeOfDay: 'morning', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'wipe-around-shower-tray', title: 'Wipe around shower tray', category: 'cleaning', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'recycling-to-the-girls', title: 'Recycling to the girls', category: 'bins', cadence: 'daily', dayIndex: 0, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    // Roo's walks and meals. Two 30-minute walks and two meals a day; times differ by day.
    // Where the same person walks and feeds her back to back, it is one card.
    // Monday to Thursday: Alex does the early walk and breakfast before work. Evenings: Alex on Monday and Wednesday, Anna on Tuesday and Thursday.
    { key: 'roo-am-mon-thu', title: 'Walk Roo, then her breakfast', category: 'dog', cadence: 'daily', days: [0, 1, 2, 3], dayIndex: 0, time: '06:00', timeOfDay: 'morning', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: 'Back by 06:30, then 30 minutes to get ready. Leave at 07:00.' },
    { key: 'roo-pm-mon-wed', title: 'Walk Roo, then her dinner', category: 'dog', cadence: 'daily', days: [0, 2], dayIndex: 0, time: '17:30', timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: 'Straight after getting home. Dinner at 18:00.' },
    // Tuesday and Thursday evenings are Anna's (she is home). On her office days they move to Alex.
    { key: 'roo-pm-tue-thu', title: 'Walk Roo, then her dinner', category: 'dog', cadence: 'daily', days: [1, 3], dayIndex: 1, time: '17:00', timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: null },
    // Friday: Alex works from home.
    { key: 'roo-am-fri', title: 'Walk Roo, then her breakfast', category: 'dog', cadence: 'weekly', dayIndex: 4, time: '06:45', timeOfDay: 'morning', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 35, core: true, notes: null },
    { key: 'roo-dinner-fri', title: 'Roo\'s dinner', category: 'dog', cadence: 'weekly', dayIndex: 4, time: '17:30', timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 5, core: true, notes: null },
    { key: 'roo-walk-pm-fri', title: 'Evening walk with Roo', category: 'dog', cadence: 'weekly', dayIndex: 4, time: '18:15', timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 30, core: true, notes: null },
    // Saturday and Sunday.
    { key: 'roo-breakfast-weekend', title: 'Roo\'s breakfast', category: 'dog', cadence: 'daily', days: [5, 6], dayIndex: 5, time: '08:00', timeOfDay: 'morning', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 5, core: true, notes: null },
    { key: 'roo-morning-out-weekend', title: 'Morning out with Roo', category: 'dog', cadence: 'daily', days: [5, 6], dayIndex: 5, time: '08:30', timeOfDay: 'morning', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 60, core: true, notes: 'An hour or more, together.' },
    { key: 'roo-dinner-weekend', title: 'Roo\'s dinner', category: 'dog', cadence: 'daily', days: [5, 6], dayIndex: 5, time: '17:00', timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 5, core: true, notes: null },
    { key: 'roo-walk-pm-sat', title: 'Evening walk with Roo', category: 'dog', cadence: 'weekly', dayIndex: 5, time: '17:30', timeOfDay: 'evening', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 30, core: true, notes: null },
    { key: 'roo-walk-pm-sun', title: 'Evening walk with Roo', category: 'dog', cadence: 'weekly', dayIndex: 6, time: '17:45', timeOfDay: 'evening', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 30, core: true, notes: null },
    // Sunday evening: bin out for Monday's collection, and the week check-in.
    { key: 'bin-out', title: 'Put the bin out', category: 'bins', cadence: 'weekly', dayIndex: 6, time: '19:00', timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 5, core: true, binColour: true, notes: 'Collected on Monday. Black, blue and orange take turns.' },
    { key: 'week-check-in', title: 'Week check-in: Anna\'s office days, tell Anna\'s mum, meals', category: 'plan', cadence: 'weekly', dayIndex: 6, time: '17:30', timeOfDay: 'evening', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 15, core: true, notes: null },
    { key: 'play-with-roo', title: 'Play with Roo', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'pick-up-roo-s-poops', title: 'Pick up Roo\'s poops', category: 'dog', cadence: 'daily', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'gym-workout-together', title: 'Gym — workout together', category: 'gym', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 60, core: false, notes: 'The joint Saturday session.' },
    { key: 'gym-alex-home', title: 'Alex\'s home gym', category: 'gym', cadence: 'daily', days: [0, 2, 4], dayIndex: 0, time: '05:30', timeOfDay: 'morning', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 30, core: false, startsOn: '20261116', notes: 'Home gym, 30 minutes, before Roo\'s morning walk.' },
    { key: 'gym-anna-tue', title: 'Gym — Anna', category: 'gym', cadence: 'weekly', dayIndex: 1, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 60, core: false, notes: 'Evening session, staggered with Alex.' },
    { key: 'gym-anna-thu', title: 'Gym — Anna', category: 'gym', cadence: 'weekly', dayIndex: 3, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 60, core: false, notes: 'Evening session.' },
    { key: 'gym-anna-flex', title: 'Gym — Anna (flexible)', category: 'gym', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 0, locked: false, seasonal: false, minutes: 60, core: false, notes: 'Fourth session — move it to whenever suits.' },
    { key: 'date-night', title: 'Date night', category: 'social', cadence: 'weekly', dayIndex: 2, timeOfDay: 'evening', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 120, core: false, notes: 'Protect a shared evening — your overlapping rest day.' },
    { key: 'tidy-kitchen-top', title: 'Tidy kitchen top', category: 'kitchen', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-kitchen-top', title: 'Clean kitchen top', category: 'kitchen', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-kitchen-appliances', title: 'Clean kitchen appliances', category: 'kitchen', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-kitchen-hob', title: 'Clean kitchen hob', category: 'kitchen', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'wash-kitchen-cupboard-doors', title: 'Wash kitchen cupboard doors', category: 'kitchen', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'empty-food-bin', title: 'Empty food bin', category: 'bins', cadence: 'weekly', dayIndex: 4, timeOfDay: 'evening', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'clean-small-fridge', title: 'Clean small fridge', category: 'kitchen', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'hoover-dining-room', title: 'Hoover dining room', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-dining-table-base', title: 'Clean dining table base', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-all-windowsills', title: 'Clean all windowsills', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'swap-hank-mops', title: 'Swap Hank mops', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'swap-hank-water', title: 'Swap Hank water', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'clean-downstairs-toilet-and-sink', title: 'Clean downstairs toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-downstairs-toilet-surround', title: 'Clean downstairs toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'clean-downstairs-toilet-mirror', title: 'Clean downstairs toilet mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 0, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'clean-downstairs-floor', title: 'Clean downstairs floor', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'hoover-stairs', title: 'Hoover stairs', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'hoover-upstairs-landing', title: 'Hoover upstairs landing', category: 'cleaning', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'hoover-main-bathroom-floor', title: 'Hoover main bathroom floor', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'mop-main-bathroom-floor', title: 'Mop main bathroom floor', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-main-toilet-and-sink', title: 'Clean main toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-main-toilet-surround', title: 'Clean main toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'clean-main-toilet-mirror', title: 'Clean main toilet mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'hoover-master-bedroom', title: 'Hoover master bedroom', category: 'cleaning', cadence: 'weekly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'hoover-en-suite-floor', title: 'Hoover en-suite floor', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'mop-en-suite-floor', title: 'Mop en-suite floor', category: 'cleaning', cadence: 'weekly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-en-suite-toilet-and-sink', title: 'Clean en-suite toilet and sink', category: 'cleaning', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-en-suite-toilet-surround', title: 'Clean en-suite toilet surround', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'clean-en-suite-mirror', title: 'Clean en-suite mirror', category: 'cleaning', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'dust-venjakob-and-tv', title: 'Dust Venjakob and TV', category: 'cleaning', cadence: 'fortnightly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: 'Living room Venjakob furniture and TV unit.' },
    { key: 'spot-clean-living-room-throws', title: 'Spot clean living room throws', category: 'cleaning', cadence: 'fortnightly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-arm-rests', title: 'Clean arm rests', category: 'cleaning', cadence: 'fortnightly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'hoover-sofa-and-chair-gaps', title: 'Hoover sofa and chair gaps', category: 'cleaning', cadence: 'fortnightly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'hoover-and-mop-conservatory', title: 'Hoover and mop conservatory', category: 'cleaning', cadence: 'fortnightly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'hoover-sofa-and-chairs-in-conservatory', title: 'Hoover sofa and chairs in conservatory', category: 'cleaning', cadence: 'fortnightly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'use-brush-on-stairs', title: 'Use brush on stairs', category: 'cleaning', cadence: 'fortnightly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: 'Stair edges and corners.' },
    { key: 'wipe-bannisters-and-slats', title: 'Wipe bannisters and slats', category: 'cleaning', cadence: 'fortnightly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-main-bathroom-bathtub', title: 'Clean main bathroom bathtub', category: 'cleaning', cadence: 'fortnightly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-main-bathroom-shower', title: 'Clean main bathroom shower', category: 'cleaning', cadence: 'fortnightly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'dust-master-bedroom-bedside-tables', title: 'Dust master bedroom bedside tables', category: 'cleaning', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 0, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'hoover-guest-bedroom', title: 'Hoover guest bedroom', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'dust-guest-bedroom-bedside-tables', title: 'Dust guest bedroom bedside tables', category: 'cleaning', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', rotation: ['me','me','me','anna'], slot: 1, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'dust-garage-storage', title: 'Dust garage storage', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'dust-garage-walls', title: 'Dust garage walls', category: 'cleaning', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'edge-grass-front-and-back', title: 'Edge grass front and back', category: 'garden', cadence: 'fortnightly', dayIndex: 5, timeOfDay: 'evening', defaultAssignee: 'anna', slot: 1, locked: true, seasonal: true, minutes: 45, core: false, notes: 'Alex has a severe grass allergy; Anna handles all grass cutting.' },
    { key: 'change-master-bedroom-bed-sheets', title: 'Change master bedroom bed sheets', category: 'laundry', cadence: 'fortnightly', dayIndex: 6, timeOfDay: 'morning', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'clean-microwave', title: 'Clean microwave', category: 'kitchen', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'clean-oven', title: 'Clean oven', category: 'kitchen', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 45, core: false, notes: 'Heavier job, suits Saturday.' },
    { key: 'clean-all-light-switches', title: 'Clean all light switches', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-all-door-handles', title: 'Clean all door handles', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'dust-all-light-shades-and-lights', title: 'Dust all light shades and lights', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 2, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'clean-all-skirting-boards', title: 'Clean all skirting boards', category: 'cleaning', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 2, locked: false, seasonal: false, minutes: 40, core: false, notes: null },
    { key: 'clean-all-radiators', title: 'Clean all radiators', category: 'cleaning', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 3, locked: false, seasonal: false, minutes: 30, core: false, notes: null },
    { key: 'water-dining-room-plant', title: 'Water dining room plant', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'morning', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 3, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'clean-hank-base', title: 'Clean Hank base', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 10, core: false, notes: 'Hank is the robot mop/vacuum.' },
    { key: 'hoover-downstairs-cupboard-shoe-and-stor', title: 'Hoover downstairs cupboard (shoe and storage)', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'wash-utility-floor-mat', title: 'Wash utility floor mat', category: 'laundry', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'anna-s-office-clean-desk', title: 'Anna\'s office: clean desk', category: 'cleaning', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 1, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'anna-s-office-clean-mirror', title: 'Anna\'s office: clean mirror', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 2, locked: false, seasonal: false, minutes: 3, core: false, notes: null },
    { key: 'anna-s-office-clean-cabinet-top', title: 'Anna\'s office: clean cabinet top', category: 'cleaning', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 2, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'anna-s-office-clean-chair', title: 'Anna\'s office: clean chair', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', slot: 3, locked: false, seasonal: false, minutes: 5, core: false, notes: null },
    { key: 'alex-s-office-clean-desk', title: 'Alex\'s office: clean desk', category: 'cleaning', cadence: 'monthly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 3, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'alex-s-office-hoover-floor', title: 'Alex\'s office: hoover floor', category: 'cleaning', cadence: 'monthly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 2, locked: false, seasonal: false, minutes: 10, core: false, notes: null },
    { key: 'hoover-under-sofa-and-chairs', title: 'Hoover under sofa and chairs', category: 'cleaning', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'organise-airing-cupboard-shelf', title: 'Organise airing cupboard shelf', category: 'cleaning', cadence: 'monthly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 2, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'clean-wardrobe-doors', title: 'Clean wardrobe doors', category: 'cleaning', cadence: 'monthly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 15, core: false, notes: null },
    { key: 'clean-utility-freezer', title: 'Clean utility freezer', category: 'kitchen', cadence: 'monthly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 3, locked: false, seasonal: false, minutes: 30, core: false, notes: null },
    { key: 'organise-utility-cupboard', title: 'Organise utility cupboard', category: 'cleaning', cadence: 'monthly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 1, locked: false, seasonal: false, minutes: 30, core: false, notes: null },
    { key: 'plan-activity-with-friends', title: 'Plan an activity with friends', category: 'social', cadence: 'monthly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 1, locked: false, seasonal: false, minutes: 15, core: false, notes: 'Two activities with friends, spread over the month.' },
    { key: 'clean-front-door-and-entry', title: 'Clean front door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 0, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 20, core: false, notes: 'Interior front door and entry area.' },
    { key: 'clean-back-door-and-entry', title: 'Clean back door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 1, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 2, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'clean-conservatory-door-and-entry', title: 'Clean conservatory door and entry', category: 'cleaning', cadence: 'quarterly', dayIndex: 2, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 4, locked: false, seasonal: false, minutes: 20, core: false, notes: null },
    { key: 'clean-washing-machine', title: 'Clean washing machine', category: 'laundry', cadence: 'quarterly', dayIndex: 3, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 6, locked: false, seasonal: false, minutes: 10, core: false, notes: 'Run a maintenance/cleaning cycle.' },
    { key: 'clean-dishwasher', title: 'Clean dishwasher', category: 'kitchen', cadence: 'quarterly', dayIndex: 4, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 8, locked: false, seasonal: false, minutes: 10, core: false, notes: 'Run a maintenance/cleaning cycle.' },
    { key: 'clean-garage-doors', title: 'Clean garage doors', category: 'garden', cadence: 'quarterly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','me','anna','anna'], slot: 10, locked: false, seasonal: false, minutes: 30, core: false, notes: 'Exterior garage doors.' },
    { key: 'clean-gutters-and-roof', title: 'Clean gutters and roof', category: 'garden', cadence: 'quarterly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','me','anna'], slot: 12, locked: false, seasonal: false, minutes: 90, core: false, notes: 'Heavier outdoor job; suits a Saturday/weekend.' },
    { key: 'cook-meal-prep', title: 'Cook & portion the week\'s meal prep', category: 'mealprep', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'me', slot: 0, locked: false, seasonal: false, minutes: 150, core: true, notes: 'The big weekly cook: batch and portion the week\'s meals.' },
    { key: 'plan-meals-food-shop', title: 'Plan meals + food shop', category: 'mealprep', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 75, core: true, notes: 'Plan the week\'s meals and do the food shop.' },
    { key: 'clean-car', title: 'Clean the car', category: 'cleaning', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'anna', rotation: ['anna','anna','anna','anna'], slot: 0, locked: false, seasonal: false, minutes: 45, core: false, notes: 'Wash and vacuum the car.' },
    { key: 'visit-alex-parents', title: 'Visit Alex\'s parents', category: 'social', cadence: 'weekly', dayIndex: 6, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 120, core: false, notes: null },
    { key: 'visit-anna-parents', title: 'Visit Anna\'s parents', category: 'social', cadence: 'weekly', dayIndex: 5, timeOfDay: 'anytime', defaultAssignee: 'both', slot: 0, locked: false, seasonal: false, minutes: 120, core: false, notes: null }
  ];

  var RULES = {
    grassAllergy: "Edging and grass cutting are locked to Anna — Alex's grass allergy.",
    foodAndDishes: "Kitchen, dishes and cooking default to Alex. Anna takes most of the cleaning.",
    sharing: "Every chore is a one-tap swap, so trade freely week to week.",
    mealPrep: "Sunday.",
    bins: "Bins are collected every Monday. Put the bin out on Sunday at 19:00. Black, blue and orange take turns.",
    points: "Every chore is worth points: one point per 5 minutes, at least 1. Core jobs keep your streak going. Bonus jobs add extra points."
  };

  // Bin collection: every Monday, one colour a week in a fixed three-week rotation.
  // BIN_REFERENCE_MONDAY (yyyymmdd) is the first colour in the list.
  var BINS = [
    { key: "black",  label: "black",  type: "general waste" },
    { key: "blue",   label: "blue",   type: "cardboard and paper" },
    { key: "orange", label: "orange", type: "plastic and cans" }
  ];
  var BIN_REFERENCE_MONDAY = "20261116";

  // Default rewards. Team rewards are what you play for together each week; personal rewards
  // are bought with your own points. Edits and new rewards sync through the doc's `rewards`.
  var REWARDS = [
    { key: "team-takeaway",  kind: "team", title: "Takeaway night" },
    { key: "team-film",      kind: "team", title: "Film night with snacks" },
    { key: "team-meal-out",  kind: "team", title: "Meal out" },
    { key: "team-day-trip",  kind: "team", title: "Day trip with Roo" },
    { key: "p-pick-film",    kind: "personal", title: "Pick the film", cost: 40 },
    { key: "p-morning-out",  kind: "personal", title: "You choose the weekend morning out with Roo", cost: 50 },
    { key: "p-takeaway",     kind: "personal", title: "Choose the takeaway", cost: 60 },
    { key: "p-coffee",       kind: "personal", title: "A coffee and pastry out, your treat to yourself", cost: 60 },
    { key: "p-weekend",      kind: "personal", title: "Choose the weekend activity", cost: 80 },
    { key: "p-date-night",   kind: "personal", title: "Choose the next date night", cost: 100 }
  ];

  // Minutes for chores that have been retired from the plan, so points for old ticks still add up.
  var RETIRED_MINUTES = {
    "walk-roo-in-the-morning": 30, "walk-roo-in-the-evening": 30,
    "gym-alex-mon": 60, "gym-alex-wed": 60, "gym-alex-fri": 60,
    // merged into "kitchen-reset"
    "empty-dishwasher": 10, "load-dishwasher": 10, "wipe-down-sink-backsplash-and-windowsill": 5,
    // merged into "laundry" / "laundry-fri-sun"
    "unload-drying-rack": 5, "load-laundry": 5, "empty-laundry": 5, "hang-laundry": 10, "put-away-laundry": 10,
    // merged into the walk-then-meal cards
    "roo-walk-am-mon-thu": 30, "roo-breakfast-mon-thu": 5, "roo-walk-pm-mon-thu": 30, "roo-dinner-mon-thu": 5,
    "roo-walk-am-fri": 30, "roo-breakfast-fri": 5
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
    BINS: BINS,
    BIN_REFERENCE_MONDAY: BIN_REFERENCE_MONDAY,
    REWARDS: REWARDS,
    RETIRED_MINUTES: RETIRED_MINUTES,
    DEFAULT_MINUTES: 10,
    POINTS_PER_LEVEL: 250,
    DOG: { name: "Roo", type: "Golden Retriever", pronouns: "she/her" },
    GYM: { note: "Alex: home gym on Monday, Wednesday and Friday at 05:30, 30 minutes. Anna: Tuesday and Thursday evenings plus one flexible session. Saturday is a joint workout." }
  };
})(window.RooHQ);