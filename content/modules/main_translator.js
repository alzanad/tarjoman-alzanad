/******************************************************************************
 * # الملف: content/modules/main_translator.js
 * # الغرض: الدوال الرئيسية لبدء الترجمة واستعادة المحتوى الأصلي
 * # الاعتماديات: database.js, جميع الوحدات السابقة
 ******************************************************************************/

/**
 * وحدة الترجمة الرئيسية - تنسق عمليات الترجمة والاستعادة مع دعم التخزين المؤقت
 * @namespace TarjomanMain
 */
window.TarjomanMain = (function() {
    const state = window.TarjomanState;
    const constants = window.TarjomanConstants;
    const collector = window.TarjomanCollector;
    const applier = window.TarjomanApplier;
    const observer = window.TarjomanObserver;
    const db = window.TarjomanDB;

    /**
     * خريطة اللغات المتشابهة للتحقق من التطابق
     * بعض اللغات تُعامل كمجموعة واحدة (مثل العربية والفارسية تشترك في حروف)
     * @private
     */
    const LANGUAGE_GROUPS = {
        // اللغات العربية والمشابهة (RTL)
        ar: ['ar', 'fa', 'ur'],
        fa: ['fa', 'ar'],
        // اللغات اللاتينية
        en: ['en', 'latin'],
        latin: ['latin', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl'],
        // اللغات الآسيوية
        zh: ['zh', 'zh-CN', 'zh-TW'],
        ja: ['ja'],
        ko: ['ko']
    };

    /**
     * التحقق من تطابق اللغة المكتشفة مع اللغة المستهدفة
     * @private
     * @param {string} detectedLang - اللغة المكتشفة
     * @param {string} targetLang - اللغة المستهدفة
     * @returns {boolean}
     */
    function _isLanguageMatch(detectedLang, targetLang) {
        if (!detectedLang || !targetLang) return false;
        
        // تطابق مباشر
        if (detectedLang === targetLang) return true;
        
        // التحقق من نفس المجموعة اللغوية
        const targetGroup = LANGUAGE_GROUPS[targetLang] || [targetLang];
        return targetGroup.includes(detectedLang);
    }

    /**
     * بدء الترجمة الأولية للصفحة مع دعم التخزين المؤقت
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} mode - وضع الترجمة
     * @param {boolean} [skipPersist=false] - تخطي حفظ الحالة
     * @returns {Promise<Object>} كائن يحتوي على اللغة المكتشفة
     */
    async function startTranslation(targetLang, mode, skipPersist = false) {
        // منع التنفيذ المتزامن - إذا كانت عملية جارية، تجاهل الطلب
        if (state.isProcessing) {
            console.warn('[TarjomanMain] عملية ترجمة جارية بالفعل');
            return { detectedSourceLang: state.lastDetectedLang };
        }
        
        if (state.isTranslated) {
            return { detectedSourceLang: state.lastDetectedLang };
        }
        
        // تفعيل القفل
        state.isProcessing = true;

        // تفعيل الأيقونة فوراً عند بدء الترجمة (قبل انتظار النتائج)
        chrome.runtime.sendMessage({ action: 'set_icon_active' });
        
        // تعيين حالة الترجمة فوراً (قبل بدء العملية)
        state.isTranslated = true;

        // إعادة تعيين المتغيرات
        state.originalItems.clear();
        state.itemCounter = 0;
        state.originalTitle = document.title;
        
        // حفظ معلومات الترجمة الحالية للاستمرارية
        state.currentTargetLang = targetLang;
        state.currentMode = mode;
        
        // إزالة النطاق من قائمة الإلغاء اليدوي (المستخدم يُعيد تفعيل الترجمة)
        const currentDomain = db.extractDomain();
        if (currentDomain) {
            state.manualResetDomains.delete(currentDomain);
        }
        
        // ═══════════════════════════════════════════════════════════════
        // تفعيل المراقبة الحية فوراً - ضمان ترجمة المحتوى الديناميكي
        // ═══════════════════════════════════════════════════════════════
        observer.observeNewContent(targetLang, mode);
        observer.observeSpaNavigation(targetLang, mode);
        
        // جمع النصوص القابلة للترجمة
        const allItems = collector.collectTranslatableItems(document.body);
        
        // تصفية النصوص التي لغتها تطابق اللغة المستهدفة (لا تحتاج ترجمة)
        const translatableItems = allItems.filter(item => {
            // إذا كانت لغة النص = اللغة المستهدفة، تخطيها
            if (item.detectedLang && _isLanguageMatch(item.detectedLang, targetLang)) {
                return false;
            }
            return true;
        });

        if (translatableItems.length === 0 && !document.title) {
            state.isProcessing = false;
            return { detectedSourceLang: null };
        }
        
        // فحص لغة العنوان
        const titleLang = collector.detectTextLanguage(document.title);
        const shouldTranslateTitle = !titleLang || !_isLanguageMatch(titleLang, targetLang);

        // تحضير النصوص للترجمة (العنوان + محتوى الصفحة)
        const textsToTranslate = shouldTranslateTitle 
            ? [document.title, ...translatableItems.map(item => item.text)]
            : translatableItems.map(item => item.text);
        const idsToTranslate = shouldTranslateTitle
            ? ['title', ...translatableItems.map(item => item.id)]
            : translatableItems.map(item => item.id);

        // ─────────────────────────────────────────────────────────────
        // تحميل جميع الترجمات المخزنة دفعة واحدة (تسريع إعادة الترجمة)
        // ─────────────────────────────────────────────────────────────
        const allCacheRequests = textsToTranslate.map(text => ({
            text,
            sourceLang: 'auto',
            targetLang
        }));
        
        let globalCachedTranslations = new Map();
        try {
            globalCachedTranslations = await db.getCachedBulkTranslations(allCacheRequests);
        } catch (e) {
            console.warn('[TarjomanMain] تعذر تحميل الترجمات المخزنة:', e);
        }

        // ترجمة النصوص على دفعات مع دعم الـ Cache
        for (let i = 0; i < textsToTranslate.length; i += constants.BATCH_SIZE) {
            const textBatch = textsToTranslate.slice(i, i + constants.BATCH_SIZE);
            const idBatch = idsToTranslate.slice(i, i + constants.BATCH_SIZE);

            try {
                // تحديد النصوص التي تحتاج ترجمة جديدة
                const textsNeedingTranslation = [];
                const indicesNeedingTranslation = [];
                let translatedBatch = new Array(textBatch.length);
                
                // ملء الترجمات من الـ Cache المحمل مسبقاً
                textBatch.forEach((text, index) => {
                    const cached = globalCachedTranslations.get(text.trim());
                    if (cached) {
                        translatedBatch[index] = cached;
                    } else {
                        textsNeedingTranslation.push(text);
                        indicesNeedingTranslation.push(index);
                    }
                });
                
                // طلب ترجمة النصوص غير المخزنة فقط
                if (textsNeedingTranslation.length > 0) {
                    const response = await chrome.runtime.sendMessage({
                        action: 'requestTranslation',
                        texts: textsNeedingTranslation,
                        sourceLang: 'auto',
                        targetLang
                    });
                    
                    if (response && response.translatedTexts) {
                        // معالجة الدفعة الأولى (التي قد تحتوي على العنوان)
                        if (i === 0 && response.detectedSourceLang) {
                            state.lastDetectedLang = response.detectedSourceLang;
                        }
                        
                        // ملء النتائج في مواقعها الصحيحة
                        response.translatedTexts.forEach((translated, respIndex) => {
                            const originalIndex = indicesNeedingTranslation[respIndex];
                            translatedBatch[originalIndex] = translated;
                        });
                        
                        // حفظ الترجمات الجديدة في الـ Cache
                        const translationsToCache = textsNeedingTranslation.map((text, idx) => ({
                            originalText: text,
                            translatedText: response.translatedTexts[idx],
                            sourceLang: response.detectedSourceLang || 'auto',
                            targetLang
                        }));
                        
                        db.cacheBulkTranslations(translationsToCache).catch(err => {
                            console.warn('[TarjomanMain] تعذر حفظ الترجمات في الـ Cache:', err);
                        });
                    }
                }
                
                // تطبيق الترجمات
                const translatedMap = new Map();
                
                // معالجة العنوان في الدفعة الأولى
                if (i === 0 && shouldTranslateTitle && translatedBatch[0]) {
                    document.title = translatedBatch[0];
                }
                
                // تخطي العنوان في الدفعة الأولى
                const startIndex = (i === 0 && shouldTranslateTitle) ? 1 : 0;
                
                for (let j = startIndex; j < idBatch.length; j++) {
                    if (translatedBatch[j]) {
                        translatedMap.set(idBatch[j], translatedBatch[j]);
                    }
                }
                
                applier.applyTranslations(translatedMap, mode);
                
            } catch (e) {
                console.error("[TarjomanMain] خطأ في ترجمة المحتوى:", e);
            }
        }
        
        // إزالة القفل
        state.isProcessing = false;
        
        return { detectedSourceLang: state.lastDetectedLang };
    }

    /**
     * ترجمة نص فردي مع دعم الـ Cache
     * @param {string} text - النص للترجمة
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} [sourceLang='auto'] - لغة المصدر
     * @returns {Promise<string|null>}
     */
    async function translateSingleText(text, targetLang, sourceLang = 'auto') {
        try {
            // فحص الـ Cache أولاً
            const cached = await db.getCachedTranslation(text, sourceLang, targetLang);
            if (cached) {
                return cached;
            }
            
            // طلب ترجمة جديدة
            const response = await chrome.runtime.sendMessage({
                action: 'requestTranslation',
                texts: [text],
                sourceLang,
                targetLang
            });
            
            if (response && response.translatedTexts && response.translatedTexts[0]) {
                const translatedText = response.translatedTexts[0];
                
                // حفظ في الـ Cache
                db.cacheTranslation({
                    originalText: text,
                    translatedText,
                    sourceLang: response.detectedSourceLang || sourceLang,
                    targetLang
                }).catch(err => {
                    console.warn('[TarjomanMain] تعذر حفظ الترجمة:', err);
                });
                
                return translatedText;
            }
            
            return null;
        } catch (e) {
            console.error("[TarjomanMain] خطأ في ترجمة النص:", e);
            return null;
        }
    }

    /**
     * استعادة المحتوى الأصلي وإلغاء جميع الترجمات
     */
    function restoreOriginals() {
        // منع التنفيذ أثناء عملية جارية
        if (state.isProcessing) {
            console.warn('[TarjomanMain] لا يمكن إعادة التعيين أثناء عملية جارية');
            return;
        }
        
        // إذا لم تكن الصفحة مترجمة، لا تفعل شيئاً
        if (!state.isTranslated) {
            return;
        }
        
        // تسجيل الإلغاء اليدوي لمنع إعادة الترجمة التلقائية
        const currentDomain = db.extractDomain();
        if (currentDomain) {
            state.manualResetDomains.add(currentDomain);
        }
        
        // تفعيل القفل
        state.isProcessing = true;
        
        // إعادة تعيين الحالة فوراً
        state.isTranslated = false;
        
        // استعادة العنوان الأصلي
        if (state.originalTitle) {
            document.title = state.originalTitle;
        }
        
        // إزالة عناصر الترجمة المضافة (التوافق مع الاسم القديم والجديد)
        document.querySelectorAll('[data-immersive-translate], [data-tarjoman-translation]').forEach(el => el.remove());
        
        // إزالة أغلفة المصدر
        applier.removeAllTranslationElements();

        // استعادة النصوص الأصلية
        state.originalItems.forEach(item => {
            const { node, type, original } = item;
            if (!node) return;
            
            try {
                switch (type) {
                    case 'text':
                        node.nodeValue = original;
                        break;
                    case 'placeholder':
                        node.setAttribute('placeholder', original);
                        node.removeAttribute('title');
                        break;
                    case 'alt':
                        node.setAttribute('alt', original);
                        node.removeAttribute('title');
                        break;
                }
            } catch (e) {
                console.error("[TarjomanMain] خطأ في استعادة النص:", e);
            }
        });

        // إعادة تعيين المتغيرات
        state.originalItems.clear();
        state.currentTargetLang = null;
        state.currentMode = null;

        // إيقاف المراقبة وإعادة تهيئة حالتها
        observer.stopAllObservers();
        observer.resetObserverState();
        
        // إزالة القفل
        state.isProcessing = false;

        chrome.runtime.sendMessage({ action: 'set_icon_default' });
    }

    /**
     * مسح جميع الترجمات المخزنة
     * @returns {Promise<boolean>}
     */
    async function clearTranslationCache() {
        return db.clearAllCache();
    }

    /**
     * الحصول على إحصائيات الترجمة
     * @returns {Promise<Object>}
     */
    async function getTranslationStats() {
        return db.getStats();
    }

    // الواجهة العامة للوحدة
    return {
        startTranslation,
        translateSingleText,
        restoreOriginals,
        clearTranslationCache,
        getTranslationStats
    };
})();
