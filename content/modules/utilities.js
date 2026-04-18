/******************************************************************************
 * # الملف: content/modules/utilities.js
 * # الغرض: دوال مساعدة مشتركة تستخدمها الوحدات المختلفة
 * # الاعتماديات: constants.js
 ******************************************************************************/

/**
 * وحدة الأدوات المساعدة - دوال عامة مشتركة
 * @namespace TarjomanUtils
 */
window.TarjomanUtils = (function() {
    const constants = window.TarjomanConstants;

    /**
     * إفلات الأحرف الخاصة في regex
     * @param {string} string - النص المراد إفلاته
     * @returns {string} - النص المُفلَت
     */
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * تنظيف النص من المسافات الزائدة
     * @param {string} text - النص المراد تنظيفه
     * @returns {string} - النص المنظف
     */
    function cleanText(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * دالة throttle للتحكم في معدل تشغيل الوظائف
     * @param {Function} func - الدالة المراد تقييدها
     * @param {number} limit - الحد الأقصى للتشغيل بالمللي ثانية
     * @returns {Function} - الدالة المُقيَّدة
     */
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * الحصول على جميع العقد النصية في عنصر
     * @param {Element} element - العنصر المراد البحث فيه
     * @returns {Array} - مصفوفة العقد النصية
     */
    function getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) {
                textNodes.push(node);
            }
        }
        
        return textNodes;
    }

    /**
     * التحقق من السياق الآمن
     * @returns {boolean} - true إذا كان السياق آمناً
     */
    function isSecureContext() {
        return window.isSecureContext || 
               location.protocol === 'https:' || 
               location.hostname === 'localhost';
    }

    /**
     * كشف الوضع المظلم
     * @returns {boolean} - true إذا كان الوضع المظلم مُفعَّلاً
     */
    function detectDarkMode() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * استبدال النص في حاوية مع الحفاظ على التنسيق
     * @param {Node} container - الحاوية المراد البحث فيها
     * @param {string} originalText - النص الأصلي
     * @param {string} translatedText - النص المُتَرجَم
     * @returns {boolean} - true إذا تم الاستبدال بنجاح
     */
    function replaceTextInContainerWithFormatting(container, originalText, translatedText) {
        if (container.nodeType === Node.ELEMENT_NODE) {
            const innerHTML = container.innerHTML;
            const textContent = container.textContent.replace(/\s+/g, ' ').trim();
            
            if (textContent.includes(originalText)) {
                const escapedOriginal = escapeRegExp(originalText);
                const newHTML = innerHTML.replace(
                    new RegExp(escapedOriginal, 'gi'), 
                    translatedText
                );
                
                if (newHTML !== innerHTML) {
                    container.innerHTML = newHTML;
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * استبدال النص في الصفحة كاملة مع الحفاظ على التنسيق
     * @param {string} originalText - النص الأصلي
     * @param {string} translatedText - النص المُتَرجَم
     * @returns {boolean} - true إذا تم الاستبدال بنجاح
     */
    function replaceTextInPageWithFormatting(originalText, translatedText) {
        const allElements = document.body.querySelectorAll(
            '*:not(script):not(style):not(code):not(pre)'
        );
        
        for (let element of allElements) {
            // تجاهل العناصر المحظورة والنافذة المنبثقة
            if (element.closest(constants.EXCLUDED_TAG_SELECTOR) || 
                element.closest('#' + constants.POPUP_ID)) {
                continue;
            }
            
            const textContent = element.textContent.replace(/\s+/g, ' ').trim();
            
            if (textContent.includes(originalText) && element.children.length === 0) {
                const innerHTML = element.innerHTML;
                const escapedOriginal = escapeRegExp(originalText);
                const newHTML = innerHTML.replace(
                    new RegExp(escapedOriginal, 'gi'), 
                    translatedText
                );
                
                if (newHTML !== innerHTML) {
                    element.innerHTML = newHTML;
                    return true;
                }
            } else if (textContent.includes(originalText) && element.children.length > 0) {
                if (_replaceInComplexElement(element, originalText, translatedText)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * استبدال النص في عنصر معقد يحتوي على عناصر فرعية
     * @private
     */
    function _replaceInComplexElement(element, originalText, translatedText) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement?.closest(constants.EXCLUDED_TAG_SELECTOR) || 
                        node.parentElement?.closest('#' + constants.POPUP_ID)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
            const nodeText = textNode.textContent.replace(/\s+/g, ' ').trim();
            if (nodeText.includes(originalText)) {
                const parentElement = textNode.parentElement;
                if (parentElement) {
                    const innerHTML = parentElement.innerHTML;
                    const escapedOriginal = escapeRegExp(originalText);
                    const newHTML = innerHTML.replace(
                        new RegExp(escapedOriginal, 'gi'), 
                        translatedText
                    );
                    
                    if (newHTML !== innerHTML) {
                        parentElement.innerHTML = newHTML;
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * استبدال النص في الصفحة (الطريقة البسيطة)
     * @param {string} originalText - النص الأصلي
     * @param {string} translatedText - النص المُتَرجَم
     * @returns {boolean} - true إذا تم الاستبدال بنجاح
     */
    function replaceTextInPage(originalText, translatedText) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement?.closest(constants.EXCLUDED_TAG_SELECTOR)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (node.parentElement?.closest('#' + constants.POPUP_ID)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            const cleanContent = node.textContent.replace(/\s+/g, ' ').trim();
            if (cleanContent.includes(originalText)) {
                node.textContent = node.textContent.replace(
                    new RegExp(escapeRegExp(originalText), 'gi'), 
                    translatedText
                );
                return true;
            }
        }
        
        return false;
    }

    // الواجهة العامة للوحدة
    return {
        escapeRegExp,
        cleanText,
        throttle,
        getTextNodes,
        isSecureContext,
        detectDarkMode,
        replaceTextInContainerWithFormatting,
        replaceTextInPageWithFormatting,
        replaceTextInPage
    };
})();
