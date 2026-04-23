// ================================================================
// assets/js/site-cats.js — Category metadata lookup
// Provides background gradients, icons, and tag CSS classes
// for every article category used on the public site.
// ================================================================

/** @type {Record<string, {bg:string, icon:string, cls:string}>} */
export const CAT_META = {
  'الذكاء الاصطناعي':    { bg: 'linear-gradient(135deg,#0d1b2a,#1b3a5e)', icon: '🤖', cls: 'tag-blue'   },
  'الهواتف والأجهزة':    { bg: 'linear-gradient(135deg,#0a1a2a,#0d3a5c)', icon: '📱', cls: 'tag-blue'   },
  'الفضاء والعلوم':      { bg: 'linear-gradient(135deg,#1a0533,#2d1060)', icon: '🚀', cls: 'tag-purple' },
  'الأمن الرقمي':        { bg: 'linear-gradient(135deg,#2a0a0a,#5c1515)', icon: '🛡️', cls: 'tag-red'    },
  'الشركات والأعمال':    { bg: 'linear-gradient(135deg,#1a1a0a,#3d3a10)', icon: '💼', cls: 'tag-gold'   },
  'ألعاب الفيديو':       { bg: 'linear-gradient(135deg,#1a1a0a,#3d3d10)', icon: '🎮', cls: 'tag-gold'   },
  'السيارات الكهربائية': { bg: 'linear-gradient(135deg,#0a2a1a,#0d5c30)', icon: '🔋', cls: 'tag-green'  },
  'الروبوتات':           { bg: 'linear-gradient(135deg,#0a2a1a,#0d5c30)', icon: '🦾', cls: 'tag-green'  },
  'التقنية الحيوية':     { bg: 'linear-gradient(135deg,#1a0a2a,#3d1060)', icon: '🧬', cls: 'tag-purple' },
};

/** Default fallback for unknown categories */
const CAT_DEFAULT = { bg: 'linear-gradient(135deg,#1a1a2e,#16213e)', icon: '📰', cls: 'tag-gold' };

/**
 * Look up category metadata, returning a safe fallback for unknown categories.
 * @param {string} cat
 * @returns {{ bg:string, icon:string, cls:string }}
 */
export function catMeta(cat) {
  return CAT_META[cat] || CAT_DEFAULT;
}

/**
 * Map from category name → color hex (used for dynamic sidebar chips, etc.)
 * Extended from admin-side color definitions.
 */
export const catColors = {
  'الذكاء الاصطناعي':    '#4A9EFF',
  'الهواتف والأجهزة':    '#3DDC84',
  'الفضاء والعلوم':      '#A078FF',
  'الأمن الرقمي':        '#FF5252',
  'الشركات والأعمال':    '#C9A84C',
  'ألعاب الفيديو':       '#FF9A3C',
  'السيارات الكهربائية': '#40C8F0',
  'الروبوتات':           '#3DDC84',
  'التقنية الحيوية':     '#A078FF',
};
