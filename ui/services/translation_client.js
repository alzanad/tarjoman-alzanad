/******************************************************************************
 * # الملف: ui/services/translation_client.js
 * # الغرض: واجهة موحدة للتواصل مع خدمة الترجمة في الخلفية
 * # الاستخدام: في واجهات المستخدم (options.js, popup.js)
 ******************************************************************************/

/**
 * عميل الترجمة الموحد - يغلّف الاتصال بالخلفية ويوفر واجهة بسيطة
 * @namespace TarjomanTranslationClient
 */
const TarjomanTranslationClient = (function() {
    
    /**
     * حالات الترجمة
     * @readonly
     * @enum {string}
     */
    const TranslationStatus = {
        IDLE: 'idle',
        LOADING: 'loading',
        SUCCESS: 'success',
        ERROR: 'error'
    };

    /**
     * أخطاء معروفة
     * @readonly
     * @enum {string}
     */
    const TranslationError = {
        NETWORK: 'خطأ في الاتصال بخدمة الترجمة',
        EMPTY_TEXT: 'النص فارغ',
        SERVICE_UNAVAILABLE: 'خدمة الترجمة غير متاحة',
        TIMEOUT: 'انتهت مهلة الترجمة',
        UNKNOWN: 'خطأ غير معروف'
    };

    /**
     * ترجمة نص واحد
     * @param {string} text - النص المراد ترجمته
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} [sourceLang='auto'] - لغة المصدر (افتراضي: كشف تلقائي)
     * @returns {Promise<{success: boolean, translation?: string, detectedLang?: string, error?: string}>}
     */
    async function translateText(text, targetLang, sourceLang = 'auto') {
        // التحقق من صحة المدخلات
        if (!text || typeof text !== 'string') {
            return { 
                success: false, 
                error: TranslationError.EMPTY_TEXT 
            };
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return { 
                success: false, 
                error: TranslationError.EMPTY_TEXT 
            };
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'requestTranslation',
                texts: [trimmedText],
                sourceLang: sourceLang,
                targetLang: targetLang
            });

            if (response && response.translatedTexts && response.translatedTexts[0]) {
                return {
                    success: true,
                    translation: response.translatedTexts[0],
                    detectedLang: response.detectedSourceLang || null
                };
            }

            return {
                success: false,
                error: TranslationError.SERVICE_UNAVAILABLE
            };

        } catch (error) {
            console.error('[TranslationClient] خطأ:', error);
            return {
                success: false,
                error: TranslationError.NETWORK
            };
        }
    }

    /**
     * ترجمة مجموعة نصوص دفعة واحدة
     * @param {Array<string>} texts - مصفوفة النصوص
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} [sourceLang='auto'] - لغة المصدر
     * @returns {Promise<{success: boolean, translations?: Array<string>, detectedLang?: string, error?: string}>}
     */
    async function translateBatch(texts, targetLang, sourceLang = 'auto') {
        // التحقق من صحة المدخلات
        if (!Array.isArray(texts) || texts.length === 0) {
            return {
                success: false,
                error: TranslationError.EMPTY_TEXT
            };
        }

        // تصفية النصوص الفارغة
        const validTexts = texts.map(t => (t || '').trim()).filter(t => t.length > 0);
        
        if (validTexts.length === 0) {
            return {
                success: false,
                error: TranslationError.EMPTY_TEXT
            };
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'requestTranslation',
                texts: validTexts,
                sourceLang: sourceLang,
                targetLang: targetLang
            });

            if (response && response.translatedTexts) {
                return {
                    success: true,
                    translations: response.translatedTexts,
                    detectedLang: response.detectedSourceLang || null
                };
            }

            return {
                success: false,
                error: TranslationError.SERVICE_UNAVAILABLE
            };

        } catch (error) {
            console.error('[TranslationClient] خطأ في الترجمة الدفعية:', error);
            return {
                success: false,
                error: TranslationError.NETWORK
            };
        }
    }

    /**
     * كشف لغة النص
     * @param {string} text - النص للكشف عن لغته
     * @returns {Promise<{success: boolean, detectedLang?: string, error?: string}>}
     */
    async function detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return {
                success: false,
                error: TranslationError.EMPTY_TEXT
            };
        }

        // نستخدم ترجمة وهمية للكشف عن اللغة
        const result = await translateText(text, 'en', 'auto');
        
        if (result.success && result.detectedLang) {
            return {
                success: true,
                detectedLang: result.detectedLang
            };
        }

        return {
            success: false,
            error: result.error || TranslationError.UNKNOWN
        };
    }

    // الواجهة العامة
    return {
        translateText,
        translateBatch,
        detectLanguage,
        TranslationStatus,
        TranslationError
    };
})();

// تصدير للاستخدام العالمي
if (typeof window !== 'undefined') {
    window.TarjomanTranslationClient = TarjomanTranslationClient;
}
