/******************************************************************************
 * # الملف: background/services/icon_service.js
 * # الغرض: خدمة إدارة أيقونات الإضافة
 ******************************************************************************/

/**
 * تعريف مسارات الأيقونات
 */
const icons = {
    default: { "48": "/icons/icon48.png" },
    active: { "48": "/icons/icon48_active.png" }
};

/**
 * تعيين الأيقونة للحالة النشطة (مع إشارة التفعيل)
 * @param {number} tabId - معرف التبويب
 */
export function setActiveIcon(tabId) {
    chrome.action.setIcon({ tabId: tabId, path: icons.active });
}

/**
 * تعيين الأيقونة للحالة الافتراضية (بدون إشارة التفعيل)
 * @param {number} tabId - معرف التبويب
 */
export function setDefaultIcon(tabId) {
    chrome.action.setIcon({ tabId: tabId, path: icons.default });
}
