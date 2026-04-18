/******************************************************************************
 * # الملف: background/services/translation_service.js
 * # الغرض: خدمة الترجمة متعددة المزودين مع إدارة الذاكرة المؤقتة
 ******************************************************************************/

// قائمة مزودي الترجمة المتاحين
const TRANSLATION_PROVIDERS = {
    google: 'Google Translate',
    yandex: 'Yandex Translate'
};

// تصدير قائمة المزودين للاستخدام في واجهة الإعدادات
export { TRANSLATION_PROVIDERS };

/**
 * الحصول على قيمة من الذاكرة المؤقتة
 */
async function getFromCache(key) { 
    const result = await chrome.storage.local.get(key); 
    return result[key]; 
}

/**
 * حفظ قيمة في الذاكرة المؤقتة
 */
async function setToCache(key, value) { 
    await chrome.storage.local.set({ [key]: value }); 
}

/**
 * ترجمة نص واحد باستخدام Google Translate
 * @private
 */
async function _translateSingleWithGoogle(text, sourceLang, targetLang) {
    // فحص الـ Cache أولاً
    const cacheKey = `google_cache_${sourceLang}_${targetLang}_${text}`;
    const cached = await getFromCache(cacheKey);
    
    if (cached) {
        return { translated: cached, detectedLang: null, fromCache: true };
    }
    
    // ترجمة النص
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`خطأ في Google Translate! الحالة: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data[0]) {
        const translated = data[0]
            .map(segment => segment[0] || '')
            .join('');
        
        // حفظ في الـ Cache (بشكل غير متزامن، لا ننتظره)
        setToCache(cacheKey, translated).catch(() => {});
        
        return { translated, detectedLang: data[2] || null, fromCache: false };
    }
    
    return { translated: text, detectedLang: null, fromCache: false };
}

/**
 * ترجمة باستخدام خدمة Google Translate
 * تُرسل جميع النصوص بشكل متوازٍ لتحسين الأداء
 */
async function translateWithGoogle(texts, sourceLang, targetLang) {
    let detectedLang = null;
    
    // إرسال جميع الطلبات بشكل متوازٍ
    const promises = texts.map(text => 
        _translateSingleWithGoogle(text, sourceLang, targetLang)
            .catch(error => {
                console.error('[Google Translate] خطأ:', error.message);
                return { translated: text, detectedLang: null, fromCache: false };
            })
    );
    
    const results = await Promise.all(promises);
    
    // استخراج النتائج
    const translatedTexts = results.map(r => r.translated);
    
    // أخذ اللغة المكتشفة من أول نتيجة غير مخزنة
    for (const result of results) {
        if (result.detectedLang && !result.fromCache) {
            detectedLang = result.detectedLang;
            break;
        }
    }
    
    return { translatedTexts, detectedSourceLang: detectedLang };
}

/**
 * ترجمة باستخدام خدمة DeepL المجانية
 */
/**
 * ترجمة نص واحد باستخدام Yandex Translate
 * @private
 */
async function _translateSingleWithYandex(text, sourceLang, targetLang) {
    // فحص الـ Cache أولاً
    const cacheKey = `yandex_cache_${sourceLang}_${targetLang}_${text}`;
    const cached = await getFromCache(cacheKey);
    
    if (cached) {
        return cached;
    }
    
    const url = `https://translate.yandex.net/api/v1/tr.json/translate?id=${Date.now()}-0-0&srv=tr-text&text=${encodeURIComponent(text)}&lang=${sourceLang}-${targetLang}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    if (!response.ok) {
        throw new Error(`خطأ في Yandex! الحالة: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.text && data.text[0]) {
        const translated = data.text[0];
        // حفظ في الـ Cache بشكل غير متزامن
        setToCache(cacheKey, translated).catch(() => {});
        return translated;
    }
    
    return text;
}

/**
 * ترجمة باستخدام خدمة Yandex Translate
 * تُرسل جميع النصوص بشكل متوازٍ لتحسين الأداء
 */
async function translateWithYandex(texts, sourceLang, targetLang) {
    // إرسال جميع الطلبات بشكل متوازٍ
    const promises = texts.map(text => 
        _translateSingleWithYandex(text, sourceLang, targetLang)
            .catch(error => {
                console.error('[Yandex Translate] خطأ:', error.message);
                return text; // إرجاع النص الأصلي عند الخطأ
            })
    );
    
    const translatedTexts = await Promise.all(promises);
    
    return { translatedTexts, detectedSourceLang: null };
}

/**
 * الحصول على مزود الترجمة المفضل من الإعدادات
 */
async function getPreferredProvider() {
    const settings = await chrome.storage.local.get({ translationProvider: 'google' });
    return settings.translationProvider;
}

/**
 * ترجمة باستخدام مزود محدد مع نظام الاحتياطي
 */
async function translateWithProvider(texts, sourceLang, targetLang, provider) {
    const providers = {
        google: translateWithGoogle,
        yandex: translateWithYandex
    };
    
    if (providers[provider]) {
        try {
            return await providers[provider](texts, sourceLang, targetLang);
        } catch (error) {
            throw error;
        }
    } else {
        throw new Error(`مزود الترجمة غير معروف: ${provider}`);
    }
}

/**
 * الدالة الرئيسية للترجمة مع نظام الاحتياطي التلقائي
 * @param {string[]} texts - مصفوفة النصوص للترجمة
 * @param {string} sourceLang - كود لغة المصدر
 * @param {string} targetLang - كود لغة الهدف
 * @returns {Promise<object>} نتيجة الترجمة
 */
export async function translate(texts, sourceLang, targetLang) {
    // ترتيب المزودين الاحتياطيين
    const preferredProvider = await getPreferredProvider();
    const fallbackOrder = ['google', 'yandex'];
    
    // وضع المزود المفضل في المقدمة
    const providersToTry = [preferredProvider, ...fallbackOrder.filter(p => p !== preferredProvider)];
    
    for (const provider of providersToTry) {
        try {
            const result = await translateWithProvider(texts, sourceLang, targetLang, provider);
            
            if (result.translatedTexts && result.translatedTexts.length > 0) {
                // إضافة معلومات المزود المستخدم إلى النتيجة
                result.usedProvider = provider;
                result.usedProviderName = TRANSLATION_PROVIDERS[provider];
                return result;
            }
        } catch (error) {
            continue;
        }
    }
    
    // إذا فشلت جميع المزودين
    return { translatedTexts: texts.map(() => ""), detectedSourceLang: null };
}
