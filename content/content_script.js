/******************************************************************************
 * # الملف: content/content_script.js
 * # الغرض: الملف الرئيسي لتنسيق وحدات الترجمة ومعالجة الرسائل
 * # الموقع: نقطة الدخول الرئيسية لسكربت المحتوى
 * 
 * # الهيكل المعماري:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        content_script.js (هذا الملف)                    │
 * │                    معالج الرسائل والتنسيق الرئيسي                       │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 *         ┌───────────────────────┼───────────────────────┐
 *         ▼                       ▼                       ▼
 * ┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │  constants.js │     │ main_translator │     │ popup_manager   │
 * │   الثوابت     │     │  الترجمة الرئيسية│     │  النوافذ المنبثقة│
 * └───────────────┘     └─────────────────┘     └─────────────────┘
 *         │                       │                       │
 *         ▼                       ▼                       ▼
 * ┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │text_collector │     │batch_translator │     │   utilities     │
 * │  جمع النصوص   │     │ الترجمة الدفعية  │     │   الأدوات       │
 * └───────────────┘     └─────────────────┘     └─────────────────┘
 *                               │
 *                               ▼
 *                       ┌─────────────────┐
 *                       │translation_applier
 *                       │  تطبيق الترجمة  │
 *                       └─────────────────┘
 *                               │
 *                               ▼
 *                       ┌─────────────────┐
 *                       │    observer     │
 *                       │    المراقبة     │
 *                       └─────────────────┘
 ******************************************************************************/

// =============================================================================
// # تهيئة الوحدات والدوال العامة
// =============================================================================

/**
 * تهيئة النظام عند اكتمال تحميل الوحدات
 */
(function initializeTarjoman() {
    // التحقق من اكتمال تحميل الوحدات
    const requiredModules = [
        'TarjomanDB',           // قاعدة البيانات الموحدة (يجب أن تُحمّل أولاً)
        'TarjomanState',
        'TarjomanConstants',
        'TarjomanCollector',
        'TarjomanApplier',
        'TarjomanBatch',
        'TarjomanObserver',
        'TarjomanMain',
        'TarjomanPopup',
        'TarjomanUtils',
        'TarjomanKeyboard',
        'TarjomanTheme'
    ];
    
    const missingModules = requiredModules.filter(mod => !window[mod]);
    
    if (missingModules.length > 0) {
        console.error('[Tarjoman] وحدات مفقودة:', missingModules.join(', '));
        return;
    }

    // تهيئة الوحدات الفرعية
    window.TarjomanKeyboard.initialize();
    window.TarjomanTheme.initialize();

    // جعل الدوال متاحة عالمياً للتوافق مع الكود القديم
    window.togglePin = window.TarjomanPopup.togglePin;
    window.replaceSelectedTextFromPopup = window.TarjomanPopup.replaceSelectedTextFromPopup;
    window.closePopup = window.TarjomanPopup.closePopup;
    
    // التحقق من إعدادات الترجمة التلقائية فقط (بدون استمرارية النطاق)
    checkAndApplyAutoTranslation();
    
    // تنظيف الترجمات المنتهية الصلاحية بشكل دوري (بنسبة 5%)
    if (Math.random() < 0.05) {
        window.TarjomanDB.cleanupExpiredRecords().catch(() => {});
    }
})();

// =============================================================================
// # الترجمة التلقائية (للمواقع المحددة أو الترجمة الشاملة)
// =============================================================================

/**
 * التحقق من إعدادات الترجمة التلقائية وتطبيقها
 * تدعم: 1) الترجمة الشاملة لجميع المواقع 2) مواقع محددة للترجمة التلقائية
 */
function checkAndApplyAutoTranslation() {
    // انتظار اكتمال تحميل DOM إن لم يكن جاهزاً
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performAutoTranslationCheck);
    } else {
        performAutoTranslationCheck();
    }
}

/**
 * تنفيذ فحص الترجمة التلقائية وتطبيقها
 */
function performAutoTranslationCheck() {
    const currentHostname = window.location.hostname.replace(/^www\./, '');
    const state = window.TarjomanState;
    
    // منع الترجمة التلقائية إذا ألغاها المستخدم يدوياً في هذه الجلسة
    if (state.manualResetDomains.has(currentHostname)) {
        return;
    }
    
    chrome.storage.local.get({
        autoTranslateSites: [],
        favoriteTargetLang: 'ar',
        translationMode: 'replace',
        globalTranslateEnabled: false,
        translateExcludedSites: []
    }, (settings) => {
        // فحص استثناء الموقع من الترجمة الشاملة
        const isExcluded = settings.translateExcludedSites.some(site => 
            currentHostname === site || currentHostname.endsWith('.' + site)
        );
        
        // التحقق من أن الموقع الحالي في قائمة الترجمة التلقائية
        const isInAutoList = settings.autoTranslateSites.some(site => 
            currentHostname === site || currentHostname.endsWith('.' + site)
        );
        
        // ترجمة إذا: (الترجمة الشاملة مفعلة وغير مستثنى) أو (في قائمة الترجمة التلقائية)
        const shouldTranslate = (settings.globalTranslateEnabled && !isExcluded) || isInAutoList;
        
        if (shouldTranslate && !state.isTranslated) {
            // تطبيق الترجمة
            window.TarjomanMain.startTranslation(
                settings.favoriteTargetLang,
                settings.translationMode
            ).then(() => {
                // تحديث الأيقونة بعد الترجمة التلقائية
                chrome.runtime.sendMessage({ action: 'set_icon_active' });
            }).catch(() => {});
        } else if (shouldTranslate && state.isTranslated) {
            // ═══════════════════════════════════════════════════════════════════════════
            // ضمان استمرارية المراقبة - حتى لو كانت الصفحة مترجمة مسبقاً
            // ═══════════════════════════════════════════════════════════════════════════
            if (!state.observer) {
                window.TarjomanObserver.observeNewContent(
                    settings.favoriteTargetLang,
                    settings.translationMode
                );
                window.TarjomanObserver.observeSpaNavigation(
                    settings.favoriteTargetLang,
                    settings.translationMode
                );
            }
        }
    });
}

// =============================================================================
// # معالج الرسائل الرئيسي
// =============================================================================

/**
 * معالج الرسائل الواردة من background scripts أو popup
 * يستقبل الأوامر المختلفة ويقوم بتنفيذها عبر الوحدات المناسبة
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const main = window.TarjomanMain;
    const popup = window.TarjomanPopup;
    const state = window.TarjomanState;

    switch (request.action) {
        case 'translatePage':
            // بدء ترجمة الصفحة
            main.startTranslation(request.targetLang, request.mode)
                .then(result => sendResponse(result));
            return true; // استجابة غير متزامنة
            
        case 'resetPage':
            // إعادة تعيين الصفحة لحالتها الأصلية
            main.restoreOriginals();
            sendResponse({ status: "reset" });
            break;
            
        case 'showTranslationPopup':
            // عرض نافذة الترجمة المنبثقة
            popup.showTranslationPopup(request.text, request.targetLang);
            sendResponse({ status: 'popup-shown' });
            break;
            
        case 'getTranslationStatus':
            // إرجاع حالة الترجمة الفعلية مع حالة المعالجة
            sendResponse({ 
                isTranslated: state.isTranslated,
                isProcessing: state.isProcessing 
            });
            break;
            
        case 'clearDomainState':
            // مسح حالة الترجمة (يُستدعى عند إزالة موقع من الترجمة التلقائية)
            // ملاحظة: تم إزالة استمرارية النطاق، فقط إعادة تعيين الصفحة إذا كانت مترجمة
            if (state.isTranslated) {
                main.restoreOriginals();
            }
            sendResponse({ status: 'cleared' });
            break;
            
        case 'clearManualResetState':
            // مسح حالة الإلغاء اليدوي (يُستدعى عند تحميل صفحة جديدة)
            state.manualResetDomains.clear();
            sendResponse({ status: 'cleared' });
            break;
            
        default:
            console.warn('طلب غير معروف:', request.action);
    }
});

// =============================================================================
// # معالجات الإغلاق والتنظيف
// =============================================================================

/**
 * تنظيف الموارد عند إغلاق الصفحة
 */
window.addEventListener('beforeunload', () => {
    window.TarjomanPopup.cleanup();
    window.TarjomanKeyboard.destroy();
});

// =============================================================================
// # واجهة التصحيح للمطورين
// =============================================================================

if (typeof DEBUG !== 'undefined' && DEBUG) {
    window.moterjemAlzanadDebug = {
        resetExtension: () => {
            window.TarjomanPopup.cleanup();
            window.TarjomanMain.restoreOriginals();
        },
        cleanup: window.TarjomanPopup.cleanup,
        getPopup: () => document.getElementById(window.TarjomanConstants.POPUP_ID),
        getState: () => window.TarjomanState,
        modules: {
            state: window.TarjomanState,
            constants: window.TarjomanConstants,
            collector: window.TarjomanCollector,
            applier: window.TarjomanApplier,
            batch: window.TarjomanBatch,
            observer: window.TarjomanObserver,
            main: window.TarjomanMain,
            popup: window.TarjomanPopup,
            utils: window.TarjomanUtils
        }
    };
}
