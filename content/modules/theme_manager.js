/******************************************************************************
 * # الملف: content/modules/theme_manager.js
 * # الغرض: إدارة الوضع المظلم وتحسينات الأداء
 * # الاعتماديات: constants.js, utilities.js, popup_manager.js
 ******************************************************************************/

/**
 * وحدة إدارة المظهر - تتحكم في الوضع المظلم وتحسينات الأداء
 * @namespace TarjomanTheme
 */
window.TarjomanTheme = (function() {
    const constants = window.TarjomanConstants;
    const utils = window.TarjomanUtils;
    const popup = window.TarjomanPopup;

    /**
     * تهيئة مدير المظهر
     */
    function initialize() {
        _detectAndApplyDarkMode();
        _setupDarkModeListener();
        _optimizePerformance();
    }

    /**
     * كشف وتطبيق الوضع المظلم
     * @private
     */
    function _detectAndApplyDarkMode() {
        if (utils.detectDarkMode()) {
            document.body.classList.add('dark-mode');
        }
    }

    /**
     * إعداد مستمع تغيير الوضع المظلم
     * @private
     */
    function _setupDarkModeListener() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });
    }

    /**
     * تطبيق تحسينات الأداء
     * @private
     */
    function _optimizePerformance() {
        const throttledAdjustPosition = utils.throttle(() => {
            const popupElement = document.getElementById(constants.POPUP_ID);
            if (popupElement) {
                requestAnimationFrame(() => {
                    popup.adjustPopupPosition(popupElement);
                });
            }
        }, 100);
        
        window.addEventListener('scroll', throttledAdjustPosition);
        window.addEventListener('resize', throttledAdjustPosition);
    }

    // الواجهة العامة للوحدة
    return {
        initialize
    };
})();
