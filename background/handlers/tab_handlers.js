/******************************************************************************
 * # الملف: background/handlers/tab_handlers.js
 * # الغرض: معالجة أحداث التبويبات والتنقل
 ******************************************************************************/

import { setDefaultIcon, setActiveIcon } from '../services/icon_service.js';

/**
 * معالج تحديث التبويبات
 * يتعامل مع تحميل الصفحات والترجمة التلقائية
 * يعيد تعيين حالة الإلغاء اليدوي عند التنقل الكامل
 */
export function handleTabUpdate(tabId, changeInfo, tab) {
    // عند تغيّر الرابط داخل نفس الصفحة (SPA)، حافظ على الأيقونة مفعلة إن كانت الترجمة نشطة
    if (changeInfo.url) {
        syncIconWithActualPageState(tabId);
    }

    // تطبيق الترجمة التلقائية عند اكتمال التحميل
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        // إعادة تعيين حالة الإلغاء اليدوي بعد اكتمال تحميل صفحة جديدة
        chrome.tabs.sendMessage(tabId, { action: 'clearManualResetState' }, () => {
            // تجاهل الأخطاء - content script قد لا يكون جاهزاً بعد
            if (chrome.runtime.lastError) {}
        });

        handleAutoTranslation(tabId, tab.url);
    }
}

/**
 * معالج الترجمة التلقائية - يدعم الترجمة الشاملة والمواقع المحددة
 * مع احترام حالة الإلغاء اليدوي في الجلسة الحالية
 * @param {number} tabId - معرف التبويب
 * @param {string} url - عنوان الصفحة
 */
function handleAutoTranslation(tabId, url) {
    chrome.storage.local.get({ 
        autoTranslateSites: [], 
        favoriteTargetLang: 'ar', 
        translationMode: 'replace',
        globalTranslateEnabled: false,
        translateExcludedSites: []
    }, (settings) => {
        const hostname = getHostname(url);
        if (!hostname) return;
        
        // فحص الاستثناء من الترجمة الشاملة
        const isExcluded = isHostnameInList(hostname, settings.translateExcludedSites);
        
        // فحص قائمة الترجمة التلقائية
        const isInAutoList = isHostnameInList(hostname, settings.autoTranslateSites);
        
        // الترجمة إذا: (الشاملة مفعلة وغير مستثنى) أو (في قائمة التلقائية)
        const shouldTranslate = (settings.globalTranslateEnabled && !isExcluded) || isInAutoList;
        
        if (shouldTranslate) {
            initiateAutoTranslation(tabId, settings);
        } else {
            setDefaultIcon(tabId);
            chrome.storage.local.set({ [`translated_status_${tabId}`]: false });
        }
    });
}

/**
 * مزامنة الأيقونة مع الحالة الفعلية داخل الصفحة (مهم لتنقلات SPA)
 */
function syncIconWithActualPageState(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'getTranslationStatus' }, (response) => {
        if (chrome.runtime.lastError || !response) return;

        if (response.isTranslated) {
            setActiveIcon(tabId);
            chrome.storage.local.set({ [`translated_status_${tabId}`]: true });
        }
    });
}

/**
 * استخراج اسم النطاق من الرابط
 */
function getHostname(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
        return null;
    }
}

/**
 * التحقق من وجود النطاق في قائمة معينة
 */
function isHostnameInList(hostname, list) {
    return list.some(site => 
        hostname === site || hostname.endsWith('.' + site)
    );
}

/**
 * بدء الترجمة التلقائية مع إعادة المحاولة عند الفشل
 * @param {number} tabId - معرف التبويب
 * @param {Object} settings - إعدادات الترجمة
 * @param {number} retryCount - عدد المحاولات المتبقية
 */
function initiateAutoTranslation(tabId, settings, retryCount = 3) {
    chrome.tabs.sendMessage(tabId, {
        action: 'translatePage',
        targetLang: settings.favoriteTargetLang,
        mode: settings.translationMode
    }, (response) => {
        if (chrome.runtime.lastError && retryCount > 0) {
            // إعادة المحاولة بعد تأخير قصير - content script غير جاهز بعد
            setTimeout(() => {
                initiateAutoTranslation(tabId, settings, retryCount - 1);
            }, 500);
        } else if (!chrome.runtime.lastError) {
            // نجحت الترجمة - تحديث الأيقونة والحالة
            setActiveIcon(tabId);
            chrome.storage.local.set({ [`translated_status_${tabId}`]: true });
        }
    });
}

/**
 * معالج إزالة التبويبات
 * الحفاظ على البيانات للمستخدم - لا حذف تلقائي
 */
export function handleTabRemove(tabId) {
    // السماح لـ Chrome بإدارة البيانات تلقائياً عند إغلاق المتصفح
    // البيانات قد تكون مفيدة للمستخدم عند استعادة الجلسة
}
