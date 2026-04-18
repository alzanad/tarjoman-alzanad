/******************************************************************************
 * # الملف: background/handlers/message_handlers.js
 * # الغرض: معالجة جميع الرسائل الواردة من الواجهة الأمامية
 ******************************************************************************/

import { translate } from '../services/translation_service.js';
import { setDefaultIcon, setActiveIcon } from '../services/icon_service.js';

/**
 * معالج الرسائل الرئيسي
 * يستقبل جميع الرسائل من content scripts و popup
 */
export function handleRuntimeMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'requestTranslation':
            handleTranslationRequest(request, sendResponse);
            return true; // استجابة غير متزامنة
            
        case 'set_icon_active':
            // دعم tabId من الرسالة (من popup) أو من sender.tab (من content script)
            setActiveIcon(request.tabId || sender.tab?.id);
            break;
            
        case 'set_icon_default':
            setDefaultIcon(request.tabId || sender.tab?.id);
            break;
            
        case 'updateAutoTranslate':
            handleAutoTranslateUpdate(request, sendResponse);
            return true; // استجابة غير متزامنة
            
        case 'updateRtlExclusions':
            handleRtlExclusionsUpdate(request, sendResponse);
            return true; // استجابة غير متزامنة
            
        case 'updateTranslateExclusions':
            handleTranslateExclusionsUpdate(request, sendResponse);
            return true; // استجابة غير متزامنة
            
        case 'translationToggled':
            // تحديث حالة الترجمة في التخزين عند استخدام الاختصار
            if (sender.tab && sender.tab.id) {
                handleTranslationToggle(sender.tab.id, request.isTranslated, sendResponse);
            }
            return true;
            
        default:
            console.warn('طلب غير معروف:', request.action);
    }
}

/**
 * معالج طلبات الترجمة
 */
async function handleTranslationRequest(request, sendResponse) {
    try {
        const response = await translate(request.texts, request.sourceLang, request.targetLang);
        sendResponse(response);
    } catch (error) {
        console.error("فشل في الترجمة:", error);
        sendResponse({ translatedTexts: [], detectedSourceLang: null });
    }
}

/**
 * معالج تحديث قائمة الترجمة التلقائية
 */
function handleAutoTranslateUpdate(request, sendResponse) {
    chrome.storage.local.get({ autoTranslateSites: [] }, (settings) => {
        const sites = new Set(settings.autoTranslateSites);
        
        if (request.add) {
            sites.add(request.hostname);
        } else {
            sites.delete(request.hostname);
        }
        
        chrome.storage.local.set({ autoTranslateSites: Array.from(sites) }, () => {
            sendResponse({ success: true });
        });
    });
}

/**
 * معالج تحديث قائمة استثناءات RTL
 */
function handleRtlExclusionsUpdate(request, sendResponse) {
    chrome.storage.local.get({ rtlExcludedSites: [], globalRtlEnabled: false }, (settings) => {
        const excludedSites = new Set(settings.rtlExcludedSites);
        
        if (request.add) {
            excludedSites.add(request.hostname);
        } else {
            excludedSites.delete(request.hostname);
        }
        
        chrome.storage.local.set({ rtlExcludedSites: Array.from(excludedSites) }, () => {
            // إرسال تحديث فوري لجميع التبويبات
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && tab.url.startsWith('http')) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateRtlStatus',
                            enabled: settings.globalRtlEnabled,
                            excludedSites: Array.from(excludedSites)
                        }, { frameId: 0 }).catch(() => {
                            // تجاهل الأخطاء للتبويبات المغلقة
                        });
                    }
                });
            });
            
            sendResponse({ success: true });
        });
    });
}

/**
 * معالج تبديل حالة الترجمة (من اختصار لوحة المفاتيح)
 */
function handleTranslationToggle(tabId, isTranslated, sendResponse) {
    if (isTranslated) {
        chrome.storage.local.set({ [`translated_status_${tabId}`]: true }, () => {
            sendResponse({ success: true });
        });
    } else {
        // عدم حذف البيانات - فقط تحديث الحالة
        chrome.storage.local.set({ [`translated_status_${tabId}`]: false }, () => {
            sendResponse({ success: true });
        });
    }
}

/**
 * معالج تحديث قائمة استثناءات الترجمة الشاملة
 */
function handleTranslateExclusionsUpdate(request, sendResponse) {
    chrome.storage.local.get({ translateExcludedSites: [] }, (settings) => {
        const excludedSites = new Set(settings.translateExcludedSites);
        
        if (request.add) {
            excludedSites.add(request.hostname);
        } else {
            excludedSites.delete(request.hostname);
        }
        
        chrome.storage.local.set({ translateExcludedSites: Array.from(excludedSites) }, () => {
            sendResponse({ success: true });
        });
    });
}
