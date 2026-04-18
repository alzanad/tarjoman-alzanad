/******************************************************************************
 * # الملف: content/modules/batch_translator.js
 * # الغرض: ترجمة مجموعات من النصوص على دفعات لتحسين الأداء
 * # الاعتماديات: constants.js, translation_applier.js, translation_worker.js
 * # النمط المُطبق: Worker Thread Pattern + Queue System
 ******************************************************************************/

/**
 * وحدة الترجمة الدفعية - تعالج النصوص على دفعات عبر Web Worker
 * تستخدم طابور (queue) لتجميع الطلبات وإرسالها دفعة واحدة
 * @namespace TarjomanBatch
 */
window.TarjomanBatch = (function() {
    const state = window.TarjomanState;
    const constants = window.TarjomanConstants;
    const applier = window.TarjomanApplier;

    // طابور الطلبات والتأخير
    const QUEUE_FLUSH_DELAY = 200; // تفريغ الطابور كل 200ms
    let requestQueue = [];
    let queueFlushTimer = null;
    let currentTargetLang = null;
    let currentMode = null;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Web Worker Setup
    // ═══════════════════════════════════════════════════════════════════════════
    let translationWorker = null;
    let workerSupported = true;
    let workerReady = false;
    const pendingWorkerRequests = new Map();
    
    /**
     * تهيئة Web Worker للترجمة
     */
    function initializeWorker() {
        if (!workerSupported || translationWorker) return;
        
        try {
            const workerPath = chrome.runtime.getURL('content/workers/translation_worker.js');
            translationWorker = new Worker(workerPath);
            
            translationWorker.addEventListener('message', handleWorkerMessage);
            translationWorker.addEventListener('error', handleWorkerError);
            
        } catch (error) {
            console.warn('[TarjomanBatch] Web Worker غير مدعوم، استخدام الطريقة التقليدية:', error);
            workerSupported = false;
            translationWorker = null;
        }
    }
    
    /**
     * معالج رسائل Worker
     */
    function handleWorkerMessage(event) {
        const { type, requestId, translations, error, port } = event.data;
        
        switch (type) {
            case 'WORKER_READY':
                workerReady = true;
                console.log('[TarjomanBatch] Worker جاهز للعمل');
                break;
            
            case 'TRANSLATION_COMPLETE':
                if (pendingWorkerRequests.has(requestId)) {
                    const { resolve } = pendingWorkerRequests.get(requestId);
                    resolve(translations);
                    pendingWorkerRequests.delete(requestId);
                }
                break;
            
            case 'TRANSLATION_ERROR':
                if (pendingWorkerRequests.has(requestId)) {
                    const { reject } = pendingWorkerRequests.get(requestId);
                    reject(new Error(error));
                    pendingWorkerRequests.delete(requestId);
                }
                break;
            
            case 'REQUEST_TRANSLATION':
                // Worker يطلب ترجمة من background service
                handleWorkerTranslationRequest(event.data, port);
                break;
            
            case 'TRANSLATION_PROGRESS':
                // تقرير تقدم (اختياري)
                console.log(`[TarjomanBatch] تقدم: ${event.data.cached}/${event.data.total} من الذاكرة`);
                break;
        }
    }
    
    /**
     * معالج أخطاء Worker
     */
    function handleWorkerError(error) {
        console.error('[TarjomanBatch] خطأ في Worker:', error);
        workerSupported = false;
        
        // إعادة المحاولة بالطريقة التقليدية
        if (requestQueue.length > 0) {
            flushQueueTraditional();
        }
    }
    
    /**
     * معالج طلبات الترجمة من Worker
     */
    async function handleWorkerTranslationRequest(data, port) {
        const { texts, sourceLang, targetLang } = data.data;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'requestTranslation',
                texts: texts,
                sourceLang: sourceLang,
                targetLang: targetLang
            });
            
            port.postMessage({
                success: response && response.translatedTexts ? true : false,
                translations: response?.translatedTexts || [],
                error: response?.error
            });
        } catch (error) {
            port.postMessage({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * إضافة عناصر للطابور وجدولة التفريغ
     * @param {Array} items - العناصر للترجمة
     * @param {string} mode - وضع الترجمة
     * @param {string} targetLang - اللغة المستهدفة
     */
    function translateItems(items, mode, targetLang) {
        if (!items || items.length === 0) return;
        
        // تحديث معلومات الترجمة الحالية
        currentTargetLang = targetLang;
        currentMode = mode;
        
        // تهيئة Worker إذا لم يكن موجوداً
        if (!translationWorker && workerSupported) {
            initializeWorker();
        }
        
        // إضافة العناصر للطابور
        requestQueue.push(...items);
        
        // جدولة تفريغ الطابور (إذا لم يكن مجدولاً بالفعل)
        if (!queueFlushTimer) {
            queueFlushTimer = setTimeout(() => {
                flushQueue();
            }, QUEUE_FLUSH_DELAY);
        }
    }

    /**
     * تفريغ الطابور وإرسال الطلبات دفعة واحدة
     * يستخدم Worker إذا كان متاحاً، وإلا يعود للطريقة التقليدية
     */
    async function flushQueue() {
        // إعادة تعيين المؤقت
        queueFlushTimer = null;
        
        // نسخ الطابور وتفريغه
        const itemsToProcess = [...requestQueue];
        requestQueue = [];
        
        if (itemsToProcess.length === 0) return;
        
        // استخدام Worker إذا كان جاهزاً
        if (workerSupported && translationWorker && workerReady) {
            await flushQueueWithWorker(itemsToProcess);
        } else {
            // Fallback للطريقة التقليدية
            await flushQueueTraditional(itemsToProcess);
        }
    }
    
    /**
     * تفريغ الطابور باستخدام Web Worker
     * @param {Array} items - العناصر للترجمة
     */
    async function flushQueueWithWorker(items) {
        const texts = items.map(item => item.text);
        const ids = items.map(item => item.id);
        
        try {
            // إرسال الطلب للWorker
            const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const translationsPromise = new Promise((resolve, reject) => {
                pendingWorkerRequests.set(requestId, { resolve, reject });
                
                // مهلة زمنية
                setTimeout(() => {
                    if (pendingWorkerRequests.has(requestId)) {
                        pendingWorkerRequests.delete(requestId);
                        reject(new Error('انتهت مهلة طلب الترجمة'));
                    }
                }, 30000);
            });
            
            translationWorker.postMessage({
                type: 'TRANSLATE_BATCH',
                data: {
                    texts: texts,
                    sourceLang: 'auto',
                    targetLang: currentTargetLang
                },
                requestId
            });
            
            const translatedTexts = await translationsPromise;
            
            // تطبيق الترجمات
            const translatedMap = new Map();
            ids.forEach((id, index) => {
                if (translatedTexts[index]) {
                    translatedMap.set(id, translatedTexts[index]);
                }
            });
            
            applier.applyTranslations(translatedMap, currentMode);
            
        } catch (error) {
            console.error('[TarjomanBatch] خطأ في Worker، استخدام الطريقة التقليدية:', error);
            workerSupported = false;
            await flushQueueTraditional(items);
        }
    }
    
    /**
     * تفريغ الطابور بالطريقة التقليدية (بدون Worker)
     * @param {Array} [items] - العناصر للترجمة (اختياري)
     */
    async function flushQueueTraditional(items) {
        const itemsToProcess = items || [...requestQueue];
        if (!items) requestQueue = [];
        
        if (itemsToProcess.length === 0) return;
        
        const texts = itemsToProcess.map(item => item.text);
        const ids = itemsToProcess.map(item => item.id);

        // ترجمة على دفعات حسب حجم الدفعة المسموح
        for (let i = 0; i < texts.length; i += constants.BATCH_SIZE) {
            const textBatch = texts.slice(i, i + constants.BATCH_SIZE);
            const idBatch = ids.slice(i, i + constants.BATCH_SIZE);
            
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'requestTranslation',
                    texts: textBatch,
                    sourceLang: 'auto',
                    targetLang: currentTargetLang
                });
                
                if (response && response.translatedTexts) {
                    // حفظ اللغة المكتشفة
                    if (response.detectedSourceLang) {
                        state.lastDetectedLang = response.detectedSourceLang;
                    }
                    
                    // تطبيق الترجمات
                    const translatedMap = new Map();
                    idBatch.forEach((id, index) => {
                        if (response.translatedTexts[index]) {
                            translatedMap.set(id, response.translatedTexts[index]);
                        }
                    });
                    applier.applyTranslations(translatedMap, currentMode);
                }
            } catch (e) {
                console.error("[TarjomanBatch] خطأ في الترجمة:", e);
            }
        }
    }

    /**
     * تفريغ فوري للطابور (للحالات العاجلة)
     */
    function forceFlush() {
        if (queueFlushTimer) {
            clearTimeout(queueFlushTimer);
            queueFlushTimer = null;
        }
        flushQueue();
    }

    /**
     * مسح الطابور (عند إعادة التعيين)
     */
    function clearQueue() {
        if (queueFlushTimer) {
            clearTimeout(queueFlushTimer);
            queueFlushTimer = null;
        }
        requestQueue = [];
    }

    /**
     * الحصول على حجم الطابور الحالي
     * @returns {number} عدد العناصر في الطابور
     */
    function getQueueSize() {
        return requestQueue.length;
    }
    
    /**
     * تنظيف الموارد عند إنهاء الترجمة
     */
    function cleanup() {
        clearQueue();
        
        if (translationWorker) {
            translationWorker.terminate();
            translationWorker = null;
            workerReady = false;
        }
        
        pendingWorkerRequests.clear();
    }

    // الواجهة العامة للوحدة
    return {
        translateItems,
        forceFlush,
        clearQueue,
        getQueueSize,
        cleanup
    };
})();
