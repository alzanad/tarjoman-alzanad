/******************************************************************************
 * # الملف: content/modules/translation_applier.js
 * # الغرض: تطبيق الترجمات على النصوص والسمات في صفحة الويب
 * # الاعتماديات: constants.js, database.js
 ******************************************************************************/

/**
 * وحدة تطبيق الترجمة - تدعم أوضاع العرض المتعددة
 * @namespace TarjomanApplier
 */
window.TarjomanApplier = (function() {
    const state = window.TarjomanState;
    
    /** 
     * أوضاع العرض المدعومة
     * @enum {string}
     */
    const DISPLAY_MODES = {
        REPLACE: 'replace',     // استبدال النص الأصلي
        DUAL: 'dual',           // ثنائي اللغة (الأصلي + الترجمة)
        TRANSLATION: 'translation' // الترجمة فقط مع إمكانية إظهار الأصلي
    };
    
    /**
     * @enum {string}
     */
    const THEMES = {
        NONE: 'none',
        UNDERLINE: 'underline',
        DASHED: 'dashed',
        DOTTED: 'dotted',
        WAVY: 'wavy',
        HIGHLIGHT: 'highlight',
        MARKER: 'marker',
        GREY: 'grey'
    };
    
    /** النمط الحالي المُستخدم */
    let currentTheme = THEMES.NONE;

    /**
     * تطبيق الترجمة على النصوص والسمات المختلفة
     * @param {Map} translatedMap - خريطة تحتوي على النصوص المُتَرجَمة
     * @param {string} mode - وضع الترجمة
     */
    function applyTranslations(translatedMap, mode) {
        translatedMap.forEach((translatedText, id) => {
            const item = state.originalItems.get(id);
            if (!item || !translatedText || translatedText.trim() === item.original.trim()) {
                return;
            }

            const { node, type } = item;

            switch (mode) {
                case DISPLAY_MODES.REPLACE:
                    _applyReplaceMode(node, type, translatedText);
                    break;
                case DISPLAY_MODES.DUAL:
                    _applyDualMode(node, type, translatedText, item.original);
                    break;
                case DISPLAY_MODES.TRANSLATION:
                    _applyTranslationOnlyMode(node, type, translatedText, item.original);
                    break;
                default:
                    // الوضع الافتراضي: append (للتوافق الخلفي)
                    _applyDualMode(node, type, translatedText, item.original);
            }
        });
    }

    /**
     * تطبيق وضع الاستبدال - استبدال النص الأصلي بالمُتَرجَم
     * @private
     */
    function _applyReplaceMode(node, type, translatedText) {
        switch (type) {
            case 'text': 
                node.nodeValue = translatedText; 
                break;
            case 'placeholder': 
                node.setAttribute('placeholder', translatedText); 
                break;
            case 'alt': 
                node.setAttribute('alt', translatedText); 
                break;
        }
    }

    /**
     * تطبيق الوضع الثنائي - عرض النص الأصلي والترجمة معاً
     * @private
     */
    function _applyDualMode(node, type, translatedText, originalText) {
        if (type !== 'text' || !node.parentElement) {
            // للسمات، نستخدم وضع الاستبدال مع حفظ الأصلي كـ tooltip
            if (type === 'placeholder') {
                node.setAttribute('title', originalText);
                node.setAttribute('placeholder', translatedText);
            } else if (type === 'alt') {
                node.setAttribute('title', originalText);
                node.setAttribute('alt', translatedText);
            }
            return;
        }
        
        // تجنب الإضافة المكررة - فحص العقدة التالية
        const nextSibling = node.nextSibling;
        if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && 
            nextSibling.hasAttribute('data-tarjoman-translation')) {
            return;
        }
        
        // إنشاء غلاف الترجمة فقط (النص الأصلي يبقى كما هو)
        const wrapper = document.createElement('span');
        wrapper.className = 'tarjoman-target-wrapper';
        wrapper.setAttribute('data-tarjoman-translation', 'true');
        wrapper.setAttribute('translate', 'no');
        
        // تحديد اتجاه النص بناءً على اللغة
        const isRTL = _isRTLText(translatedText);
        wrapper.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        
        // فاصل بصري
        const separator = document.createElement('span');
        separator.className = 'tarjoman-separator';
        separator.textContent = ' ';
        
        // العنصر الداخلي للترجمة
        const inner = document.createElement('span');
        inner.className = _getThemeClasses();
        inner.textContent = translatedText;
        
        wrapper.appendChild(separator);
        wrapper.appendChild(inner);
        
        // إدراج غلاف الترجمة مباشرة بعد العقدة النصية الأصلية
        if (node.nextSibling) {
            node.parentElement.insertBefore(wrapper, node.nextSibling);
        } else {
            node.parentElement.appendChild(wrapper);
        }
    }

    /**
     * تطبيق وضع الترجمة فقط - استبدال النص الأصلي بالترجمة
     * @private
     */
    function _applyTranslationOnlyMode(node, type, translatedText, originalText) {
        if (type !== 'text' || !node.parentElement) {
            _applyReplaceMode(node, type, translatedText);
            return;
        }
        
        // تجنب الإضافة المكررة
        const nextSibling = node.nextSibling;
        if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && 
            nextSibling.hasAttribute('data-tarjoman-translation')) {
            return;
        }
        
        // إخفاء النص الأصلي (تفريغه)
        node.nodeValue = '';
        
        // إنشاء غلاف الترجمة
        const wrapper = document.createElement('span');
        wrapper.className = 'tarjoman-target-wrapper tarjoman-translation-only';
        wrapper.setAttribute('data-tarjoman-translation', 'true');
        wrapper.setAttribute('data-original-text', originalText); // حفظ الأصلي للاستعادة
        wrapper.setAttribute('translate', 'no');
        
        const isRTL = _isRTLText(translatedText);
        wrapper.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        
        const inner = document.createElement('span');
        inner.className = _getThemeClasses();
        inner.textContent = translatedText;
        
        wrapper.appendChild(inner);
        
        // إدراج بعد العقدة النصية (الفارغة الآن)
        if (node.nextSibling) {
            node.parentElement.insertBefore(wrapper, node.nextSibling);
        } else {
            node.parentElement.appendChild(wrapper);
        }
    }

    /**
     * الحصول على فئات CSS للنمط الحالي
     * @private
     * @returns {string}
     */
    function _getThemeClasses() {
        const baseClass = 'tarjoman-translation-inner';
        
        if (currentTheme === THEMES.NONE) {
            return baseClass;
        }
        
        return `${baseClass} tarjoman-theme-${currentTheme}`;
    }

    /**
     * التحقق من كون النص RTL
     * @private
     * @param {string} text - النص للفحص
     * @returns {boolean}
     */
    function _isRTLText(text) {
        if (!text) return false;
        // فحص الحرف الأول غير الفراغي
        const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        return rtlRegex.test(text.trim().charAt(0));
    }

    /**
     * تغيير النمط البصري للترجمات
     * @param {string} theme - النمط المطلوب
     */
    function setTheme(theme) {
        if (Object.values(THEMES).includes(theme)) {
            currentTheme = theme;
            
            // تحديث العناصر الموجودة
            document.querySelectorAll('.tarjoman-translation-inner').forEach(el => {
                // إزالة الأنماط القديمة
                Object.values(THEMES).forEach(t => {
                    el.classList.remove(`tarjoman-theme-${t}`);
                });
                // إضافة النمط الجديد
                if (theme !== THEMES.NONE) {
                    el.classList.add(`tarjoman-theme-${theme}`);
                }
            });
        }
    }

    /**
     * تبديل عرض النص الأصلي في وضع الترجمة فقط
     */
    function toggleOriginalText() {
        document.querySelectorAll('.tarjoman-source-wrapper').forEach(el => {
            el.classList.toggle('tarjoman-hidden');
        });
    }

    /**
     * إزالة جميع عناصر الترجمة المُضافة
     * النصوص الأصلية محفوظة في state.originalItems ويتم استعادتها من main_translator
     */
    function removeAllTranslationElements() {
        // إزالة جميع أغلفة الترجمة المُضافة
        document.querySelectorAll('[data-tarjoman-translation]').forEach(el => el.remove());
        
        // إزالة الحاويات القديمة (للتوافق الخلفي)
        document.querySelectorAll('[data-tarjoman-container]').forEach(container => {
            const sourceEl = container.querySelector('.tarjoman-source-wrapper, .tarjoman-source-text');
            if (sourceEl) {
                const textNode = document.createTextNode(sourceEl.textContent);
                if (container.parentElement) {
                    container.parentElement.replaceChild(textNode, container);
                }
            } else {
                container.remove();
            }
        });
        
        // إظهار النصوص الأصلية المخفية المتبقية
        document.querySelectorAll('.tarjoman-source-wrapper').forEach(el => {
            const text = el.textContent;
            const textNode = document.createTextNode(text);
            if (el.parentElement) {
                el.parentElement.insertBefore(textNode, el);
                el.remove();
            }
        });
    }

    // الواجهة العامة للوحدة
    return {
        applyTranslations,
        setTheme,
        toggleOriginalText,
        removeAllTranslationElements,
        DISPLAY_MODES,
        THEMES
    };
})();
