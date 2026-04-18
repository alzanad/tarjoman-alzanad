/******************************************************************************
 * # الملف: background/services/initialization_service.js
 * # الغرض: خدمة التهيئة الأولية للإضافة
 ******************************************************************************/

import { setupContextMenu } from './context_menu_service.js';

/**
 * تهيئة الإضافة عند التثبيت أو التحديث
 */
export function initializeExtension() {
    // تعيين الإعدادات الافتراضية
    chrome.storage.local.set({
        translationService: 'google',
        favoriteTargetLang: 'ar',
        sourceLang: 'auto',
        translationMode: 'replace',
        autoTranslateSites: [],
        globalRtlEnabled: false,
        rtlExcludedSites: []
    });

    // إعداد قائمة النقر الأيمن
    setupContextMenu();
}
