/******************************************************************************
 * # الملف: content/modules/observer.js
 * # الغرض: مراقبة متعددة الطبقات للتغييرات الديناميكية في DOM
 * # الاعتماديات: constants.js, text_collector.js, batch_translator.js
 * # النمط المُطبق: Layered Detection Pattern (MutationObserver + Event Listeners)
 ******************************************************************************/

/**
 * وحدة المراقبة المُحسّنة - رصد شامل للتغييرات في DOM وتطبيقات SPA
 * @namespace TarjomanObserver
 */
window.TarjomanObserver = (function() {
    const state = window.TarjomanState;
    const constants = window.TarjomanConstants;
    const collector = window.TarjomanCollector;
    const batch = window.TarjomanBatch;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // متغيرات الرصد والتتبع
    // ═══════════════════════════════════════════════════════════════════════════
    let debounceTimer = null;
    let pendingNodes = new Set();
    const DEBOUNCE_DELAY = 150; // تأخير لتجميع التغييرات
    const CLEANUP_INTERVAL = 30000; // تنظيف كل 30 ثانية
    
    let processedElements = new WeakSet();
    let cleanupIntervalId = null;
    let trackedElements = new Set();
    
    // معلمات الترجمة الحالية (للاستخدام في event handlers)
    let currentTargetLang = null;
    let currentMode = null;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Layered Detection Pattern - متغيرات الطبقات الإضافية
    // ═══════════════════════════════════════════════════════════════════════════
    let intersectionObserver = null;
    let performanceObserver = null;
    let contentHashPollingId = null;
    let lastContentHash = '';
    const HASH_POLLING_INTERVAL = 2000; // مقارنة hash كل 2 ثانية
    
    // ═══════════════════════════════════════════════════════════════════════════
    // دوال التصفية والمعالجة
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * فحص ما إذا كان العنصر يحتوي على عناصر مترجمة سابقاً
     * @param {Element} node - العنصر المراد فحصه
     * @returns {boolean}
     */
    function hasTranslatedContent(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        
        if (node.hasAttribute('data-tarjoman-translation') || 
            node.hasAttribute('data-immersive-translate')) {
            return true;
        }
        
        const translatedChildren = node.querySelectorAll(
            '[data-tarjoman-translation], [data-immersive-translate]'
        );
        
        return translatedChildren.length > 0;
    }

    /**
     * معالجة العناصر المعلقة بعد انتهاء الـ debounce
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} mode - وضع الترجمة
     */
    function processPendingNodes(targetLang, mode) {
        if (pendingNodes.size === 0) return;
        
        const nodesToProcess = Array.from(pendingNodes);
        pendingNodes.clear();
        
        const newItems = [];
        
        nodesToProcess.forEach(node => {
            if (!document.contains(node)) return;
            if (processedElements.has(node)) return;
            if (hasTranslatedContent(node)) {
                processedElements.add(node);
                return;
            }
            
            const items = collector.collectTranslatableItems(node);
            items.forEach(item => {
                // ═══════════════════════════════════════════════════════════════
                // إصلاح حرج: collector يُرجع {id, text, detectedLang}
                // نحصل على العنصر الفعلي من state.originalItems
                // ═══════════════════════════════════════════════════════════════
                const storedItem = state.originalItems.get(item.id);
                if (!storedItem || !storedItem.node) return;
                
                const elementNode = storedItem.type === 'text' 
                    ? storedItem.node.parentElement 
                    : storedItem.node;
                
                if (!elementNode || processedElements.has(elementNode)) return;
                
                newItems.push(item);
                processedElements.add(elementNode);
                trackedElements.add(new WeakRef(elementNode));
            });
            
            processedElements.add(node);
            trackedElements.add(new WeakRef(node));
        });
        
        if (newItems.length > 0) {
            batch.translateItems(newItems, mode, targetLang);
        }
    }

    /**
     * تنظيف العناصر غير المرئية وغير الموجودة في DOM
     * يُستدعى دورياً لتحرير الذاكرة
     */
    function cleanupProcessedElements() {
        const elementsToRemove = [];
        
        trackedElements.forEach(weakRef => {
            const element = weakRef.deref();
            
            // إزالة العناصر التي جُمعت من الذاكرة أو خرجت من DOM
            if (!element || !document.contains(element)) {
                elementsToRemove.push(weakRef);
            }
        });
        
        // حذف المراجع الميتة
        elementsToRemove.forEach(ref => {
            trackedElements.delete(ref);
        });
        
        // إعادة إنشاء processedElements إذا أصبح كبيراً جداً
        if (trackedElements.size > 5000) {
            const newProcessedElements = new WeakSet();
            trackedElements.forEach(weakRef => {
                const element = weakRef.deref();
                if (element && document.contains(element)) {
                    newProcessedElements.add(element);
                }
            });
            processedElements = newProcessedElements;
        }
    }

    /**
     * بدء التنظيف الدوري للذاكرة
     */
    function startCleanupInterval() {
        if (cleanupIntervalId) return;
        
        cleanupIntervalId = setInterval(() => {
            cleanupProcessedElements();
        }, CLEANUP_INTERVAL);
    }

    /**
     * إيقاف التنظيف الدوري
     */
    function stopCleanupInterval() {
        if (cleanupIntervalId) {
            clearInterval(cleanupIntervalId);
            cleanupIntervalId = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Layered Detection Pattern - الطبقات الإضافية
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * حساب hash بسيط للمحتوى المرئي
     * @returns {string} hash المحتوى
     */
    function calculateVisibleContentHash() {
        const visibleElements = Array.from(document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div[class*="text"], a'))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0 && el.textContent.trim().length > 0;
            })
            .map(el => el.textContent.trim())
            .join('|');
        
        // hash بسيط
        let hash = 0;
        for (let i = 0; i < visibleElements.length; i++) {
            const char = visibleElements.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Polling خفيف لمقارنة hash المحتوى المرئي
     * يكتشف التغييرات التي قد تفوت MutationObserver
     */
    function startContentHashPolling() {
        if (contentHashPollingId) return;
        
        lastContentHash = calculateVisibleContentHash();
        
        contentHashPollingId = setInterval(() => {
            const currentHash = calculateVisibleContentHash();
            
            if (currentHash !== lastContentHash) {
                lastContentHash = currentHash;
                
                // اكتشاف محتوى جديد - جمع العناصر المرئية غير المترجمة
                const visibleElements = Array.from(document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div[class*="text"], a'))
                    .filter(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.top < window.innerHeight && rect.bottom > 0 && 
                               !processedElements.has(el) && 
                               !hasTranslatedContent(el);
                    });
                
                visibleElements.forEach(el => pendingNodes.add(el));
                
                if (pendingNodes.size > 0 && currentTargetLang && currentMode) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        processPendingNodes(currentTargetLang, currentMode);
                    }, DEBOUNCE_DELAY);
                }
            }
        }, HASH_POLLING_INTERVAL);
    }

    /**
     * إيقاف Content Hash Polling
     */
    function stopContentHashPolling() {
        if (contentHashPollingId) {
            clearInterval(contentHashPollingId);
            contentHashPollingId = null;
            lastContentHash = '';
        }
    }

    /**
     * تفعيل IntersectionObserver - رصد العناصر الداخلة للـ viewport
     * يترجم العناصر عند دخولها منطقة العرض لأول مرة
     */
    function startIntersectionObserver() {
        if (intersectionObserver || !('IntersectionObserver' in window)) return;
        
        intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !processedElements.has(entry.target)) {
                    pendingNodes.add(entry.target);
                }
            });
            
            if (pendingNodes.size > 0 && currentTargetLang && currentMode) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    processPendingNodes(currentTargetLang, currentMode);
                }, DEBOUNCE_DELAY);
            }
        }, {
            root: null,
            rootMargin: '50px', // بدء الترجمة قبل 50px من الدخول للـviewport
            threshold: 0.1
        });
        
        // مراقبة جميع العناصر النصية الرئيسية
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, article, section, div[class*="content"], div[class*="text"]');
        textElements.forEach(el => {
            if (!processedElements.has(el)) {
                intersectionObserver.observe(el);
            }
        });
    }

    /**
     * إيقاف IntersectionObserver
     */
    function stopIntersectionObserver() {
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }
    }

    /**
     * تفعيل PerformanceObserver - رصد تغييرات DOM عبر Performance API
     * يكتشف عمليات DOM الثقيلة التي قد تفوت MutationObserver
     */
    function startPerformanceObserver() {
        if (performanceObserver || !('PerformanceObserver' in window)) return;
        
        try {
            performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                
                // البحث عن performance entries مرتبطة بتغييرات DOM
                entries.forEach(entry => {
                    if (entry.entryType === 'measure' && entry.name.includes('dom')) {
                        // حدثت عملية DOM كبيرة - فحص المحتوى
                        setTimeout(() => {
                            const newElements = Array.from(document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
                                .filter(el => !processedElements.has(el) && !hasTranslatedContent(el));
                            
                            newElements.forEach(el => pendingNodes.add(el));
                            
                            if (pendingNodes.size > 0 && currentTargetLang && currentMode) {
                                processPendingNodes(currentTargetLang, currentMode);
                            }
                        }, 200);
                    }
                });
            });
            
            performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
        } catch (e) {
            // PerformanceObserver غير مدعوم بالكامل - تجاهل
            performanceObserver = null;
        }
    }

    /**
     * إيقاف PerformanceObserver
     */
    function stopPerformanceObserver() {
        if (performanceObserver) {
            performanceObserver.disconnect();
            performanceObserver = null;
        }
    }

    /**
     * مراقبة حية محسّنة للمحتوى الجديد - نمط الرصد الشامل متعدد الطبقات
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} mode - وضع الترجمة
     */
    function observeNewContent(targetLang, mode) {
        if (state.observer) return;
        
        // حفظ المعلمات للاستخدام في event handlers
        currentTargetLang = targetLang;
        currentMode = mode;
        
        startCleanupInterval();
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 1: MutationObserver (الأساسية)
        // ═══════════════════════════════════════════════════════════════════════════
        state.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        pendingNodes.add(node);
                        
                        // تسجيل العنصر في IntersectionObserver إذا كان نشطاً
                        if (intersectionObserver && !processedElements.has(node)) {
                            intersectionObserver.observe(node);
                        }
                    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        if (node.parentElement) {
                            pendingNodes.add(node.parentElement);
                        }
                    }
                });
                
                if (mutation.type === 'characterData' && mutation.target.parentElement) {
                    pendingNodes.add(mutation.target.parentElement);
                }
            });
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                processPendingNodes(targetLang, mode);
            }, DEBOUNCE_DELAY);
        });
        
        state.observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            characterData: true 
        });
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 2: IntersectionObserver (رصد العناصر الداخلة للـviewport)
        // ═══════════════════════════════════════════════════════════════════════════
        startIntersectionObserver();
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 3: PerformanceObserver (رصد عمليات DOM الثقيلة)
        // ═══════════════════════════════════════════════════════════════════════════
        startPerformanceObserver();
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 4: Content Hash Polling (fallback لكل الحالات)
        // ═══════════════════════════════════════════════════════════════════════════
        startContentHashPolling();
    }

    /**
     * معالج حدث تغيير URL - يُستدعى عند التنقل في SPA
     * @private
     */
    function handleUrlChange() {
        if (location.href !== state.lastUrl) {
            state.lastUrl = location.href;

            // إبقاء الأيقونة مفعلة أثناء تنقل SPA طالما الترجمة لا تزال مفعلة
            if (state.isTranslated) {
                chrome.runtime.sendMessage({ action: 'set_icon_active' });
            }
            
            // إعادة تعيين حالة المعالجة لترجمة المحتوى الجديد
            resetObserverState();
            
            // ترجمة المحتوى الجديد بعد تأخير صغير للسماح بتحميل DOM
            setTimeout(() => {
                const newItems = collector.collectTranslatableItems(document.body);
                if (newItems.length > 0 && currentTargetLang && currentMode) {
                    batch.translateItems(newItems, currentMode, currentTargetLang);
                }
            }, 200); // تأخير 200ms لضمان تحميل المحتوى
        }
    }
    
    /**
     * مراقبة محسّنة لتنقل SPA - نمط متعدد الطبقات
     * يدمج: Polling + popstate + hashchange + رصد أحداث إطارات العمل
     * @param {string} targetLang - اللغة المستهدفة
     * @param {string} mode - وضع الترجمة
     */
    function observeSpaNavigation(targetLang, mode) {
        if (state.spaWatcher) return;
        
        currentTargetLang = targetLang;
        currentMode = mode;
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 1: Event Listeners (رصد فوري)
        // ═══════════════════════════════════════════════════════════════════════════
        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);
        
        // رصد أحداث GitHub Turbo (إن وُجدت)
        document.addEventListener('turbo:load', handleUrlChange);
        document.addEventListener('turbo:render', handleUrlChange);
        
        // رصد أحداث PJAX (استخدمت في GitHub القديم)
        document.addEventListener('pjax:end', handleUrlChange);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // الطبقة 2: Polling خفيف (fallback)
        // ═══════════════════════════════════════════════════════════════════════════
        state.spaWatcher = setInterval(handleUrlChange, 500); // polling كل 500ms
    }

    /**
     * إيقاف جميع المراقبات النشطة وتنظيف الموارد
     */
    function stopAllObservers() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        
        pendingNodes.clear();
        stopCleanupInterval();
        trackedElements.clear();
        
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        if (state.spaWatcher) {
            clearInterval(state.spaWatcher);
            state.spaWatcher = null;
        }
        
        // إيقاف الطبقات الإضافية
        stopIntersectionObserver();
        stopPerformanceObserver();
        stopContentHashPolling();
        
        // إزالة event listeners
        window.removeEventListener('popstate', handleUrlChange);
        window.removeEventListener('hashchange', handleUrlChange);
        document.removeEventListener('turbo:load', handleUrlChange);
        document.removeEventListener('turbo:render', handleUrlChange);
        document.removeEventListener('pjax:end', handleUrlChange);
        
        // إعادة تعيين المعلمات
        currentTargetLang = null;
        currentMode = null;
    }
    
    /**
     * إعادة تهيئة المراقبة (للاستخدام بعد إعادة تعيين الصفحة)
     */
    function resetObserverState() {
        pendingNodes.clear();
        trackedElements.clear();
        processedElements = new WeakSet();
    }

    // الواجهة العامة للوحدة
    return {
        observeNewContent,
        observeSpaNavigation,
        stopAllObservers,
        resetObserverState
    };
})();
