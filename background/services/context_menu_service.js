/******************************************************************************
 * # الملف: background/services/context_menu_service.js
 * # الغرض: خدمة إدارة قائمة النقر الأيمن والترجمة السريعة
 ******************************************************************************/

/**
 * إعداد قائمة النقر الأيمن
 */
export function setupContextMenu() {
    chrome.contextMenus.create({
        id: "translate-selection",
        title: "ترجمة النص المحدد باستخدام تَرجمان الزَّنَاد",
        contexts: ["selection"]
    });
}

/**
 * معالج النقر على عنصر قائمة النقر الأيمن
 */
export async function handleContextMenuClick(info, tab) {
    if (info.menuItemId === "translate-selection") {
        const selectedText = info.selectionText;
        if (!selectedText || selectedText.trim() === '') return;
        
        try {
            // إرسال رسالة لإظهار النافذة المنبثقة
            await chrome.tabs.sendMessage(tab.id, {
                action: 'showTranslationPopup',
                text: selectedText,
                targetLang: 'ar'
            });
        } catch (error) {
            console.error('خطأ في إظهار نافذة الترجمة:', error);
        }
    }
}
