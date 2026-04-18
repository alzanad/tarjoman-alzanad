/******************************************************************************
 * # الملف: content/modules/text_collector.js
 * # الغرض: جمع النصوص والعناصر القابلة للترجمة من صفحة الويب
 * # الاعتماديات: constants.js
 ******************************************************************************/

/**
 * وحدة جمع النصوص - تستخدم TreeWalker لاجتياز DOM بكفاءة
 * @namespace TarjomanCollector
 */
window.TarjomanCollector = (function() {
    const state = window.TarjomanState;
    const constants = window.TarjomanConstants;

    /**
     * نطاقات Unicode للغات المدعومة لكشف لغة النص
     * @private
     */
    const LANGUAGE_RANGES = {
        ar: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
        fa: /[\u0600-\u06FF\u0750-\u077F]/g, // الفارسية تشترك مع العربية
        he: /[\u0590-\u05FF]/g,
        zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
        ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g,
        ko: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
        ru: /[\u0400-\u04FF]/g,
        th: /[\u0E00-\u0E7F]/g,
        hi: /[\u0900-\u097F]/g,
        latin: /[A-Za-z\u00C0-\u024F]/g
    };

    /**
     * أنماط النصوص التي يجب استثناؤها من الترجمة
     * @private
     */
    const SKIP_PATTERNS = [
        /^https?:\/\//i,                    // روابط URL
        /^www\./i,                          // روابط بدون بروتوكول
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // بريد إلكتروني
        /^[#@][\w-]+$/,                     // هاشتاغ أو منشن
        /^\d+([.,]\d+)*$/,                  // أرقام فقط
        /^[\s\d\p{P}\p{S}]+$/u              // رموز وأرقام فقط
    ];

    /**
     * كشف اللغة السائدة في النص باستخدام تحليل Unicode
     * @private
     * @param {string} text - النص للفحص
     * @returns {string|null} رمز اللغة أو null إذا لم يُكتشف
     */
    function _detectTextLanguage(text) {
        if (!text || text.length < 2) return null;
        
        // تنظيف النص من الأرقام والرموز للتحليل
        const cleanText = text.replace(/[\d\s\p{P}\p{S}]/gu, '');
        if (cleanText.length < 2) return null;
        
        let maxCount = 0;
        let detectedLang = null;
        
        for (const [lang, regex] of Object.entries(LANGUAGE_RANGES)) {
            const matches = cleanText.match(regex);
            const count = matches ? matches.length : 0;
            
            if (count > maxCount) {
                maxCount = count;
                detectedLang = lang;
            }
        }
        
        // يجب أن تكون النسبة >= 50% من الحروف
        const threshold = cleanText.length * 0.5;
        return maxCount >= threshold ? detectedLang : null;
    }

    /**
     * التحقق مما إذا كان النص يجب تخطيه (URLs, أرقام، إلخ)
     * @private
     * @param {string} text - النص للفحص
     * @returns {boolean}
     */
    function _shouldSkipText(text) {
        if (!text) return true;
        const trimmed = text.trim();
        return SKIP_PATTERNS.some(pattern => pattern.test(trimmed));
    }

    /**
     * جمع شامل للنصوص والعناصر القابلة للترجمة من الصفحة
     * تستخدم TreeWalker لاجتياز DOM بكفاءة وتجميع النصوص المرئية
     * @param {Node} rootNode - العقدة الجذرية للبحث (عادة document.body)
     * @returns {Array} مصفوفة من العناصر القابلة للترجمة
     */
    function collectTranslatableItems(rootNode) {
        const items = [];
        const walker = document.createTreeWalker(
            rootNode, 
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, 
            {
                acceptNode: (node) => {
                    // تجاهل العناصر المحظورة (script, style, code, إلخ)
                    if (node.parentElement?.closest(constants.EXCLUDED_TAG_SELECTOR) || 
                        node.closest?.(constants.EXCLUDED_TAG_SELECTOR)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // تجاهل العناصر المحددة بخاصية translate="no"
                    if (node.parentElement?.closest('[translate="no"]') || 
                        node.closest?.('[translate="no"]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // تجاهل العناصر المخفية
                    if (window.getComputedStyle(node.parentElement ?? node).display === 'none') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        while (walker.nextNode()) {
            const node = walker.currentNode;
            
            if (node.nodeType === Node.TEXT_NODE) {
                _processTextNode(node, items);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                _processElementNode(node, items);
            }
        }
        
        return items;
    }

    /**
     * معالجة عقدة نصية وإضافتها للمجموعة إذا كانت قابلة للترجمة
     * @private
     * @param {Node} node - العقدة النصية
     * @param {Array} items - مصفوفة العناصر المجمعة
     */
    function _processTextNode(node, items) {
        const text = node.nodeValue?.trim();
        
        // التحقق الأساسي من صلاحية النص
        if (!text || text.length < 2) return;
        
        // تخطي URLs والأنماط الخاصة
        if (_shouldSkipText(text)) return;
        
        // تخطي النصوص المعالجة سابقاً
        if ([...state.originalItems.values()].some(i => i.node === node)) return;
        
        // كشف لغة النص
        const detectedLang = _detectTextLanguage(text);
        
        const id = `item-${state.itemCounter++}`;
        state.originalItems.set(id, { 
            node, 
            type: 'text', 
            original: node.nodeValue,
            detectedLang // حفظ اللغة المكتشفة للاستخدام لاحقاً
        });
        items.push({ id, text, detectedLang });
    }

    /**
     * معالجة عنصر HTML واستخراج السمات القابلة للترجمة
     * @private
     * @param {Element} node - عنصر HTML
     * @param {Array} items - مصفوفة العناصر المجمعة
     */
    function _processElementNode(node, items) {
        // جمع نصوص placeholder
        if (node.hasAttribute('placeholder')) {
            const text = node.getAttribute('placeholder').trim();
            if (text && !_shouldSkipText(text) && ![...state.originalItems.values()].some(
                i => i.node === node && i.type === 'placeholder'
            )) {
                const detectedLang = _detectTextLanguage(text);
                const id = `item-${state.itemCounter++}`;
                state.originalItems.set(id, { 
                    node, 
                    type: 'placeholder', 
                    original: text,
                    detectedLang
                });
                items.push({ id, text, detectedLang });
            }
        }
        
        // جمع نصوص alt للصور
        if (node.hasAttribute('alt')) {
            const text = node.getAttribute('alt').trim();
            if (text && !_shouldSkipText(text) && ![...state.originalItems.values()].some(
                i => i.node === node && i.type === 'alt'
            )) {
                const detectedLang = _detectTextLanguage(text);
                const id = `item-${state.itemCounter++}`;
                state.originalItems.set(id, { 
                    node, 
                    type: 'alt', 
                    original: text,
                    detectedLang
                });
                items.push({ id, text, detectedLang });
            }
        }
    }

    // الواجهة العامة للوحدة
    return {
        collectTranslatableItems,
        detectTextLanguage: _detectTextLanguage,
        shouldSkipText: _shouldSkipText
    };
})();
