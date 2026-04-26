// ================================================================
// assets/js/admin-sections.js — Custom News Sections Management
// Handles CRUD for user-defined sections like أبرز المقالات, الأكثر تداولاً
// Each section has: id, name, icon, layout, location, priority sort,
//                   active toggle, RBAC-gated, color, description.
// Stored in: settings/custom_sections → { items: [...] }
// Public site reads from this to render dynamic section blocks.
// ================================================================

import { db }                          from '/modules/firebase.js';
import { doc, setDoc, getDoc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE_CONFIG, DB }         from '/config.js';

// ── Constants ────────────────────────────────────────────────────
const SECTIONS_DOC = 'custom_sections'; // settings/{SECTIONS_DOC}

/** Layout options presented in the admin UI */
export const SECTION_LAYOUTS = [
  { value: 'scroll',   label: '↔ تمرير أفقي (مثل الأكثر تداولاً)' },
  { value: 'grid',     label: '⊞ شبكة بطاقات' },
  { value: 'list',     label: '≡ قائمة عمودية' },
  { value: 'featured', label: '★ بطاقة كبيرة مميزة' },
];

/** Location options — where on the public site the section appears */
export const SECTION_LOCATIONS = [
  { value: 'after-hero',     label: 'بعد الخبر الرئيسي' },
  { value: 'after-trending', label: 'بعد الأكثر تداولاً' },
  { value: 'after-grid',     label: 'بعد شبكة الأخبار' },
  { value: 'before-footer',  label: 'قبل التذييل' },
  { value: 'sidebar',        label: 'في الشريط الجانبي' },
];

/** Sort order for news within the section */
export const SECTION_SORTS = [
  { value: 'newest',  label: 'الأحدث أولاً' },
  { value: 'views',   label: 'الأكثر مشاهدةً' },
  { value: 'manual',  label: 'ترتيب يدوي' },
];

// In-memory cache of sections list
let _sectionsCache = [];

// ── Firebase Helpers ─────────────────────────────────────────────
async function _readSections() {
  try {
    const snap = await getDoc(doc(db, DB.SETTINGS, SECTIONS_DOC));
    return snap.exists() ? (snap.data().items || []) : [];
  } catch (e) {
    console.warn('[Sections] read:', e);
    return [];
  }
}

async function _writeSections(list) {
  try {
    await setDoc(doc(db, DB.SETTINGS, SECTIONS_DOC), { items: list });
    _sectionsCache = list;
  } catch (e) {
    console.warn('[Sections] write:', e);
    window.showToast && window.showToast('⚠️ خطأ في حفظ الأقسام');
  }
}

// Live listener — called once from initAdminSections()
export function startSectionsListener(onChange) {
  return onSnapshot(doc(db, DB.SETTINGS, SECTIONS_DOC), snap => {
    _sectionsCache = snap.exists() ? (snap.data().items || []) : [];
    if (typeof onChange === 'function') onChange(_sectionsCache);
  }, err => console.warn('[Sections] listener:', err));
}

// ── Public Accessors ─────────────────────────────────────────────
export function getSectionsCache() { return _sectionsCache; }

// ── CRUD ─────────────────────────────────────────────────────────
export async function addSection() {
  const list = await _readSections();
  const newSection = {
    id:          'section_' + Date.now(),
    name:        'قسم جديد',
    icon:        '📋',
    description: '',
    layout:      'scroll',
    location:    'after-trending',
    sort:        'newest',
    maxItems:    8,
    color:       '#C9A84C',
    active:      false,       // starts inactive — admin activates when ready
    showTitle:   true,
    requiredPerm: 'publish_articles', // which perm controls adding news to this section
    newsFlag:    '',          // computed: 'section_<id>' flag stored on news articles
    createdAt:   new Date().toISOString(),
  };
  newSection.newsFlag = 'section_' + newSection.id;
  list.push(newSection);
  await _writeSections(list);
  renderSectionsAdmin(list);
  // Sync news modal checkboxes
  syncSectionCheckboxesToNewsForm(list);
  window.showToast && window.showToast('✅ تم إضافة قسم جديد — عدّل التفاصيل أدناه');
  return newSection;
}

export async function updateSection(id, field, val) {
  const list = await _readSections();
  const idx  = list.findIndex(s => s.id === id);
  if (idx === -1) return;
  list[idx][field] = val;
  await _writeSections(list);
  // Debounced toast for text fields
  if (['active','layout','location','sort'].includes(field)) {
    renderSectionsAdmin(list);
    syncSectionCheckboxesToNewsForm(list);
    window.showToast && window.showToast('✅ تم الحفظ');
  } else {
    clearTimeout(window._sectSaveTimer);
    window._sectSaveTimer = setTimeout(() => {
      renderSectionsAdmin(list);
      syncSectionCheckboxesToNewsForm(list);
      window.showToast && window.showToast('✅ تم الحفظ');
    }, 700);
  }
}

export async function deleteSection(id) {
  if (!confirm('هل تريد حذف هذا القسم؟ سيُزال من الموقع فوراً.')) return;
  const list = (await _readSections()).filter(s => s.id !== id);
  await _writeSections(list);
  renderSectionsAdmin(list);
  syncSectionCheckboxesToNewsForm(list);
  window.showToast && window.showToast('🗑 تم حذف القسم');
}

export async function toggleSectionActive(id) {
  const list = await _readSections();
  const s    = list.find(x => x.id === id);
  if (!s) return;
  s.active = !s.active;
  await _writeSections(list);
  renderSectionsAdmin(list);
  window.showToast && window.showToast(s.active ? '✅ القسم مُفعَّل على الموقع' : '⏸ القسم موقوف');
}

// ── Render Admin UI ───────────────────────────────────────────────
export function renderSectionsAdmin(list) {
  const cont = document.getElementById('custom-sections-list');
  if (!cont) return;

  if (!list || !list.length) {
    cont.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);font-size:13px">
      لا توجد أقسام مخصصة بعد.<br>اضغط «إضافة قسم جديد» لإنشاء أول قسم.
    </div>`;
    return;
  }

  cont.innerHTML = list.map(s => {
    const layoutLabel   = SECTION_LAYOUTS.find(l => l.value === s.layout)?.label   || s.layout;
    const locationLabel = SECTION_LOCATIONS.find(l => l.value === s.location)?.label || s.location;
    const sortLabel     = SECTION_SORTS.find(l => l.value === s.sort)?.label         || s.sort;

    const layoutOpts   = SECTION_LAYOUTS.map(l =>
      `<option value="${l.value}" ${s.layout   === l.value ? 'selected' : ''}>${l.label}</option>`).join('');
    const locationOpts = SECTION_LOCATIONS.map(l =>
      `<option value="${l.value}" ${s.location === l.value ? 'selected' : ''}>${l.label}</option>`).join('');
    const sortOpts     = SECTION_SORTS.map(l =>
      `<option value="${l.value}" ${s.sort     === l.value ? 'selected' : ''}>${l.label}</option>`).join('');

    return `
    <div class="card" style="border:2px solid ${s.active ? s.color + '88' : 'var(--border-dim)'};margin-bottom:16px;transition:.2s">
      <!-- Header row: toggle + name + delete -->
      <div style="padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border-dim);flex-wrap:wrap">
        <label class="toggle-switch" style="flex-shrink:0;position:relative;display:inline-block;width:44px;height:22px">
          <input type="checkbox" ${s.active ? 'checked' : ''} onchange="toggleSectionActive('${s.id}')" style="opacity:0;width:0;height:0">
          <span style="position:absolute;cursor:pointer;inset:0;background:${s.active ? s.color : 'var(--dark-4)'};border-radius:22px;transition:.3s">
            <span style="position:absolute;height:16px;width:16px;right:${s.active ? '24px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:.3s"></span>
          </span>
        </label>
        <span style="font-size:22px">${s.icon || '📋'}</span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${s.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
            ${layoutLabel} · ${locationLabel} · ${sortLabel}
            ${s.active ? `<span style="color:${s.color};font-weight:700"> · نشط</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <span style="font-size:11px;color:var(--text-dim);padding:3px 10px;border-radius:20px;background:var(--dark-4)">🏷 ${s.newsFlag}</span>
          <button onclick="deleteSection('${s.id}')" style="background:none;border:1px solid rgba(255,82,82,.3);color:var(--red);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">🗑 حذف</button>
        </div>
      </div>

      <!-- Fields grid -->
      <div style="padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group" style="margin:0">
          <label class="form-label">اسم القسم</label>
          <input class="form-input" value="${(s.name||'').replace(/"/g,'&quot;')}"
            oninput="updateSection('${s.id}','name',this.value)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">أيقونة (emoji)</label>
          <input class="form-input" value="${s.icon||'📋'}" maxlength="4"
            oninput="updateSection('${s.id}','icon',this.value)"
            style="font-size:20px;text-align:center">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">طريقة العرض</label>
          <select class="form-select" onchange="updateSection('${s.id}','layout',this.value)">${layoutOpts}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">موقع الظهور على الموقع</label>
          <select class="form-select" onchange="updateSection('${s.id}','location',this.value)">${locationOpts}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">ترتيب الأخبار</label>
          <select class="form-select" onchange="updateSection('${s.id}','sort',this.value)">${sortOpts}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">عدد الأخبار المعروضة</label>
          <input class="form-input" type="number" min="1" max="20" value="${s.maxItems||8}"
            oninput="updateSection('${s.id}','maxItems',parseInt(this.value)||8)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">لون القسم</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="color" value="${s.color||'#C9A84C'}" onchange="updateSection('${s.id}','color',this.value)"
              style="width:44px;height:36px;border:none;cursor:pointer;background:none">
            <input class="form-input" value="${s.color||'#C9A84C'}"
              oninput="updateSection('${s.id}','color',this.value)" style="font-family:monospace;font-size:12px">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">وصف مختصر (اختياري)</label>
          <input class="form-input" value="${(s.description||'').replace(/"/g,'&quot;')}"
            placeholder="يظهر تحت اسم القسم على الموقع"
            oninput="updateSection('${s.id}','description',this.value)">
        </div>
      </div>

      <!-- Status indicator -->
      <div style="padding:8px 18px;border-top:1px solid var(--border-dim);font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:8px">
        <span>🏷 علامة الخبر:</span>
        <code style="background:var(--dark-4);padding:2px 8px;border-radius:4px;font-size:11px">${s.newsFlag}</code>
        <span style="margin-right:auto">${s.active ? `<span style="color:${s.color}">● نشط على الموقع</span>` : '<span style="color:var(--text-dim)">● غير نشط</span>'}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Sync section checkboxes into "Add News" modal ─────────────────
// Called whenever sections list changes so the form always reflects current sections.
export function syncSectionCheckboxesToNewsForm(list) {
  const container = document.getElementById('n-custom-sections-wrap');
  if (!container) return;

  const activeSections = (list || []).filter(s => s.active);

  if (!activeSections.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = `
    <label class="form-label">إظهار في أقسام إضافية</label>
    <div style="background:var(--dark-3);border:1px solid var(--border-dim);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${activeSections.map(s => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
          <input type="checkbox" id="n-section-${s.id}" style="width:14px;height:14px">
          <span style="display:flex;align-items:center;gap:4px">
            <span>${s.icon}</span>
            <span style="color:${s.color};font-weight:600">${s.name}</span>
          </span>
        </label>`).join('')}
    </div>`;
}

// Read which custom sections are checked in "Add News" modal
export function getCheckedCustomSections(allSections) {
  const result = {};
  (allSections || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    result[s.newsFlag] = !!(el && el.checked);
  });
  return result;
}

// Set custom section checkboxes when editing an existing article
export function setCustomSectionCheckboxes(article, allSections) {
  (allSections || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    if (el) el.checked = !!(article && article[s.newsFlag]);
  });
}

// Reset all custom section checkboxes
export function resetCustomSectionCheckboxes(allSections) {
  (allSections || _sectionsCache).filter(s => s.active).forEach(s => {
    const el = document.getElementById('n-section-' + s.id);
    if (el) el.checked = false;
  });
}

// ── Init ──────────────────────────────────────────────────────────
export async function initAdminSections() {
  const list = await _readSections();
  _sectionsCache = list;
  renderSectionsAdmin(list);
  syncSectionCheckboxesToNewsForm(list);
  // Start live listener
  startSectionsListener(updated => {
    renderSectionsAdmin(updated);
    syncSectionCheckboxesToNewsForm(updated);
  });
}

// Window exposures — called from inline HTML onclick
window.addSection          = addSection;
window.updateSection       = updateSection;
window.deleteSection       = deleteSection;
window.toggleSectionActive = toggleSectionActive;
