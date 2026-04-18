/******************************************************************************
 * # الملف: content/workers/translation_worker.js
 * # الغرض: Web Worker لعزل عمليات الترجمة عن الخيط الرئيسي
 * # النمط المُطبق: Worker Thread Pattern + Message Channel Communication
 * # الأداء: يمنع تجميد UI عند ترجمة محتوى ضخم
 ******************************************************************************/

/**
 * ذاكرة تخزين محلية للترجمات داخل Worker
 * تُحسّن الأداء بتجنب استدعاءات chrome.runtime المتكررة
 * @type {Map<string, string>}
 */
const localCache = new Map();
const MAX_CACHE_SIZE = 1000; // حد أقصى للذاكرة المحلية

/**
 * إنشاء مفتاح فريد للترجمة
 * @param {string} text - النص الأصلي
 * @param {string} sourceLang - لغة المصدر
 * @param {string} targetLang - اللغة المستهدفة
 * @returns {string}
 */
function generateCacheKey(text, sourceLang, targetLang) {
    const hash = simpleHash(text.trim());
    return `${sourceLang}_${targetLang}_${hash}`;
}

/**
 * hash بسيط وسريع
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

/**
 * فحص الذاكرة المحلية
 * @param {string} text
 * @param {string} sourceLang
 * @param {string} targetLang
 * @returns {string|null}
 */
function checkLocalCache(text, sourceLang, targetLang) {
    const key = generateCacheKey(text, sourceLang, targetLang);
    return localCache.get(key) || null;
}

/**
 * حفظ في الذاكرة المحلية
 * @param {string} text
 * @param {string} sourceLang
 * @param {string} targetLang
 * @param {string} translation
 */
function saveToLocalCache(text, sourceLang, targetLang, translation) {
    // تنظيف الذاكرة إذا تجاوزت الحد
    if (localCache.size >= MAX_CACHE_SIZE) {
        const firstKey = localCache.keys().next().value;
        localCache.delete(firstKey);
    }
    
    const key = generateCacheKey(text, sourceLang, targetLang);
    localCache.set(key, translation);
}

/**
 * معالج الرسائل الواردة من الخيط الرئيسي
 */
self.addEventListener('message', async (event) => {
    const { type, data, requestId } = event.data;
    
    switch (type) {
        case 'TRANSLATE_BATCH':
            await handleTranslateBatch(data, requestId);
            break;
        
        case 'CLEAR_CACHE':
            localCache.clear();
            self.postMessage({ type: 'CACHE_CLEARED', requestId });
            break;
        
        case 'GET_CACHE_SIZE':
            self.postMessage({ 
                type: 'CACHE_SIZE', 
                size: localCache.size,
                requestId 
            });
            break;
        
        default:
            console.warn('[TranslationWorker] نوع رسالة غير معروف:', type);
    }
});

/**
 * معالجة طلب ترجمة دفعي
 * @param {Object} data - {texts, sourceLang, targetLang}
 * @param {string} requestId - معرف الطلب
 */
async function handleTranslateBatch(data, requestId) {
    const { texts, sourceLang, targetLang } = data;
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
        self.postMessage({ 
            type: 'TRANSLATION_ERROR', 
            error: 'قائمة النصوص فارغة',
            requestId 
        });
        return;
    }
    
    try {
        // ═══════════════════════════════════════════════════════════════════════════
        // الخطوة 1: فحص الذاكرة المحلية
        // ═══════════════════════════════════════════════════════════════════════════
        const cachedResults = [];
        const textsToTranslate = [];
        const textIndices = [];
        
        texts.forEach((text, index) => {
            const cached = checkLocalCache(text, sourceLang, targetLang);
            if (cached) {
                cachedResults[index] = cached;
            } else {
                textsToTranslate.push(text);
                textIndices.push(index);
            }
        });
        
        // إرسال النتائج المحفوظة فوراً
        if (cachedResults.length > 0) {
            self.postMessage({
                type: 'TRANSLATION_PROGRESS',
                cached: cachedResults.filter(Boolean).length,
                total: texts.length,
                requestId
            });
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الخطوة 2: ترجمة النصوص المتبقية عبر background service
        // ═══════════════════════════════════════════════════════════════════════════
        if (textsToTranslate.length > 0) {
            // ملاحظة: Worker لا يمكنه الوصول لـ chrome.runtime مباشرة
            // نستخدم MessageChannel للتواصل مع الخيط الرئيسي
            const translationResults = await requestTranslationFromMain(
                textsToTranslate,
                sourceLang,
                targetLang
            );
            
            // دمج النتائج
            translationResults.forEach((translation, idx) => {
                const originalIndex = textIndices[idx];
                cachedResults[originalIndex] = translation;
                
                // حفظ في الذاكرة المحلية
                saveToLocalCache(
                    textsToTranslate[idx],
                    sourceLang,
                    targetLang,
                    translation
                );
            });
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الخطوة 3: إرسال النتائج النهائية
        // ═══════════════════════════════════════════════════════════════════════════
        self.postMessage({
            type: 'TRANSLATION_COMPLETE',
            translations: cachedResults,
            requestId
        });
        
    } catch (error) {
        self.postMessage({
            type: 'TRANSLATION_ERROR',
            error: error.message || 'خطأ غير معروف في Worker',
            requestId
        });
    }
}

/**
 * طلب الترجمة من الخيط الرئيسي
 * يستخدم نمط Request-Response مع Promises
 * @param {Array<string>} texts
 * @param {string} sourceLang
 * @param {string} targetLang
 * @returns {Promise<Array<string>>}
 */
function requestTranslationFromMain(texts, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // معالج الاستجابة
        channel.port1.onmessage = (event) => {
            const { success, translations, error } = event.data;
            
            if (success) {
                resolve(translations);
            } else {
                reject(new Error(error || 'فشلت الترجمة'));
            }
            
            channel.port1.close();
        };
        
        // إرسال الطلب للخيط الرئيسي
        self.postMessage({
            type: 'REQUEST_TRANSLATION',
            data: { texts, sourceLang, targetLang },
            requestId,
            port: channel.port2
        }, [channel.port2]); // Transferable Object
        
        // مهلة زمنية للطلب
        setTimeout(() => {
            reject(new Error('انتهت مهلة طلب الترجمة'));
            channel.port1.close();
        }, 30000); // 30 ثانية
    });
}

/**
 * معالج الأخطاء العامة
 */
self.addEventListener('error', (event) => {
    console.error('[TranslationWorker] خطأ غير معالج:', event.error);
    self.postMessage({
        type: 'WORKER_ERROR',
        error: event.error?.message || 'خطأ غير معروف'
    });
});

/**
 * معالج الأخطاء غير المُعالجة في Promises
 */
self.addEventListener('unhandledrejection', (event) => {
    console.error('[TranslationWorker] Promise rejection غير معالج:', event.reason);
    self.postMessage({
        type: 'WORKER_ERROR',
        error: event.reason?.message || 'خطأ في Promise'
    });
});

// رسالة تأكيد جاهزية Worker
self.postMessage({ type: 'WORKER_READY' });
