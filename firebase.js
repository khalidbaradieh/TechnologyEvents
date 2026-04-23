// ================================================================
// modules/firebase.js — Shared Firebase initialization
// Single source of truth for Firebase app + Firestore instance.
// Imported by all page-level JS entry points.
// ================================================================

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE_CONFIG } from '/config.js';

// Single Firebase app instance per page context.
// Each HTML page is its own module context so no duplicate-app collision.
const _app = initializeApp(FIREBASE_CONFIG);

/**
 * Shared Firestore db instance.
 * Import and use this instead of calling initializeApp again.
 * @type {import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js').Firestore}
 */
export const db = getFirestore(_app);
