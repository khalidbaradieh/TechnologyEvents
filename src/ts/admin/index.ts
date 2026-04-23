// Admin Panel TypeScript Code
// Extracted from admin.html inline script

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { FIREBASE_CONFIG, DB, STORE } from '../config.js';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// Global variables
let curUser: any = null;
let users: any[] = [];
let rbacRoles: any = {};
let matrixEditing = false;

// DOM elements
let loginForm: HTMLElement | null = null;
let dashboard: HTMLElement | null = null;
let newsTable: HTMLElement | null = null;
let userTable: HTMLElement | null = null;
let rbacMatrix: HTMLElement | null = null;
let activityLog: HTMLElement | null = null;

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Initialize DOM elements
  loginForm = document.getElementById('loginForm');
  dashboard = document.getElementById('dashboard');
  newsTable = document.getElementById('newsTable');
  userTable = document.getElementById('userTable');
  rbacMatrix = document.getElementById('rbacMatrix');
  activityLog = document.getElementById('activityLog');

  // Check if user is logged in
  const savedUser = localStorage.getItem('atq_user');
  if (savedUser) {
    curUser = JSON.parse(savedUser);
    showDashboard();
  } else {
    showLogin();
  }

  // Load data
  loadUsers();
  loadRbacRoles();
  loadNews();
}

function showLogin() {
  if (loginForm) loginForm.style.display = 'block';
  if (dashboard) dashboard.style.display = 'none';
}

function showDashboard() {
  if (loginForm) loginForm.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';
  updateUI();
}

function updateUI() {
  // Update UI based on user permissions
  const permissions = getUserPermissions(curUser);
  
  // Hide/show elements based on permissions
  const newsSection = document.getElementById('newsSection');
  if (newsSection) {
    newsSection.style.display = permissions.canManageNews ? 'block' : 'none';
  }
  
  const userSection = document.getElementById('userSection');
  if (userSection) {
    userSection.style.display = permissions.canManageUsers ? 'block' : 'none';
  }
  
  const rbacSection = document.getElementById('rbacSection');
  if (rbacSection) {
    rbacSection.style.display = permissions.canManageRoles ? 'block' : 'none';
  }
}

function getUserPermissions(user: any) {
  // Get user permissions based on role
  const role = rbacRoles[user.role] || {};
  return {
    canManageNews: role.permissions?.includes('manage_news') || false,
    canManageUsers: role.permissions?.includes('manage_users') || false,
    canManageRoles: role.permissions?.includes('manage_roles') || false,
    canViewAnalytics: role.permissions?.includes('view_analytics') || false
  };
}

// Login function
async function doLogin() {
  const username = (document.getElementById('username') as HTMLInputElement)?.value;
  const password = (document.getElementById('password') as HTMLInputElement)?.value;
  
  if (!username || !password) {
    alert('يرجى إدخال اسم المستخدم وكلمة المرور');
    return;
  }
  
  // Check credentials
  const user = users.find(u => u.username === username);
  if (!user) {
    alert('المستخدم غير موجود');
    return;
  }
  
  // Simple password check (in production, use proper hashing)
  if (user.password !== password) {
    alert('كلمة المرور غير صحيحة');
    return;
  }
  
  curUser = user;
  localStorage.setItem('atq_user', JSON.stringify(user));
  showDashboard();
  
  // Log activity
  await logActivity('login', `User ${user.username} logged in`);
}

// Logout function
function doLogout() {
  curUser = null;
  localStorage.removeItem('atq_user');
  showLogin();
}

// Load users from Firebase
async function loadUsers() {
  try {
    const usersRef = collection(db, DB.users);
    const snapshot = await getDocs(usersRef);
    users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Load RBAC roles from Firebase
async function loadRbacRoles() {
  try {
    const rolesRef = collection(db, DB.rbac);
    const snapshot = await getDocs(rolesRef);
    rbacRoles = {};
    snapshot.docs.forEach(doc => {
      rbacRoles[doc.id] = doc.data();
    });
  } catch (error) {
    console.error('Error loading RBAC roles:', error);
  }
}

// Load news from Firebase
async function loadNews() {
  try {
    const newsRef = collection(db, DB.news);
    const q = query(newsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const news = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderNewsTable(news);
  } catch (error) {
    console.error('Error loading news:', error);
  }
}

// Render news table
function renderNewsTable(news: any[]) {
  if (!newsTable) return;
  
  const tbody = newsTable.querySelector('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  news.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.title}</td>
      <td>${item.category}</td>
      <td>${item.status}</td>
      <td>${new Date(item.createdAt?.toDate()).toLocaleDateString('ar')}</td>
      <td>
        <button onclick=\"editNews('${item.id}')\">تعديل</button>
        <button onclick=\"deleteNews('${item.id}')\">حذف</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Save news to Firebase
async function saveNews(newsData: any) {
  try {
    const newsRef = collection(db, DB.news);
    if (newsData.id) {
      // Update existing
      await updateDoc(doc(newsRef, newsData.id), {
        ...newsData,
        updatedAt: new Date()
      });
    } else {
      // Create new
      await setDoc(doc(newsRef), {
        ...newsData,
        createdAt: new Date(),
        author: curUser.username
      });
    }
    
    // Reload news
    loadNews();
    
    // Log activity
    await logActivity('news', `News ${newsData.id ? 'updated' : 'created'}: ${newsData.title}`);
  } catch (error) {
    console.error('Error saving news:', error);
  }
}

// Delete news from Firebase
async function deleteNews(id: string) {
  if (!confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
  
  try {
    await deleteDoc(doc(db, DB.news, id));
    loadNews();
    await logActivity('news', `News deleted: ${id}`);
  } catch (error) {
    console.error('Error deleting news:', error);
  }
}

// Log activity to Firebase
async function logActivity(type: string, description: string) {
  try {
    const logRef = collection(db, DB.activity);
    await setDoc(doc(logRef), {
      type,
      description,
      user: curUser?.username || 'system',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Apply role permissions
function applyRolePermissions() {
  if (!curUser) return;
  
  const permissions = getUserPermissions(curUser);
  
  // Hide/show UI elements based on permissions
  const elements = document.querySelectorAll('[data-permission]');
  elements.forEach((el: HTMLElement) => {
    const requiredPerm = el.dataset.permission;
    if (requiredPerm && !permissions[requiredPerm]) {
      el.style.display = 'none';
    }
  });
}

// Firebase operations
async function _fbSetNews(data: any) {
  try {
    const newsRef = collection(db, DB.news);
    await setDoc(doc(newsRef), data);
  } catch (error) {
    console.error('Error setting news:', error);
  }
}

// Export functions for global access
(window as any).doLogin = doLogin;
(window as any).doLogout = doLogout;
(window as any).saveNews = saveNews;
(window as any).deleteNews = deleteNews;
(window as any).editNews = (id: string) => {
  // Implementation for editing news
  console.log('Edit news:', id);
};
(window as any).applyRolePermissions = applyRolePermissions;
(window as any)._fbSetNews = _fbSetNews;