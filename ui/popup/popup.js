/******************************************************************************
 * # الملف: ui/popup/popup.js
 * # الغرض: منطق الواجهة المنبثقة.
 ******************************************************************************/
document.addEventListener('DOMContentLoaded', () => {
    const translateBtn = document.getElementById('translate-btn');
    const sourceLangSelect = document.getElementById('source-lang');
    const targetLangSelect = document.getElementById('target-lang');
    const rtlToggle = document.getElementById('rtl-toggle');
    const settingsBtn = document.getElementById('settings-btn');
    const autoTranslateToggle = document.getElementById('auto-translate-toggle');
    const autoTranslateControl = document.querySelector('.auto-translate-control');
    const excludeSiteToggle = document.getElementById('exclude-site-toggle');
    const excludeSiteControl = document.querySelector('.exclude-site-control');
    let currentTab;

    populateLanguageDropdown(sourceLangSelect, true);
    populateLanguageDropdown(targetLangSelect, false);

    function saveSettings() {
        chrome.storage.local.set({ sourceLang: sourceLangSelect.value, targetLang: targetLangSelect.value });
    }

    /**
     * استعادة حالة الواجهة بناءً على حالة التبويب الحالي
     */
    function restoreUI(tab) {
        // استعادة إعدادات اللغة
        chrome.storage.local.get({ sourceLang: 'auto', favoriteTargetLang: 'ar' }, (items) => {
            sourceLangSelect.value = items.sourceLang;
            chrome.storage.local.get([`session_lang_${tab.id}`], (sessionResult) => {
                targetLangSelect.value = sessionResult[`session_lang_${tab.id}`] || items.favoriteTargetLang;
            });
        });

        // التحقق من حالة الترجمة الفعلية من الصفحة
        chrome.tabs.sendMessage(tab.id, { action: 'getTranslationStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                // fallback إلى التخزين المحلي
                chrome.storage.local.get([`translated_status_${tab.id}`], (result) => {
                    updateTranslateButton(result[`translated_status_${tab.id}`]);
                    // تحديث الأيقونة للتزامن مع الحالة
                    if (result[`translated_status_${tab.id}`]) {
                        chrome.runtime.sendMessage({ action: 'set_icon_active', tabId: tab.id });
                    }
                });
            } else {
                const isTranslated = response && response.isTranslated;
                const isProcessing = response && response.isProcessing;
                updateTranslateButton(isTranslated, isProcessing);
                // مزامنة الحالة مع التخزين
                chrome.storage.local.set({ [`translated_status_${tab.id}`]: isTranslated });
                // تحديث الأيقونة للتزامن مع الحالة الفعلية
                if (isTranslated) {
                    chrome.runtime.sendMessage({ action: 'set_icon_active', tabId: tab.id });
                } else if (!isProcessing) {
                    chrome.runtime.sendMessage({ action: 'set_icon_default', tabId: tab.id });
                }
            }
        });
        
        // تحديث حالة RTL - جلب الحالة المحلية أولاً
        if (tab.url && tab.url.startsWith('http')) {
            // جلب حالة RTL المحلية من الصفحة
            chrome.tabs.sendMessage(tab.id, { action: 'getLocalRtlState' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // fallback للإعدادات العامة
                    const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
                    chrome.storage.local.get({ globalRtlEnabled: false, rtlExcludedSites: [] }, (globalSettings) => {
                        const isExcluded = globalSettings.rtlExcludedSites.includes(hostname);
                        rtlToggle.checked = globalSettings.globalRtlEnabled && !isExcluded;
                    });
                } else {
                    // استخدام الحالة المحلية
                    rtlToggle.checked = response.isRtlActive;
                }
            });
        } else {
            chrome.storage.local.get({ globalRtlEnabled: false }, (globalSettings) => {
                rtlToggle.checked = globalSettings.globalRtlEnabled;
            });
        }

        // تحديث واجهة أزرار الترجمة حسب إعدادات الترجمة الشاملة
        updateTranslateControlsUI(tab);
    }

    /**
     * تحديث واجهة أزرار الترجمة - التبديل بين الترجمة التلقائية والاستثناء
     */
    function updateTranslateControlsUI(tab) {
        if (!tab.url || !tab.url.startsWith('http')) {
            autoTranslateControl.style.display = 'none';
            excludeSiteControl.style.display = 'none';
            return;
        }
        
        const currentHostname = new URL(tab.url).hostname.replace(/^www\./, '');
        
        chrome.storage.local.get({ 
            globalTranslateEnabled: false, 
            autoTranslateSites: [],
            translateExcludedSites: []
        }, (settings) => {
            if (settings.globalTranslateEnabled) {
                // الترجمة الشاملة مفعلة: إظهار زر الاستثناء فقط
                autoTranslateControl.style.display = 'none';
                excludeSiteControl.style.display = 'flex';
                
                // التحقق من حالة الاستثناء
                const isExcluded = settings.translateExcludedSites.some(site => 
                    currentHostname === site || currentHostname.endsWith('.' + site)
                );
                excludeSiteToggle.checked = isExcluded;
            } else {
                // الترجمة الشاملة غير مفعلة: إظهار زر الترجمة التلقائية فقط
                autoTranslateControl.style.display = 'flex';
                excludeSiteControl.style.display = 'none';
                
                // التحقق من حالة الترجمة التلقائية
                autoTranslateToggle.checked = settings.autoTranslateSites.some(site => 
                    currentHostname === site || currentHostname.endsWith('.' + site)
                );
            }
        });
    }

    /**
     * تحديث نص زر الترجمة
     */
    function updateTranslateButton(isTranslated, isProcessing = false) {
        if (isProcessing) {
            translateBtn.textContent = "جاري...";
            translateBtn.disabled = true;
        } else {
            translateBtn.textContent = isTranslated ? "إعادة تعيين الصفحة" : "ترجمة الصفحة";
            translateBtn.disabled = false;
        }
    }

    // جلب التبويب الحالي
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            currentTab = tabs[0];
            restoreUI(currentTab);
        }
    });

    [sourceLangSelect, targetLangSelect].forEach(el => el.addEventListener('change', saveSettings));

    // معالج زر الترجمة
    translateBtn.addEventListener('click', () => {
        if (!currentTab || !currentTab.id) return;
        
        // التحقق من الحالة الفعلية من الصفحة قبل التنفيذ
        chrome.tabs.sendMessage(currentTab.id, { action: 'getTranslationStatus' }, (statusResponse) => {
            if (chrome.runtime.lastError) {
                // استخدام التخزين المحلي كـ fallback
                chrome.storage.local.get({[`translated_status_${currentTab.id}`]: false, translationMode: 'replace' }, (result) => {
                    executeTranslationAction(result[`translated_status_${currentTab.id}`], result.translationMode);
                });
            } else {
                // استخدام الحالة الفعلية
                if (statusResponse && statusResponse.isProcessing) {
                    // عملية جارية، لا تفعل شيئاً
                    return;
                }
                chrome.storage.local.get({ translationMode: 'replace' }, (settings) => {
                    executeTranslationAction(statusResponse?.isTranslated || false, settings.translationMode);
                });
            }
        });
    });
    
    /**
     * تنفيذ عملية الترجمة أو إعادة التعيين
     */
    function executeTranslationAction(isCurrentlyTranslated, translationMode) {
        translateBtn.disabled = true;
        translateBtn.textContent = "جاري...";
        
        if (isCurrentlyTranslated) {
            chrome.tabs.sendMessage(currentTab.id, { action: 'resetPage' }, () => {
                // البيانات تُحفظ للجلسة التالية - لا حذف تلقائي
                translateBtn.disabled = false;
                updateTranslateButton(false);
            });
        } else {
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'translatePage', 
                targetLang: targetLangSelect.value, 
                mode: translationMode
            }, (response) => {
                translateBtn.disabled = false;
                if (chrome.runtime.lastError) {
                    translateBtn.textContent = "خطأ في الاتصال";
                    setTimeout(() => updateTranslateButton(false), 2000);
                } else {
                    chrome.storage.local.set({ 
                        [`translated_status_${currentTab.id}`]: true, 
                        [`session_lang_${currentTab.id}`]: targetLangSelect.value 
                    });
                    updateTranslateButton(true);
                    if (response && response.detectedSourceLang && sourceLangSelect.value === 'auto') {
                        const detectedOption = Array.from(sourceLangSelect.options).find(
                            opt => opt.value === response.detectedSourceLang
                        );
                        if (detectedOption) sourceLangSelect.value = response.detectedSourceLang;
                    }
                }
            });
        }
    }

    // معالج تبديل RTL - عند الإلغاء يُضاف الموقع للاستثناءات تلقائياً
    rtlToggle.addEventListener('change', () => {
        if (!currentTab || !currentTab.id) return;
        const newRtlState = rtlToggle.checked;
        
        if (currentTab.url && currentTab.url.startsWith('http')) {
            const hostname = new URL(currentTab.url).hostname.replace(/^www\./, '');
            
            // تطبيق RTL محلياً
            chrome.tabs.sendMessage(currentTab.id, {
                action: 'toggleRtlDirect',
                enabled: newRtlState
            });
            
            // إذا كان RTL العالمي مفعّلاً وتم إلغاء RTL محلياً، أضف للاستثناءات
            chrome.storage.local.get({ globalRtlEnabled: false, rtlExcludedSites: [] }, (settings) => {
                if (settings.globalRtlEnabled) {
                    const excludedSites = new Set(settings.rtlExcludedSites);
                    
                    if (!newRtlState) {
                        // إلغاء RTL = إضافة للاستثناءات
                        excludedSites.add(hostname);
                    } else {
                        // تفعيل RTL = إزالة من الاستثناءات
                        excludedSites.delete(hostname);
                    }
                    
                    chrome.storage.local.set({ rtlExcludedSites: Array.from(excludedSites) });
                }
            });
        }
    });

    // معالج زر الترجمة التلقائية - يترجم فوراً عند التفعيل
    autoTranslateToggle.addEventListener('change', () => {
        if (!currentTab || !currentTab.url || !currentTab.url.startsWith('http')) return;

        const shouldAdd = autoTranslateToggle.checked;
        const hostname = new URL(currentTab.url).hostname.replace(/^www\./, '');

        // تحديث القائمة
        chrome.runtime.sendMessage({
            action: 'updateAutoTranslate',
            hostname: hostname,
            add: shouldAdd
        }, (response) => {
            if (response && response.success && shouldAdd) {
                // ترجمة الصفحة فوراً عند تفعيل الترجمة التلقائية
                chrome.storage.local.get({ translationMode: 'replace', favoriteTargetLang: 'ar' }, (settings) => {
                    const targetLang = targetLangSelect.value || settings.favoriteTargetLang;
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'translatePage',
                        targetLang: targetLang,
                        mode: settings.translationMode
                    }, () => {
                        chrome.storage.local.set({ 
                            [`translated_status_${currentTab.id}`]: true,
                            [`session_lang_${currentTab.id}`]: targetLang
                        });
                        updateTranslateButton(true);
                    });
                });
            }
        });
    });

    // معالج زر استثناء الموقع - يُضيف/يُزيل الموقع من قائمة الاستثناءات
    excludeSiteToggle.addEventListener('change', () => {
        if (!currentTab || !currentTab.url || !currentTab.url.startsWith('http')) return;

        const shouldExclude = excludeSiteToggle.checked;
        const hostname = new URL(currentTab.url).hostname.replace(/^www\./, '');

        // تحديث قائمة الاستثناءات
        chrome.runtime.sendMessage({
            action: 'updateTranslateExclusions',
            hostname: hostname,
            add: shouldExclude
        }, (response) => {
            if (response && response.success) {
                if (shouldExclude) {
                    // إعادة تعيين الصفحة إذا كانت مترجمة - الحفاظ على البيانات
                    chrome.tabs.sendMessage(currentTab.id, { action: 'resetPage' }, () => {
                        updateTranslateButton(false);
                        chrome.runtime.sendMessage({ action: 'set_icon_default', tabId: currentTab.id });
                    });
                }
            }
        });
    });

    settingsBtn.addEventListener('click', () => { chrome.runtime.openOptionsPage(); });

    // مراقبة تغيرات الإعدادات
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && currentTab) {
            if (changes.globalRtlEnabled || changes.rtlExcludedSites) {
                if (currentTab.url && currentTab.url.startsWith('http')) {
                    const hostname = new URL(currentTab.url).hostname.replace(/^www\./, '');
                    chrome.storage.local.get({ globalRtlEnabled: false, rtlExcludedSites: [] }, (settings) => {
                        const isExcluded = settings.rtlExcludedSites.includes(hostname);
                        rtlToggle.checked = settings.globalRtlEnabled && !isExcluded;
                    });
                }
            }
        }
    });
});
