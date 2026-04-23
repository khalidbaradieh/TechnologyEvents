// ================================================================
// services/firebase.ts  —  Firebase service layer
// مركز إدارة قاعدة البيانات والاستعلامات المشتركة
// ================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { FIREBASE_CONFIG, DB } from '../config.js';

// ── Firebase App & Database ────────────────────────────────────
export const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const db = getFirestore(firebaseApp);

// ── Common Firebase Operations ────────────────────────────────

// Get document by ID
export async function getDocument(collectionName, docId) {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

// Set document (create or update)
export async function setDocument(collectionName, docId, data) {
  const docRef = doc(db, collectionName, docId);
  await setDoc(docRef, data, { merge: true });
  return docRef;
}

// Add new document
export async function addDocument(collectionName, data) {
  const docRef = await addDoc(collection(db, collectionName), data);
  return docRef;
}

// Update document
export async function updateDocument(collectionName, docId, data) {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, data);
  return docRef;
}

// Delete document
export async function deleteDocument(collectionName, docId) {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
  return docRef;
}

// Get all documents in collection
export async function getAllDocuments(collectionName) {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Query documents with conditions
export async function queryDocuments(collectionName, conditions = [], orderByField = null, orderDirection = 'asc', limitCount = null) {
  let q = collection(db, collectionName);

  // Apply where conditions
  conditions.forEach(condition => {
    q = query(q, where(condition.field, condition.operator, condition.value));
  });

  // Apply ordering
  if (orderByField) {
    q = query(q, orderBy(orderByField, orderDirection));
  }

  // Apply limit
  if (limitCount) {
    q = query(q, limit(limitCount));
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Listen to document changes
export function listenToDocument(collectionName, docId, callback) {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (doc) => {
    callback(doc.exists() ? { id: doc.id, ...doc.data() } : null);
  });
}

// Listen to collection changes
export function listenToCollection(collectionName, callback, orderByField = null, orderDirection = 'asc') {
  let q = collection(db, collectionName);
  if (orderByField) {
    q = query(q, orderBy(orderByField, orderDirection));
  }
  return onSnapshot(q, (querySnapshot) => {
    const documents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(documents);
  });
}

// ── Specialized Operations ────────────────────────────────────

// News operations
export async function getNewsArticle(articleId) {
  return await getDocument(DB.NEWS, articleId);
}

export async function saveNewsArticle(articleId, articleData) {
  return await setDocument(DB.NEWS, articleId, articleData);
}

export async function getAllNews() {
  return await queryDocuments(DB.NEWS, [], 'timestamp', 'desc');
}

// Settings operations
export async function getSetting(settingKey) {
  return await getDocument(DB.SETTINGS, settingKey);
}

export async function saveSetting(settingKey, data) {
  return await setDocument(DB.SETTINGS, settingKey, data);
}

// User operations
export async function getUser(userId) {
  return await getDocument(DB.users, userId);
}

export async function saveUser(userId, userData) {
  return await setDocument(DB.users, userId, userData);
}

export async function getAllUsers() {
  return await getAllDocuments(DB.users);
}

// RBAC operations
export async function getRbacData() {
  return await getDocument(DB.rbac, 'config');
}

export async function saveRbacData(data) {
  return await setDocument(DB.rbac, 'config', data);
}

// Activity logging
export async function logActivity(action, details, userId = null) {
  const activityData = {
    action,
    details,
    userId,
    timestamp: new Date().toISOString()
  };
  return await addDocument(DB.activity, activityData);
}