/******************************************************************************
 * # الملف: content/modules/database.js
 * # الغرض: وحدة مركزية للتعامل مع chrome.storage.local (ذاكرة الترجمات)
 * # الموقع: الطبقة الأساسية لاستمرارية البيانات
 ******************************************************************************/

/**
 * وحدة قاعدة البيانات الموحدة - تدير عمليات التخزين عبر chrome.storage.local
 * @namespace TarjomanDB
 */
window.TarjomanDB = (function() {
    /** بادئات المفاتيح للتمييز بين أنواع البيانات */
    const PREFIXES = {
        CACHE: 'tarjoman_cache_',      // ذاكرة الترجمات
        SETTING: 'tarjoman_setting_'   // الإعدادات
    };
    
    /** الحد الأقصى لحجم ذاكرة الترجمات (50 ميغابايت) */
    const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

    /**
     * إنشاء hash بسيط وسريع للنص
     * @param {string} text - النص المراد تجزئته
     * @returns {string} قيمة hash
     */
    function hashText(text) {
        let hash = 0;
        if (!text || text.length === 0) return hash.toString(36);
        
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(36);
    }

    /**
     * إنشاء مفتاح فريد للترجمة
     * @param {string} text - النص الأصلي
     * @param {string} sourceLang - لغة المصدر
     * @param {string} targetLang - اللغة المستهدفة
     * @returns {string} مفتاح فريد
     */
    function generateCacheKey(text, sourceLang, targetLang) {
        const textHash = hashText(text.trim());
        return `${PREFIXES.CACHE}${sourceLang}_${targetLang}_${textHash}`;
    }

    /**
     * استخراج النطاق من عنوان URL
     * @param {string} [url] - عنوان الصفحة
     * @returns {string} النطاق بدون www
     */
    function extractDomain(url) {
        try {
            const hostname = new URL(url || window.location.href).hostname;
            return hostname.replace(/^www\./, '');
        } catch (e) {
            return window.location.hostname.replace(/^www\./, '');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ║                   عمليات ذاكرة الترجمات                      ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * حفظ ترجمة في الذاكرة المؤقتة
     * @param {Object} params - بيانات الترجمة
     * @returns {Promise<boolean>} نجاح العملية
     */
    async function cacheTranslation({ originalText, translatedText, sourceLang, targetLang }) {
        try {
            const key = generateCacheKey(originalText, sourceLang, targetLang);
            const record = {
                originalText: originalText.trim(),
                translatedText,
                sourceLang,
                targetLang,
                createdAt: Date.now()
            };
            
            await chrome.storage.local.set({ [key]: record });
            return true;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في حفظ الترجمة:', error);
            return false;
        }
    }

    /**
     * حفظ مجموعة ترجمات دفعة واحدة
     * @param {Array<Object>} translations - مصفوفة الترجمات
     * @returns {Promise<boolean>} نجاح العملية
     */
    async function cacheBulkTranslations(translations) {
        if (!translations || translations.length === 0) return true;
        
        try {
            const now = Date.now();
            const dataToStore = {};
            
            translations.forEach(({ originalText, translatedText, sourceLang, targetLang }) => {
                const key = generateCacheKey(originalText, sourceLang, targetLang);
                dataToStore[key] = {
                    originalText: originalText.trim(),
                    translatedText,
                    sourceLang,
                    targetLang,
                    createdAt: now
                };
            });
            
            await chrome.storage.local.set(dataToStore);
            return true;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في الحفظ الدفعي:', error);
            return false;
        }
    }

    /**
     * استرجاع ترجمة من الذاكرة المؤقتة
     * @param {string} originalText - النص الأصلي
     * @param {string} sourceLang - لغة المصدر
     * @param {string} targetLang - اللغة المستهدفة
     * @returns {Promise<string|null>} النص المترجم أو null
     */
    async function getCachedTranslation(originalText, sourceLang, targetLang) {
        try {
            const key = generateCacheKey(originalText, sourceLang, targetLang);
            const result = await chrome.storage.local.get(key);
            const record = result[key];
            
            if (!record) return null;
            
            return record.translatedText;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في استرجاع الترجمة:', error);
            return null;
        }
    }

    /**
     * استرجاع مجموعة ترجمات دفعة واحدة
     * @param {Array<Object>} requests - مصفوفة الطلبات
     * @returns {Promise<Map<string, string>>} خريطة النص → الترجمة
     */
    async function getCachedBulkTranslations(requests) {
        const results = new Map();
        if (!requests || requests.length === 0) return results;
        
        try {
            const keys = requests.map(({ text, sourceLang, targetLang }) => 
                generateCacheKey(text, sourceLang, targetLang)
            );
            
            const stored = await chrome.storage.local.get(keys);
            
            requests.forEach(({ text, sourceLang, targetLang }) => {
                const key = generateCacheKey(text, sourceLang, targetLang);
                const record = stored[key];
                
                if (record) {
                    results.set(text.trim(), record.translatedText);
                }
            });
            
            return results;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في الاسترجاع الدفعي:', error);
            return results;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ║                   عمليات الإعدادات                           ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * حفظ إعداد
     * @param {string} key - مفتاح الإعداد
     * @param {*} value - قيمة الإعداد
     * @returns {Promise<boolean>}
     */
    async function saveSetting(key, value) {
        try {
            const storageKey = `${PREFIXES.SETTING}${key}`;
            await chrome.storage.local.set({ [storageKey]: { value, updatedAt: Date.now() } });
            return true;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في حفظ الإعداد:', error);
            return false;
        }
    }

    /**
     * استرجاع إعداد
     * @param {string} key - مفتاح الإعداد
     * @param {*} [defaultValue=null] - القيمة الافتراضية
     * @returns {Promise<*>}
     */
    async function getSetting(key, defaultValue = null) {
        try {
            const storageKey = `${PREFIXES.SETTING}${key}`;
            const result = await chrome.storage.local.get(storageKey);
            const record = result[storageKey];
            return record ? record.value : defaultValue;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في استرجاع الإعداد:', error);
            return defaultValue;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ║                   عمليات الصيانة                             ║
    // ═══════════════════════════════════════════════════════════════

    /**
     * حساب الحجم التقريبي للبيانات بالبايت
     * @param {*} data - البيانات المراد حساب حجمها
     * @returns {number} الحجم بالبايت
     */
    function estimateSize(data) {
        const str = JSON.stringify(data);
        // UTF-16 يستخدم 2 بايت لكل حرف
        return str.length * 2;
    }

    /**
     * تنظيف الذاكرة المؤقتة عند تجاوز الحد الأقصى (50 ميغابايت)
     * يحذف الترجمات الأقدم أولاً حتى يصبح الحجم ضمن الحد المسموح
     * @returns {Promise<number>} عدد السجلات المحذوفة
     */
    async function cleanupExpiredRecords() {
        try {
            const allData = await chrome.storage.local.get(null);
            
            // جمع بيانات الترجمات مع حجمها وتاريخها
            const cacheEntries = [];
            let totalCacheSize = 0;
            
            Object.entries(allData).forEach(([key, value]) => {
                if (key.startsWith(PREFIXES.CACHE)) {
                    const entrySize = estimateSize({ [key]: value });
                    totalCacheSize += entrySize;
                    cacheEntries.push({
                        key,
                        size: entrySize,
                        createdAt: value.createdAt || 0
                    });
                }
            });
            
            // إذا الحجم ضمن الحد، لا حاجة للتنظيف
            if (totalCacheSize <= MAX_CACHE_SIZE_BYTES) {
                return 0;
            }
            
            // ترتيب حسب التاريخ (الأقدم أولاً)
            cacheEntries.sort((a, b) => a.createdAt - b.createdAt);
            
            // حذف الترجمات الأقدم حتى ننزل تحت الحد
            const keysToDelete = [];
            let currentSize = totalCacheSize;
            
            for (const entry of cacheEntries) {
                if (currentSize <= MAX_CACHE_SIZE_BYTES) break;
                keysToDelete.push(entry.key);
                currentSize -= entry.size;
            }
            
            if (keysToDelete.length > 0) {
                await chrome.storage.local.remove(keysToDelete);
            }
            
            return keysToDelete.length;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في التنظيف:', error);
            return 0;
        }
    }

    /**
     * مسح جميع بيانات الذاكرة المؤقتة
     * @returns {Promise<boolean>}
     */
    async function clearAllCache() {
        try {
            const allData = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(allData).filter(key => key.startsWith(PREFIXES.CACHE));
            
            if (cacheKeys.length > 0) {
                await chrome.storage.local.remove(cacheKeys);
            }
            
            return true;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في مسح الترجمات:', error);
            return false;
        }
    }

    /**
     * مسح جميع الترجمات مع إرجاع العدد المحذوف
     * @returns {Promise<{success: boolean, deletedCount: number}>}
     */
    async function clearAllCacheWithCount() {
        try {
            const allData = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(allData).filter(key => key.startsWith(PREFIXES.CACHE));
            const count = cacheKeys.length;
            
            if (count > 0) {
                await chrome.storage.local.remove(cacheKeys);
            }
            
            return { success: true, deletedCount: count };
        } catch (error) {
            console.error('[TarjomanDB] خطأ في مسح الترجمات:', error);
            return { success: false, deletedCount: 0 };
        }
    }

    /**
     * الحصول على إحصائيات قاعدة البيانات مع حجم الذاكرة المؤقتة
     * @returns {Promise<Object>}
     */
    async function getStats() {
        try {
            const allData = await chrome.storage.local.get(null);
            const stats = {
                cachedTranslations: 0,
                settings: 0,
                cacheSizeBytes: 0,
                cacheSizeMB: 0
            };
            
            Object.entries(allData).forEach(([key, value]) => {
                if (key.startsWith(PREFIXES.CACHE)) {
                    stats.cachedTranslations++;
                    stats.cacheSizeBytes += estimateSize({ [key]: value });
                } else if (key.startsWith(PREFIXES.SETTING)) {
                    stats.settings++;
                }
            });
            
            stats.cacheSizeMB = (stats.cacheSizeBytes / (1024 * 1024)).toFixed(2);
            
            return stats;
        } catch (error) {
            console.error('[TarjomanDB] خطأ في الإحصائيات:', error);
            return { cachedTranslations: 0, settings: 0, cacheSizeBytes: 0, cacheSizeMB: '0.00' };
        }
    }

    // الواجهة العامة للوحدة
    return {
        // ثوابت
        PREFIXES,
        MAX_CACHE_SIZE_BYTES,
        
        // أساسيات
        hashText,
        generateCacheKey,
        extractDomain,
        estimateSize,
        
        // ذاكرة الترجمات
        cacheTranslation,
        cacheBulkTranslations,
        getCachedTranslation,
        getCachedBulkTranslations,
        
        // الإعدادات
        saveSetting,
        getSetting,
        
        // الصيانة
        cleanupExpiredRecords,
        clearAllCache,
        clearAllCacheWithCount,
        getStats
    };
})();
