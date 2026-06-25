/*
 * firebase-config.js — Roo HQ
 *
 * Paste your own Firebase project's web config here to turn on live sync between phones.
 * See README.md ("Set up live sync") for the 10-minute walkthrough. Until you fill this in
 * (specifically `databaseURL`), the app runs fully on each device with no sync.
 *
 * This config is safe to commit/ship — Firebase web config is public by design; access is
 * controlled by your Realtime Database security rules (see firebase.rules.json).
 */
window.RooHQ = window.RooHQ || {};

window.RooHQ.firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",          // e.g. https://roo-hq-xxxx-default-rtdb.europe-west1.firebasedatabase.app
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
