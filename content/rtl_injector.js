/******************************************************************************
 * # الملف: content/rtl_injector.js
 * # الغرض: حقن RTL الموثوق والمستمر بعد تحميل الصفحة
 * # المسؤولية الكاملة: تطبيق RTL عند تفعيله في الإعدادات
 ******************************************************************************/

(function() {
    'use strict';
    
    let isRtlActive = false;
    let isLocalOverride = false; // هل RTL مُفعَّل محلياً (بغض النظر عن الإعدادات)
    let observer = null;
    
    // انتظار اكتمال تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRtl);
    } else {
        initializeRtl();
    }
    
    /**
     * تهيئة RTL بعد تحميل الصفحة
     */
    function initializeRtl() {
        // التحقق من إعدادات RTL وتطبيقها
        chrome.storage.local.get({ globalRtlEnabled: false, rtlExcludedSites: [] }, (result) => {
            if (result.globalRtlEnabled && !isCurrentSiteExcluded(result.rtlExcludedSites)) {
                // التحقق من دعم الموقع لـ RTL قبل التطبيق
                if (!isSiteRtlEnabled()) {
                    applyRtlStyles();
                }
            }
        });
    }

    /**
     * التحقق من استثناء الموقع الحالي
     */
    function isCurrentSiteExcluded(excludedSites) {
        try {
            const currentHostname = window.location.hostname.replace(/^www\./, '');
            return excludedSites.some(site => 
                currentHostname === site || currentHostname.endsWith('.' + site)
            );
        } catch (e) {
            return false;
        }
    }

    /**
     * التحقق من دعم الموقع لـ RTL أصلاً
     */
    function isSiteRtlEnabled() {
        try {
            // التحقق من اتجاه HTML
            const htmlDir = document.documentElement.getAttribute('dir');
            if (htmlDir === 'rtl') {
                return true;
            }
            
            // التحقق من اتجاه Body
            const bodyDir = document.body?.getAttribute('dir');
            if (bodyDir === 'rtl') {
                return true;
            }
            
            // التحقق من خصائص CSS للـ HTML
            const htmlStyle = getComputedStyle(document.documentElement);
            if (htmlStyle.direction === 'rtl') {
                return true;
            }
            
            // التحقق من خصائص CSS للـ Body
            if (document.body) {
                const bodyStyle = getComputedStyle(document.body);
                if (bodyStyle.direction === 'rtl') {
                    return true;
                }
            }
            
            // التحقق من lang attribute العربية
            const lang = document.documentElement.getAttribute('lang');
            if (lang && (lang.startsWith('ar') || lang.startsWith('he') || lang.startsWith('fa') || lang.startsWith('ur'))) {
                return true;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * تطبيق أنماط RTL الشاملة
     */
    function applyRtlStyles() {
        if (isRtlActive) return; // تجنب التطبيق المتكرر
        
        isRtlActive = true;
        
        // تطبيق RTL على العناصر الأساسية
        applyRtlToElements();
        
        // حقن الأنماط القوية
        injectRtlStyles();
        
        // مراقبة العناصر الجديدة
        observeNewElements();
    }

    /**
     * تطبيق RTL على العناصر الأساسية
     */
    function applyRtlToElements() {
        // تطبيق على html
        document.documentElement.setAttribute('dir', 'rtl');
        
        // تطبيق على body
        if (document.body) {
            document.body.classList.add('moterjem-alzanad-rtl-active');
            document.body.style.setProperty('direction', 'rtl', 'important');
        }
        
        // تطبيق على العناصر الموجودة مع الحفاظ على العناصر المتوسطة
        const elements = document.querySelectorAll('*');
        elements.forEach(element => {
            if (shouldApplyRtl(element)) {
                element.style.setProperty('direction', 'rtl', 'important');
                
                // الحفاظ على العناصر المتوسطة
                if (!isCenteredElement(element)) {
                    element.style.setProperty('text-align', 'right', 'important');
                }
            }
        });
    }
    
    /**
     * التحقق مما إذا كان العنصر متوسطاً (centered)
     */
    function isCenteredElement(element) {
        // فحص style مباشر
        const inlineStyle = element.getAttribute('style') || '';
        if (inlineStyle.includes('text-align') && inlineStyle.includes('center')) {
            return true;
        }
        
        // فحص الـ classes
        const classList = element.classList;
        const centerClasses = ['text-center', 'center', 'mx-auto', 'text-md-center', 'text-lg-center', 'd-flex', 'justify-content-center', 'items-center', 'justify-center'];
        for (const cls of centerClasses) {
            if (classList.contains(cls)) {
                return true;
            }
        }
        
        // فحص computed style
        try {
            const computedStyle = getComputedStyle(element);
            if (computedStyle.textAlign === 'center') {
                return true;
            }
            // فحص flexbox centering
            if (computedStyle.display === 'flex' && 
                (computedStyle.justifyContent === 'center' || computedStyle.alignItems === 'center')) {
                return true;
            }
        } catch (e) {}
        
        return false;
    }

    /**
     * حقن أنماط RTL القوية
     */
    function injectRtlStyles() {
        const styleId = 'moterjem-alzanad-rtl-styles';
        
        // إزالة الأنماط القديمة
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* أنماط RTL الشاملة والقوية */
            html[dir="rtl"] {
                direction: rtl !important;
            }
            
            body.moterjem-alzanad-rtl-active {
                direction: rtl !important;
            }
            
            /* تطبيق RTL على العناصر مع استثناء المتوسطة */
            body.moterjem-alzanad-rtl-active *:not(input[type="password"]):not(input[type="email"]):not(input[type="url"]):not(code):not(pre):not(script):not(style) {
                direction: rtl !important;
            }
            
            /* ===== الحفاظ على العناصر المتوسطة ===== */
            body.moterjem-alzanad-rtl-active .text-center,
            body.moterjem-alzanad-rtl-active .center,
            body.moterjem-alzanad-rtl-active .mx-auto,
            body.moterjem-alzanad-rtl-active .text-md-center,
            body.moterjem-alzanad-rtl-active .text-lg-center,
            body.moterjem-alzanad-rtl-active .text-xl-center,
            body.moterjem-alzanad-rtl-active .text-sm-center,
            body.moterjem-alzanad-rtl-active [style*="text-align: center"],
            body.moterjem-alzanad-rtl-active [style*="text-align:center"],
            body.moterjem-alzanad-rtl-active [class*="justify-center"],
            body.moterjem-alzanad-rtl-active [class*="items-center"],
            body.moterjem-alzanad-rtl-active [class*="justify-content-center"],
            body.moterjem-alzanad-rtl-active [class*="align-items-center"] {
                text-align: center !important;
            }
            
            /* تجاوز الأنماط المضادة الشائعة - فقط للعناصر غير المتوسطة */
            body.moterjem-alzanad-rtl-active [style*="text-align: left"]:not(.text-center):not([style*="center"]) {
                text-align: right !important;
            }
            
            body.moterjem-alzanad-rtl-active [style*="text-align:left"]:not(.text-center):not([style*="center"]) {
                text-align: right !important;
            }
            
            body.moterjem-alzanad-rtl-active [style*="text-align: start"]:not(.text-center):not([style*="center"]) {
                text-align: right !important;
            }
            
            body.moterjem-alzanad-rtl-active [dir="ltr"] {
                direction: rtl !important;
            }
            
            body.moterjem-alzanad-rtl-active [style*="direction: ltr"] {
                direction: rtl !important;
            }
            
            body.moterjem-alzanad-rtl-active [style*="direction:ltr"] {
                direction: rtl !important;
            }
            
            /* تخصيص الحقول النصية */
            body.moterjem-alzanad-rtl-active input[type="text"],
            body.moterjem-alzanad-rtl-active input[type="search"],
            body.moterjem-alzanad-rtl-active textarea {
                direction: rtl !important;
                text-align: right !important;
            }
            
            /* تجاوز فئات Bootstrap وFrameworks الشائعة */
            body.moterjem-alzanad-rtl-active .text-left,
            body.moterjem-alzanad-rtl-active .text-start,
            body.moterjem-alzanad-rtl-active .text-begin {
                text-align: right !important;
            }
            
            body.moterjem-alzanad-rtl-active .ltr {
                direction: rtl !important;
            }
        `;

        // إدراج الأنماط في أعلى الرأس
        document.head.insertBefore(style, document.head.firstChild);
    }

    /**
     * مراقبة العناصر الجديدة المضافة
     */
    function observeNewElements() {
        if (observer) {
            observer.disconnect();
        }
        
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            applyRtlToNewElement(node);
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * تطبيق RTL على عنصر جديد
     */
    function applyRtlToNewElement(element) {
        if (shouldApplyRtl(element)) {
            element.style.setProperty('direction', 'rtl', 'important');
            element.style.setProperty('text-align', 'right', 'important');
        }
        
        // تطبيق على العناصر الفرعية
        const children = element.querySelectorAll('*');
        children.forEach(child => {
            if (shouldApplyRtl(child)) {
                child.style.setProperty('direction', 'rtl', 'important');
                child.style.setProperty('text-align', 'right', 'important');
            }
        });
    }

    /**
     * تحديد ما إذا كان يجب تطبيق RTL على العنصر
     */
    function shouldApplyRtl(element) {
        // استثناء العناصر التي لا يجب تطبيق RTL عليها
        const excludedTags = ['script', 'style', 'code', 'pre', 'kbd', 'samp', 'var'];
        const excludedTypes = ['password', 'email', 'url', 'number', 'tel'];
        
        if (excludedTags.includes(element.tagName.toLowerCase())) {
            return false;
        }
        
        if (element.tagName === 'INPUT' && excludedTypes.includes(element.type)) {
            return false;
        }
        
        return true;
    }

    /**
     * إزالة أنماط RTL
     */
    function removeRtlStyles() {
        if (!isRtlActive) return;
        
        isRtlActive = false;
        
        // إزالة الأنماط
        const style = document.getElementById('moterjem-alzanad-rtl-styles');
        if (style) {
            style.remove();
        }
        
        // إزالة الخصائص من العناصر
        document.documentElement.removeAttribute('dir');
        
        if (document.body) {
            document.body.classList.remove('moterjem-alzanad-rtl-active');
            document.body.style.removeProperty('direction');
            document.body.style.removeProperty('text-align');
        }
        
        // إزالة من جميع العناصر
        const elements = document.querySelectorAll('*');
        elements.forEach(element => {
            element.style.removeProperty('direction');
            element.style.removeProperty('text-align');
        });
        
        // إيقاف المراقبة
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    // مراقبة تغيرات إعدادات RTL
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.globalRtlEnabled || changes.rtlExcludedSites) {
            chrome.storage.local.get({ globalRtlEnabled: false, rtlExcludedSites: [] }, (result) => {
                // عند تفعيل RTL العالمي، أعد تعيين التجاوز المحلي
                if (result.globalRtlEnabled) {
                    isLocalOverride = false;
                    if (!isCurrentSiteExcluded(result.rtlExcludedSites)) {
                        if (!isSiteRtlEnabled()) {
                            applyRtlStyles();
                        }
                    } else {
                        removeRtlStyles();
                    }
                } else if (!isLocalOverride) {
                    removeRtlStyles();
                }
            });
        }
    });
    
    // الاستماع لحدث تبديل RTL من لوحة المفاتيح
    document.addEventListener('tarjoman-toggle-rtl', () => {
        isLocalOverride = true;
        if (isRtlActive) {
            removeRtlStyles();
        } else {
            applyRtlStyles();
        }
    });

    // الاستماع لرسائل التحكم
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateRtlStatus') {
            // عند تفعيل RTL العالمي، أعد تعيين التجاوز المحلي وطبّق على الجميع
            if (message.enabled) {
                isLocalOverride = false; // إعادة تعيين التجاوز المحلي
                if (!isCurrentSiteExcluded(message.excludedSites || [])) {
                    if (!isSiteRtlEnabled()) {
                        applyRtlStyles();
                    }
                } else {
                    removeRtlStyles();
                }
            } else {
                // عند إلغاء RTL العالمي، أزل RTL إلا إذا كان هناك تجاوز محلي
                if (!isLocalOverride) {
                    removeRtlStyles();
                }
            }
            sendResponse({ success: true });
        } else if (message.action === 'toggleRtlDirect') {
            // تبديل RTL مباشرة من الواجهة (محلي - لا يؤثر على الإعدادات)
            isLocalOverride = true;
            if (message.enabled) {
                if (!isSiteRtlEnabled() || !isRtlActive) {
                    applyRtlStyles();
                }
            } else {
                removeRtlStyles();
            }
            sendResponse({ success: true, isRtlActive: isRtlActive });
        } else if (message.action === 'toggleLocalRtl') {
            // تبديل RTL محلياً من اختصار لوحة المفاتيح
            isLocalOverride = true;
            if (message.enabled) {
                applyRtlStyles();
            } else {
                removeRtlStyles();
            }
            sendResponse({ success: true, isRtlActive: isRtlActive });
        } else if (message.action === 'getLocalRtlState') {
            // إرجاع حالة RTL الحالية
            sendResponse({ isRtlActive: isRtlActive, isLocalOverride: isLocalOverride });
        }
    });
})();
