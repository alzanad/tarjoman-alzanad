document.addEventListener('DOMContentLoaded', () => {
    const favoriteLangSelect = document.getElementById('favorite-lang-select');
    const modeToggle = document.getElementById('mode-toggle');
    const globalRtlToggle = document.getElementById('global-rtl-toggle');
    const rtlExclusionsContainer = document.getElementById('rtl-exclusions-container');
    const globalTranslateToggle = document.getElementById('global-translate-toggle');
    const translateExclusionsContainer = document.getElementById('translate-exclusions-container');
    const autoTranslateSitesContainer = document.getElementById('auto-translate-sites-container');
    
    // عناصر الترجمة السريعة
    const quickSourceText = document.getElementById('quick-source-text');
    const quickResultText = document.getElementById('quick-result-text');
    const quickSourceLang = document.getElementById('quick-source-lang');
    const quickTargetLang = document.getElementById('quick-target-lang');
    const quickTranslateBtn = document.getElementById('quick-translate-btn');
    const copyTranslationBtn = document.getElementById('copy-translation-btn');
    
    populateLanguageDropdown(favoriteLangSelect, false);
    populateLanguageDropdown(quickTargetLang, false);
    populateLanguageDropdown(quickSourceLang, true); // يشمل الكشف التلقائي
    
    // تعيين القيم الافتراضية
    quickSourceLang.value = 'auto'; // الكشف التلقائي كافتراضي
    quickTargetLang.value = 'ar';
    
    // ===== منطق الترجمة السريعة =====
    
    /**
     * ترجمة النص المدخل باستخدام خدمة الترجمة الموحدة
     */
    async function translateQuickText() {
        const text = quickSourceText.value.trim();
        if (!text) {
            quickResultText.value = '';
            return;
        }
        
        const sourceLang = quickSourceLang.value;
        const targetLang = quickTargetLang.value;
        
        quickTranslateBtn.disabled = true;
        quickTranslateBtn.textContent = 'جاري...';
        quickResultText.value = 'جاري الترجمة...';
        
        try {
            // استخدام خدمة الترجمة الموحدة
            const result = await TarjomanTranslationClient.translateText(text, targetLang, sourceLang);
            
            if (result.success) {
                quickResultText.value = result.translation;
            } else {
                quickResultText.value = result.error || 'تعذرت الترجمة. حاول مرة أخرى.';
            }
        } catch (error) {
            quickResultText.value = 'خطأ في الاتصال بخدمة الترجمة.';
        } finally {
            quickTranslateBtn.disabled = false;
            quickTranslateBtn.textContent = 'ترجم';
        }
    }
    
    // زر الترجمة
    quickTranslateBtn.addEventListener('click', translateQuickText);
    
    // ترجمة تلقائية عند التوقف عن الكتابة (debounce)
    let translateDebounce = null;
    quickSourceText.addEventListener('input', () => {
        clearTimeout(translateDebounce);
        
        // مسح حقل الهدف عند مسح حقل المصدر
        if (!quickSourceText.value.trim()) {
            quickResultText.value = '';
            return;
        }
        
        translateDebounce = setTimeout(() => {
            if (quickSourceText.value.trim().length > 2) {
                translateQuickText();
            }
        }, 1000);
    });
    
    // ترجمة عند الضغط على Enter (مع Ctrl)
    quickSourceText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            translateQuickText();
        }
    });
    
    // نسخ الترجمة
    copyTranslationBtn.addEventListener('click', () => {
        const text = quickResultText.value;
        if (!text || text === 'جاري الترجمة...' || text.startsWith('خطأ') || text.startsWith('تعذرت')) {
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            copyTranslationBtn.textContent = 'تم!';
            copyTranslationBtn.classList.add('copied');
            setTimeout(() => {
                copyTranslationBtn.textContent = 'نسخ';
                copyTranslationBtn.classList.remove('copied');
            }, 1500);
        });
    });
    
    // ترجمة عند تغيير اللغة المستهدفة
    quickTargetLang.addEventListener('change', () => {
        if (quickSourceText.value.trim()) {
            translateQuickText();
        }
    });
    
    // ترجمة عند تغيير لغة المصدر
    quickSourceLang.addEventListener('change', () => {
        if (quickSourceText.value.trim()) {
            translateQuickText();
        }
    });

    // إظهار/إخفاء textarea الاستثناءات للـ RTL
    globalRtlToggle.addEventListener('change', () => {
        toggleContainer(rtlExclusionsContainer, globalRtlToggle.checked);
    });
    
    // إظهار/إخفاء حقول الترجمة حسب الترجمة الشاملة
    globalTranslateToggle.addEventListener('change', () => {
        const isGlobalEnabled = globalTranslateToggle.checked;
        toggleContainer(translateExclusionsContainer, isGlobalEnabled);
        toggleContainer(autoTranslateSitesContainer, !isGlobalEnabled);
    });

    /**
     * تبديل إظهار/إخفاء حاوية مع تحريك سلس
     */
    function toggleContainer(container, show) {
        if (show) {
            container.classList.remove('hidden');
            container.style.display = 'block';
        } else {
            container.classList.add('hidden');
            setTimeout(() => {
                if (container.classList.contains('hidden')) {
                    container.style.display = 'none';
                }
            }, 300);
        }
    }



    // تحسين تفاعل القائمة المنسدلة للغات
    favoriteLangSelect.addEventListener('change', () => {
        // السماح بتحديد خيار واحد فقط رغم أن القائمة multiple
        const selectedOptions = Array.from(favoriteLangSelect.selectedOptions);
        if (selectedOptions.length > 1) {
            // إلغاء تحديد جميع الخيارات عدا الأخير المختار
            selectedOptions.slice(0, -1).forEach(option => {
                option.selected = false;
            });
        }
    });

    // إضافة مؤشر بصري للخيار المختار
    favoriteLangSelect.addEventListener('click', (e) => {
        if (e.target.tagName === 'OPTION') {
            // إزالة التحديد من جميع الخيارات
            Array.from(favoriteLangSelect.options).forEach(option => {
                option.selected = false;
            });
            // تحديد الخيار المنقور عليه
            e.target.selected = true;
        }
    });

    function saveOptions() {
        const service = document.getElementById('service-select').value;
        const sitesText = document.getElementById('auto-translate-sites').value;
        const newSites = sitesText.split('\n').map(s => s.trim()).filter(Boolean);
        
        // الحصول على اللغة المختارة من القائمة المحدثة
        const selectedOptions = Array.from(favoriteLangSelect.selectedOptions);
        const favoriteLang = selectedOptions.length > 0 ? selectedOptions[0].value : 'ar';
        
        const mode = modeToggle.checked ? 'immersive' : 'replace';
        const globalRtl = globalRtlToggle.checked;
        const globalTranslate = globalTranslateToggle.checked;
        
        // حفظ قائمة الاستثناءات للـ RTL
        const excludedSitesText = document.getElementById('rtl-excluded-sites').value;
        const excludedSites = excludedSitesText.split('\n').map(s => s.trim()).filter(Boolean);
        
        // حفظ قائمة الاستثناءات من الترجمة
        const translateExcludedText = document.getElementById('translate-excluded-sites').value;
        const translateExcludedSites = translateExcludedText.split('\n').map(s => s.trim()).filter(Boolean);

        // مقارنة القائمة الجديدة بالقديمة لإعادة تعيين الصفحات المحذوفة
        chrome.storage.local.get({ autoTranslateSites: [] }, (oldSettings) => {
            const oldSites = oldSettings.autoTranslateSites;
            const removedSites = oldSites.filter(site => !newSites.includes(site));
            
            // إعادة تعيين الصفحات التي أُزيلت من قائمة الترجمة التلقائية
            if (removedSites.length > 0) {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.url && tab.url.startsWith('http')) {
                            removedSites.forEach(site => {
                                try {
                                    const tabHostname = new URL(tab.url).hostname.replace(/^www\./, '');
                                    if (tabHostname === site || tabHostname.endsWith('.' + site)) {
                                        chrome.tabs.sendMessage(tab.id, {
                                            action: 'clearDomainState'
                                        }).catch(() => {});
                                    }
                                } catch (e) {}
                            });
                        }
                    });
                });
            }
            
            chrome.storage.local.set({
                translationProvider: service, autoTranslateSites: newSites,
                favoriteTargetLang: favoriteLang, translationMode: mode,
                globalRtlEnabled: globalRtl, rtlExcludedSites: excludedSites,
                globalTranslateEnabled: globalTranslate, translateExcludedSites: translateExcludedSites
            }, () => {
                const status = document.getElementById('status');
                status.textContent = "تم حفظ الإعدادات بنجاح!";
                setTimeout(() => { status.textContent = ''; }, 2000);
                
                // إشعار جميع التبويبات بتحديث إعدادات RTL
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.url && tab.url.startsWith('http')) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'updateRtlStatus',
                                enabled: globalRtl,
                                excludedSites: excludedSites
                            }).catch(() => {
                                // تجاهل الأخطاء للتبويبات غير المتاحة
                            });
                        }
                    });
                });
            });
        });
    }

    function restoreOptions() {
        chrome.storage.local.get({
            translationProvider: 'google', autoTranslateSites: [],
            favoriteTargetLang: 'ar', translationMode: 'replace',
            globalRtlEnabled: false, rtlExcludedSites: [],
            globalTranslateEnabled: false, translateExcludedSites: []
        }, (items) => {
            document.getElementById('service-select').value = items.translationProvider;
            document.getElementById('auto-translate-sites').value = items.autoTranslateSites.join('\n');
            
            // تحديد اللغة المفضلة في القائمة المحدثة
            const options = Array.from(favoriteLangSelect.options);
            options.forEach(option => {
                option.selected = option.value === items.favoriteTargetLang;
            });
            
            modeToggle.checked = items.translationMode === 'immersive';
            globalRtlToggle.checked = items.globalRtlEnabled;
            
            // استعادة قائمة الاستثناءات للـ RTL
            document.getElementById('rtl-excluded-sites').value = items.rtlExcludedSites.join('\n');
            
            // استعادة قائمة الاستثناءات من الترجمة
            document.getElementById('translate-excluded-sites').value = items.translateExcludedSites.join('\n');
            
            // إظهار/إخفاء textarea الاستثناءات للـ RTL
            if (items.globalRtlEnabled) {
                rtlExclusionsContainer.classList.remove('hidden');
                rtlExclusionsContainer.style.display = 'block';
            } else {
                rtlExclusionsContainer.classList.add('hidden');
                rtlExclusionsContainer.style.display = 'none';
            }
            
            // استعادة إعدادات الترجمة الشاملة
            globalTranslateToggle.checked = items.globalTranslateEnabled;
            
            // إظهار/إخفاء حقول الترجمة حسب الترجمة الشاملة
            if (items.globalTranslateEnabled) {
                translateExclusionsContainer.classList.remove('hidden');
                translateExclusionsContainer.style.display = 'block';
                autoTranslateSitesContainer.classList.add('hidden');
                autoTranslateSitesContainer.style.display = 'none';
            } else {
                translateExclusionsContainer.classList.add('hidden');
                translateExclusionsContainer.style.display = 'none';
                autoTranslateSitesContainer.classList.remove('hidden');
                autoTranslateSitesContainer.style.display = 'block';
            }
        });
    }

    function clearCache() {
        const status = document.getElementById('status');
        status.textContent = "جاري مسح ذاكرة الترجمة...";
        
        // مسح الترجمات مباشرة من chrome.storage.local
        chrome.storage.local.get(null, (allData) => {
            const cacheKeys = Object.keys(allData).filter(key => key.startsWith('tarjoman_cache_'));
            const count = cacheKeys.length;
            
            if (count > 0) {
                chrome.storage.local.remove(cacheKeys, () => {
                    status.textContent = `تم مسح ${count} ترجمة من الذاكرة بنجاح!`;
                    setTimeout(() => { status.textContent = ''; }, 3000);
                });
            } else {
                status.textContent = "الذاكرة فارغة بالفعل.";
                setTimeout(() => { status.textContent = ''; }, 3000);
            }
        });
    }

    // تحسين textarea الاستثناءات
    const rtlExcludedSitesTextarea = document.getElementById('rtl-excluded-sites');
    
    // إضافة walidation للمواقع المدخلة
    rtlExcludedSitesTextarea.addEventListener('input', () => {
        const lines = rtlExcludedSitesTextarea.value.split('\n');
        const validatedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.includes('.')) {
                return trimmed; // يمكن أن يكون domain فرعي
            }
            return trimmed;
        });
        
        // تحديث textarea بقيم منظمة
        if (validatedLines.join('\n') !== rtlExcludedSitesTextarea.value) {
            const cursorPosition = rtlExcludedSitesTextarea.selectionStart;
            rtlExcludedSitesTextarea.value = validatedLines.join('\n');
            rtlExcludedSitesTextarea.setSelectionRange(cursorPosition, cursorPosition);
        }
    });

    restoreOptions();
    document.getElementById('save-btn').addEventListener('click', saveOptions);
    document.getElementById('clear-cache-btn').addEventListener('click', clearCache);
});