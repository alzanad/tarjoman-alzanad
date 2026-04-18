/******************************************************************************
 * # الملف: content/modules/constants.js
 * # الغرض: تعريف المتغيرات العامة والثوابت المستخدمة في نظام الترجمة
 * # الموقع: وحدة أساسية يعتمد عليها جميع الوحدات الأخرى
 ******************************************************************************/

/**
 * فضاء أسماء الترجمان - يحتوي على جميع المتغيرات والدوال العامة
 * @namespace TarjomanState
 */
window.TarjomanState = window.TarjomanState || {
    /** حالة الترجمة الحالية */
    isTranslated: false,
    
    /** قفل لمنع التنفيذ المتزامن */
    isProcessing: false,
    
    /** خريطة العناصر الأصلية قبل الترجمة */
    originalItems: new Map(),
    
    /** عنوان الصفحة الأصلي */
    originalTitle: document.title,
    
    /** عداد العناصر لتوليد معرفات فريدة */
    itemCounter: 0,
    
    /** مراقب التغييرات في DOM */
    observer: null,
    
    /** مراقب التنقل في تطبيقات SPA */
    spaWatcher: null,
    
    /** آخر عنوان URL تمت زيارته */
    lastUrl: location.href,
    
    /** اللغة المكتشفة عند الترجمة */
    lastDetectedLang: null,
    
    /** اللغة المستهدفة الحالية (للاستمرارية) */
    currentTargetLang: null,
    
    /** وضع الترجمة الحالي (للاستمرارية) */
    currentMode: null,
    
    /** 
     * مجموعة النطاقات التي ألغى المستخدم ترجمتها يدوياً في الجلسة الحالية
     * تُستخدم لمنع الترجمة التلقائية بعد الإلغاء اليدوي
     * @type {Set<string>}
     */
    manualResetDomains: new Set()
};

/**
 * ثوابت الترجمان - قيم ثابتة لا تتغير أثناء التشغيل
 * @namespace TarjomanConstants
 */
window.TarjomanConstants = {
    /** محدد العناصر المستثناة من الترجمة */
    EXCLUDED_TAG_SELECTOR: 'script, style, code, pre, kbd, samp, var, template, [role="code"]',
    
    /** حجم الدفعة للترجمة */
    BATCH_SIZE: 50,
    
    /** فترة فحص تغيير URL (بالمللي ثانية) */
    SPA_CHECK_INTERVAL: 1000,
    
    /** معرف النافذة المنبثقة */
    POPUP_ID: 'moterjem-alzanad-popover-id',
    
    /** عرض النافذة المنبثقة الافتراضي */
    POPUP_WIDTH: 350,
    
    /** ارتفاع النافذة المنبثقة الافتراضي */
    POPUP_HEIGHT: 200,
    
    /** مفتاح حفظ حالة النافذة في localStorage */
    POPUP_STATE_KEY: 'moterjem-alzanad-popup-state'
};
