/*
 * firebase-config.js — Roo HQ
 *
 * Live sync is ON: this is the Roo HQ Firebase project's web config.
 * Safe to commit/ship — Firebase web config is public by design; access is controlled by the
 * Realtime Database security rules (see firebase.rules.json: a household code of 8+ characters).
 */
window.RooHQ = window.RooHQ || {};

window.RooHQ.firebaseConfig = {
  apiKey: "AIzaSyABw67_cCDvEz50VrR_KHIorgmiwLMEKoM",
  authDomain: "roo-hq.firebaseapp.com",
  databaseURL: "https://roo-hq-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roo-hq",
  storageBucket: "roo-hq.firebasestorage.app",
  messagingSenderId: "819584829697",
  appId: "1:819584829697:web:01c2e07ea5a9bbcf8ff300"
};
