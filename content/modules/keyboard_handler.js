/******************************************************************************
 * # الملف: content/modules/keyboard_handler.js
 * # الغرض: معالجة اختصارات لوحة المفاتيح والأحداث المتعلقة بها
 * # الاعتماديات: constants.js, popup_manager.js
 ******************************************************************************/

/**
 * وحدة معالجة لوحة المفاتيح - تدير الاختصارات والتفاعلات
 * @namespace TarjomanKeyboard
 */
window.TarjomanKeyboard = (function() {
    const constants = window.TarjomanConstants;
    const popup = window.TarjomanPopup;

    /**
     * تهيئة مستمعات لوحة المفاتيح
     */
    function initialize() {
        document.addEventListener('keydown', _handleKeyDown);
    }

    /**
     * معالجة أحداث الضغط على المفاتيح
     * @private
     * @param {KeyboardEvent} e - حدث لوحة المفاتيح
     */
    function _handleKeyDown(e) {
        // اختصار Alt+A لتبديل الترجمة
        if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ش')) {
            e.preventDefault();
            _togglePageTranslation();
            return;
        }
        
        // اختصار Alt+S لتبديل RTL (محلي فقط - لا يؤثر على الإعدادات)
        if (e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'س')) {
            e.preventDefault();
            _toggleLocalRtl();
            return;
        }

        // معالجة اختصارات النافذة المنبثقة
        const popupElement = document.getElementById(constants.POPUP_ID);
        if (!popupElement) return;

        switch (e.key) {
            case 'Escape':
                popup.closePopup(popupElement);
                break;
                
            case 'Enter':
                if (e.ctrlKey || e.metaKey) {
                    const replaceBtn = popupElement.querySelector('.popover-replace-btn');
                    if (replaceBtn) {
                        replaceBtn.click();
                    }
                }
                break;
                
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    const copyBtn = popupElement.querySelector('.popover-copy-btn');
                    if (copyBtn) {
                        copyBtn.click();
                        e.preventDefault();
                    }
                }
                break;
                
            case 'p':
                if (e.ctrlKey || e.metaKey) {
                    const pinBtn = popupElement.querySelector('.popover-pin');
                    if (pinBtn) {
                        pinBtn.click();
                        e.preventDefault();
                    }
                }
                break;
        }
    }

    /**
     * تبديل حالة ترجمة الصفحة
     * @private
     */
    async function _togglePageTranslation() {
        const state = window.TarjomanState;
        const main = window.TarjomanMain;
        
        // منع التنفيذ المتزامن
        if (state.isProcessing) {
            console.warn('[TarjomanKeyboard] عملية جارية، يُرجى الانتظار');
            return;
        }

        if (state.isTranslated) {
            // إزالة الترجمة
            main.restoreOriginals();
            // إعلام الخلفية بتغيير الحالة وتحديث الأيقونة
            chrome.runtime.sendMessage({ action: 'set_icon_default' });
            chrome.runtime.sendMessage({ action: 'translationToggled', isTranslated: false });
        } else {
            // بدء الترجمة - جلب اللغة المستهدفة من الإعدادات
            const settings = await _getStorageValue({ favoriteTargetLang: 'ar', translationMode: 'replace' });
            await main.startTranslation(settings.favoriteTargetLang, settings.translationMode);
            // إعلام الخلفية بتغيير الحالة وتحديث الأيقونة
            chrome.runtime.sendMessage({ action: 'set_icon_active' });
            chrome.runtime.sendMessage({ action: 'translationToggled', isTranslated: true });
        }
    }
    
    /**
     * تبديل RTL محلياً (لا يؤثر على الإعدادات العامة)
     * @private
     */
    function _toggleLocalRtl() {
        // الحصول على حالة RTL الحالية من rtl_injector
        // ثم إرسال رسالة للتبديل
        const event = new CustomEvent('tarjoman-toggle-rtl');
        document.dispatchEvent(event);
    }

    /**
     * جلب قيمة من التخزين
     * @private
     */
    function _getStorageValue(defaults) {
        return new Promise((resolve) => {
            chrome.storage.local.get(defaults, resolve);
        });
    }

    /**
     * إزالة مستمعات لوحة المفاتيح
     */
    function destroy() {
        document.removeEventListener('keydown', _handleKeyDown);
    }

    // الواجهة العامة للوحدة
    return {
        initialize,
        destroy
    };
})();
