// ==================== common.js – Ramz‑X (النسخة النهائية) ====================
// هذا الملف يُضمَّن في جميع صفحات HTML بعد تحميل مكتبة Supabase.
// يعرّف supabase كمتغير عام، ويحتوي على جميع الدوال المشتركة.

// 1. تعريف عميل Supabase (باستخدام window.supabase لتجنب التعارض)
var supabaseClient = window.supabase.createClient(
    "https://zlkpoghjbqtnhzhmmdbw.supabase.co",
    "sb_publishable_7evDsA5aEgPMsRBTFjntrg_XZQFmNLw"
);

// اختصار للاستخدام السهل
var supabase = supabaseClient;

// ==================== 2. دوال العرض والتنسيق ====================

/**
 * عرض إشعار منبثق (Toast)
 * @param {string} msg - الرسالة
 * @param {boolean} isError - إن كان خطأ يغير لون الحدود
 */
function showToast(msg, isError = false) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: var(--toast-bg, #000000dd); color: var(--toast-text, white);
            padding: 10px 24px; border-radius: 30px; z-index: 9999;
            font-family: 'Cairo', sans-serif; font-size: 14px; transition: opacity 0.3s;
            border: 1px solid var(--border, #2c2c2c); white-space: nowrap;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.borderColor = isError ? '#ff6b6b' : 'var(--border, #2c2c2c)';
    setTimeout(function () {
        toast.style.opacity = '0';
    }, 3000);
}

/**
 * تنسيق الأرقام إلى شكل مختصر (1K, 1M)
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

/**
 * حماية من هجمات XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/**
 * حساب الوقت المنقضي بالعربية
 * @param {string|Date} date
 * @returns {string}
 */
function timeAgo(date) {
    var diff = Math.floor((new Date() - new Date(date)) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return 'منذ ' + Math.floor(diff / 60) + ' د';
    if (diff < 86400) return 'منذ ' + Math.floor(diff / 3600) + ' س';
    return 'منذ ' + Math.floor(diff / 86400) + ' يوم';
}

/**
 * تحويل حقل الصورة (نص أو JSON) إلى مصفوفة روابط
 * @param {string|array} imageField
 * @returns {array}
 */
function parseImages(imageField) {
    if (!imageField) return [];
    if (Array.isArray(imageField)) return imageField;
    try {
        var parsed = JSON.parse(imageField);
        if (Array.isArray(parsed)) return parsed;
        return [imageField];
    } catch (e) {
        return imageField.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
}

// ==================== 3. إدارة المستخدم ====================

/**
 * إضافة المستخدم (الزائر) إلى محادثة ترحيبية مع رمزي
 * @param {string} guestUserId - معرف الزائر الجديد
 */
async function addGuestToWelcomeChat(guestUserId) {
    try {
        var welcomeConvId = 'd1000000-0000-0000-0000-000000000001';
        // نتأكد من وجود المحادثة
        var { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', welcomeConvId)
            .single();
        if (!conv) {
            // إذا لم تكن موجودة، ننشئها
            await supabase.from('conversations').insert({ id: welcomeConvId });
            // نضيف رمزي كمشارك
            await supabase.from('conversation_participants').insert([
                { conversation_id: welcomeConvId, user_id: 'a1000000-0000-0000-0000-000000000005' }
            ]);
        }
        // إضافة الزائر كمشارك
        await supabase.from('conversation_participants')
            .upsert({ conversation_id: welcomeConvId, user_id: guestUserId });
        // إرسال رسالة ترحيبية من رمزي (إذا لم تكن موجودة)
        var { data: msgs } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', welcomeConvId)
            .eq('sender_id', 'a1000000-0000-0000-0000-000000000005')
            .limit(1);
        if (!msgs || msgs.length === 0) {
            await supabase.from('messages').insert({
                conversation_id: welcomeConvId,
                sender_id: 'a1000000-0000-0000-0000-000000000005',
                text: '👋 مرحباً بك في Ramz‑X! هذه محادثة ترحيبية. يمكنك التواصل مع الأصدقاء هنا.'
            });
        }
    } catch (err) {
        console.warn('تعذرت إضافة الزائر إلى المحادثة الترحيبية:', err);
    }
}

/**
 * التحقق من وجود جلسة، أو إنشاء مستخدم زائر تلقائيًا
 * @returns {Promise<object>} كائن المستخدم
 */
async function checkSession() {
    var user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch (e) {}
    if (user && user.id) {
        // تحقق من وجوده في قاعدة البيانات
        var { data: dbUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single();
        if (dbUser) return user;
    }

    // إنشاء مستخدم زائر
    var guestId = crypto.randomUUID();
    var guestUser = {
        id: guestId,
        username: 'زائر_' + Math.floor(Math.random() * 10000),
        full_name: 'زائر',
        avatar: 'https://randomuser.me/api/portraits/lego/' + (Math.floor(Math.random() * 8) + 1) + '.jpg',
        is_guest: true,
        verified: false
    };

    await supabase.from('users').upsert(guestUser);
    localStorage.setItem('currentUser', JSON.stringify(guestUser));

    // إضافة الزائر إلى محادثة ترحيبية
    await addGuestToWelcomeChat(guestUser.id);

    return guestUser;
}

/**
 * إرجاع المستخدم الحالي من التخزين المحلي
 * @returns {object|null}
 */
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser'));
    } catch (e) {
        return null;
    }
}

// ==================== 4. دوال RPC (الإجراءات المخزنة) ====================

async function incrementLikes(rowId) {
    await supabase.rpc('increment_likes', { row_id: rowId });
}
async function decrementLikes(rowId) {
    await supabase.rpc('decrement_likes', { row_id: rowId });
}
async function incrementFavorites(rowId) {
    await supabase.rpc('increment_favorites', { row_id: rowId });
}
async function decrementFavorites(rowId) {
    await supabase.rpc('decrement_favorites', { row_id: rowId });
}
async function incrementReposts(rowId) {
    await supabase.rpc('increment_reposts', { row_id: rowId });
}
async function decrementReposts(rowId) {
    await supabase.rpc('decrement_reposts', { row_id: rowId });
}
async function incrementViews(rowId) {
    await supabase.rpc('increment_views', { row_id: rowId });
}
async function incrementCommentsCount(rowId) {
    await supabase.rpc('increment_comments_count', { row_id: rowId });
}
async function decrementCommentsCount(rowId) {
    await supabase.rpc('decrement_comments_count', { row_id: rowId });
}

// ==================== 5. إدارة الثيم (ليلي / نهاري) ====================

/**
 * تطبيق الثيم المحفوظ (الافتراضي: فاتح)
 */
function initTheme() {
    var saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
        document.body.classList.remove('light');
    } else {
        document.body.classList.add('light');
    }
}

/**
 * تبديل الثيم وإرجاع الحالة الجديدة
 * @returns {boolean} true = dark, false = light
 */
function toggleTheme() {
    var isLight = document.body.classList.contains('light');
    if (isLight) {
        document.body.classList.remove('light');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.add('light');
        localStorage.setItem('darkMode', 'false');
    }
    return !isLight;
}

// ==================== 6. التهيئة التلقائية ====================
document.addEventListener('DOMContentLoaded', function () {
    // تطبيق الثيم
    initTheme();

    // زر تبديل الثيم (إن وُجد)
    var themeBtn = document.getElementById('darkModeToggle');
    if (themeBtn) {
        // ضبط الأيقونة الابتدائية
        var icon = themeBtn.querySelector('i');
        if (icon) {
            var isDarkNow = !document.body.classList.contains('light');
            icon.className = isDarkNow ? 'fas fa-moon' : 'fas fa-sun';
        }
        // مستمع النقر
        themeBtn.addEventListener('click', function () {
            var isDark = toggleTheme();
            var ic = themeBtn.querySelector('i');
            if (ic) {
                ic.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
            }
        });
    }

    // تسجيل Service Worker لدعم PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(function (reg) {
                console.log('✅ Service Worker مسجل:', reg.scope);
            })
            .catch(function (err) {
                console.warn('⚠️ فشل تسجيل Service Worker:', err);
            });
    }
});
