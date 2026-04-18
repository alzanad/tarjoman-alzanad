/******************************************************************************
 * # الملف: content/modules/popup_manager.js
 * # الغرض: إدارة النوافذ المنبثقة للترجمة السريعة والتحكم فيها
 * # الاعتماديات: constants.js, utilities.js
 ******************************************************************************/

/**
 * وحدة إدارة النوافذ المنبثقة - تتحكم في عرض وتفاعل نوافذ الترجمة
 * @namespace TarjomanPopup
 */
window.TarjomanPopup = (function() {
    const constants = window.TarjomanConstants;
    const utils = window.TarjomanUtils;

    // متغير لتتبع حالة إخفاء النافذة
    let _hidePopupHandler = null;

    /**
     * عرض نافذة منبثقة للترجمة السريعة
     * @param {string} text - النص المراد ترجمته
     * @param {string} targetLang - اللغة المستهدفة
     */
    function showTranslationPopup(text, targetLang) {
        // إزالة أي نافذة قديمة
        _removeExistingPopup();

        // التحقق من وجود تحديد نشط
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
            console.error('لا يوجد نص محدد');
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // إنشاء النافذة المنبثقة
        const popup = _createPopupElement(rect);
        document.body.appendChild(popup);

        // منع إغلاق النافذة عند النقر عليها
        popup.addEventListener('click', (e) => e.stopPropagation());

        // إضافة مستمعي الأحداث للأزرار
        _setupPopupEventListeners(popup);

        // تفعيل السحب والإفلات
        _makePopupDraggable(popup);

        // إضافة مستمع لإخفاء النافذة عند النقر خارجها
        setTimeout(() => {
            _hidePopupHandler = _hidePopupOnOutsideClick.bind(null);
            document.addEventListener('click', _hidePopupHandler);
        }, 100);

        // بدء عملية الترجمة
        _translateTextInPopup(text, targetLang, popup);
    }

    /**
     * إزالة النافذة المنبثقة الموجودة
     * @private
     */
    function _removeExistingPopup() {
        const existingPopup = document.getElementById(constants.POPUP_ID);
        if (existingPopup) {
            existingPopup.remove();
        }
    }

    /**
     * إنشاء عنصر النافذة المنبثقة
     * @private
     * @param {DOMRect} rect - موضع النص المحدد
     * @returns {HTMLElement} - عنصر النافذة
     */
    function _createPopupElement(rect) {
        const popup = document.createElement('div');
        popup.id = constants.POPUP_ID;
        popup.className = 'moterjem-alzanad-popover';
        
        // حساب موضع النافذة
        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 10;
        
        // تعديل الموضع إذا كان خارج الشاشة
        if (left + constants.POPUP_WIDTH > window.innerWidth) {
            left = Math.max(10, window.innerWidth - constants.POPUP_WIDTH - 10);
        }
        
        if (top + constants.POPUP_HEIGHT > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - constants.POPUP_HEIGHT - 10;
        }
        
        popup.style.cssText = `
            position: absolute;
            top: ${top}px;
            left: ${left}px;
            width: ${Math.min(constants.POPUP_WIDTH, window.innerWidth - 20)}px;
            z-index: 2147483647;
        `;

        // إنشاء محتوى النافذة
        popup.innerHTML = `
            <div class="popover-header">
                <span>جاري الترجمة...</span>
                <div class="popover-controls">
                    <button class="popover-pin" title="تثبيت النافذة">📌</button>
                    <button class="popover-close" title="إغلاق">×</button>
                </div>
            </div>
            <div class="popover-content">
                <div class="popover-loading">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 10px; color: #ffffff;">يتم ترجمة النص...</p>
                </div>
            </div>
        `;

        return popup;
    }

    /**
     * إعداد مستمعي الأحداث للنافذة
     * @private
     * @param {HTMLElement} popup - عنصر النافذة
     */
    function _setupPopupEventListeners(popup) {
        const pinButton = popup.querySelector('.popover-pin');
        const closeButton = popup.querySelector('.popover-close');
        
        pinButton.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePin(pinButton);
        });
        
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopup(popup);
        });
    }

    /**
     * تفعيل خاصية السحب والإفلات للنافذة المنبثقة
     * @private
     * @param {Element} popup - عنصر النافذة المنبثقة
     */
    function _makePopupDraggable(popup) {
        const header = popup.querySelector('.popover-header');
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
            header.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            popup.style.left = `${e.clientX - offsetX}px`;
            popup.style.top = `${e.clientY - offsetY}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    }

    /**
     * ترجمة النص وعرض النتيجة في النافذة المنبثقة
     * @private
     * @param {string} text - النص المراد ترجمته
     * @param {string} targetLang - اللغة المستهدفة
     * @param {Element} popup - عنصر النافذة المنبثقة
     */
    async function _translateTextInPopup(text, targetLang, popup) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'requestTranslation',
                texts: [text],
                sourceLang: 'auto',
                targetLang: targetLang
            });

            if (response && response.translatedTexts && response.translatedTexts[0]) {
                _updatePopupWithTranslation(popup, text, response.translatedTexts[0]);
            } else {
                throw new Error('فشل في الحصول على الترجمة');
            }
        } catch (error) {
            console.error('خطأ في الترجمة:', error);
            _updatePopupWithError(popup, 'فشل في الترجمة. يرجى المحاولة مرة أخرى.');
        }
    }

    /**
     * تحديث النافذة المنبثقة بنتيجة الترجمة
     * @private
     * @param {Element} popup - عنصر النافذة المنبثقة
     * @param {string} originalText - النص الأصلي
     * @param {string} translatedText - النص المُتَرجَم
     */
    function _updatePopupWithTranslation(popup, originalText, translatedText) {
        const header = popup.querySelector('.popover-header span');
        const content = popup.querySelector('.popover-content');
        
        if (header) {
            header.textContent = 'الترجمة';
        }
        
        if (content) {
            // إنشاء عنصر الترجمة
            const translationDiv = document.createElement('div');
            translationDiv.className = 'popover-translation';
            translationDiv.textContent = translatedText;
            
            // إنشاء عنصر الأزرار
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'popover-actions';
            
            // إنشاء زر الاستبدال
            const replaceBtn = document.createElement('button');
            replaceBtn.className = 'popover-replace-btn';
            replaceBtn.textContent = 'استبدال النص';
            replaceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                replaceSelectedTextFromPopup(translatedText, originalText);
            });
            
            // إنشاء زر النسخ
            const copyBtn = document.createElement('button');
            copyBtn.className = 'popover-copy-btn';
            copyBtn.textContent = '📋';
            copyBtn.title = 'نسخ الترجمة';
            copyBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                navigator.clipboard.writeText(translatedText).then(() => {
                    this.style.opacity = '0.5';
                    setTimeout(() => this.style.opacity = '1', 500);
                });
            });
            
            // إضافة الأزرار إلى عنصر الأزرار
            actionsDiv.appendChild(replaceBtn);
            actionsDiv.appendChild(copyBtn);
            
            // تحديث محتوى النافذة
            content.innerHTML = '';
            content.appendChild(translationDiv);
            content.appendChild(actionsDiv);
        }
    }

    /**
     * تحديث النافذة المنبثقة برسالة خطأ
     * @private
     * @param {Element} popup - عنصر النافذة المنبثقة
     * @param {string} errorMessage - رسالة الخطأ
     */
    function _updatePopupWithError(popup, errorMessage) {
        const header = popup.querySelector('.popover-header span');
        const content = popup.querySelector('.popover-content');
        
        if (header) {
            header.textContent = 'خطأ في الترجمة';
        }
        
        if (content) {
            content.innerHTML = `
                <div class="popover-error">
                    ${errorMessage}
                </div>
            `;
        }
    }

    /**
     * تثبيت/إلغاء تثبيت النافذة المنبثقة
     * @param {Element} pinButton - زر التثبيت
     */
    function togglePin(pinButton) {
        const popup = pinButton.closest('.moterjem-alzanad-popover');
        if (popup) {
            if (popup.classList.contains('pinned')) {
                // إلغاء التثبيت
                popup.classList.remove('pinned');
                pinButton.classList.remove('pinned');
                pinButton.textContent = '📌';
                pinButton.title = 'تثبيت النافذة';
                
                // إعادة تفعيل إخفاء النافذة عند النقر خارجها
                setTimeout(() => {
                    _hidePopupHandler = _hidePopupOnOutsideClick.bind(null);
                    document.addEventListener('click', _hidePopupHandler);
                }, 100);
            } else {
                // تثبيت النافذة
                popup.classList.add('pinned');
                pinButton.classList.add('pinned');
                pinButton.textContent = '📍';
                pinButton.title = 'إلغاء التثبيت';
                
                // إزالة مستمع الحدث لتجنب إخفاء النافذة
                if (_hidePopupHandler) {
                    document.removeEventListener('click', _hidePopupHandler);
                }
            }
        }
    }

    /**
     * إغلاق النافذة المنبثقة
     * @param {Element} popupOrButton - النافذة أو زر الإغلاق
     */
    function closePopup(popupOrButton) {
        const popup = popupOrButton.classList?.contains('moterjem-alzanad-popover') 
            ? popupOrButton 
            : popupOrButton.closest('.moterjem-alzanad-popover') 
              || document.getElementById(constants.POPUP_ID);
              
        if (popup) {
            popup.remove();
            if (_hidePopupHandler) {
                document.removeEventListener('click', _hidePopupHandler);
            }
        }
    }

    /**
     * إخفاء النافذة المنبثقة عند النقر خارجها
     * @private
     * @param {Event} event - حدث النقر
     */
    function _hidePopupOnOutsideClick(event) {
        const popup = document.getElementById(constants.POPUP_ID);
        if (popup && !popup.classList.contains('pinned')) {
            const isClickInsidePopup = popup.contains(event.target);
            const isClickOnControl = event.target.closest(
                '.popover-pin, .popover-close, .popover-replace-btn, .popover-copy-btn'
            );
            const isClickOnSelectedText = event.target.closest(
                '.selected-text-highlight, .replacement-highlight'
            );
            
            if (!isClickInsidePopup && !isClickOnControl && !isClickOnSelectedText) {
                closePopup(popup);
            }
        }
    }

    /**
     * استبدال النص المحدد بالنص المُتَرجَم
     * @param {string} translatedText - النص المُتَرجَم
     * @param {string} originalText - النص الأصلي للمقارنة
     */
    function replaceSelectedTextFromPopup(translatedText, originalText) {
        try {
            const selection = window.getSelection();
            let replaced = false;
            
            const cleanOriginalText = utils.cleanText(originalText);
            const cleanTranslatedText = translatedText.trim();
            
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = utils.cleanText(range.toString());
                
                if (selectedText === cleanOriginalText) {
                    if (_replaceSelectedTextAdvanced(originalText, translatedText)) {
                        replaced = true;
                    } else {
                        replaced = _replaceByRange(range, cleanOriginalText, cleanTranslatedText);
                    }
                    selection.removeAllRanges();
                } else {
                    replaced = _searchAndReplace(range, cleanOriginalText, cleanTranslatedText);
                }
            }
            
            // البحث في الصفحة كاملة إذا لم يُعثر على النص
            if (!replaced) {
                replaced = utils.replaceTextInPageWithFormatting(cleanOriginalText, cleanTranslatedText);
            }
            
            if (replaced) {
                _handleSuccessfulReplacement();
            } else {
                _showReplacementError();
            }
            
        } catch (error) {
            _showReplacementError();
        }
    }

    /**
     * استبدال النص المحدد باستخدام Range
     * @private
     */
    function _replaceByRange(range, originalText, translatedText) {
        const container = range.commonAncestorContainer;
        
        if (container.nodeType === Node.TEXT_NODE) {
            const parentElement = container.parentElement;
            if (parentElement) {
                const originalHTML = parentElement.innerHTML;
                const newHTML = originalHTML.replace(
                    utils.escapeRegExp(originalText),
                    translatedText
                );
                parentElement.innerHTML = newHTML;
                return true;
            }
        } else {
            range.extractContents();
            const newTextNode = document.createTextNode(translatedText);
            range.insertNode(newTextNode);
            return true;
        }
        
        return false;
    }

    /**
     * البحث والاستبدال في العناصر المجاورة
     * @private
     */
    function _searchAndReplace(range, originalText, translatedText) {
        const container = range.commonAncestorContainer;
        let replaced = utils.replaceTextInContainerWithFormatting(
            container, 
            originalText, 
            translatedText
        );
        
        if (!replaced) {
            let parent = container.parentElement;
            while (parent && parent !== document.body && !replaced) {
                replaced = utils.replaceTextInContainerWithFormatting(
                    parent, 
                    originalText, 
                    translatedText
                );
                parent = parent.parentElement;
            }
        }
        
        return replaced;
    }

    /**
     * استبدال متقدم للنص المحدد مع الحفاظ على التنسيق
     * @private
     */
    function _replaceSelectedTextAdvanced(originalText, translatedText) {
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            return false;
        }
        
        const range = selection.getRangeAt(0);
        
        if (range.toString().trim() === originalText.trim()) {
            const tempSpan = document.createElement('span');
            tempSpan.textContent = translatedText;
            
            const parentElement = range.startContainer.parentElement;
            if (parentElement) {
                const computedStyle = window.getComputedStyle(parentElement);
                tempSpan.style.cssText = `
                    font-weight: ${computedStyle.fontWeight};
                    font-style: ${computedStyle.fontStyle};
                    color: ${computedStyle.color};
                    text-decoration: ${computedStyle.textDecoration};
                    font-size: ${computedStyle.fontSize};
                    font-family: ${computedStyle.fontFamily};
                `;
            }
            
            range.deleteContents();
            range.insertNode(tempSpan);
            selection.removeAllRanges();
            
            return true;
        }
        
        return false;
    }

    /**
     * معالجة الاستبدال الناجح
     * @private
     */
    function _handleSuccessfulReplacement() {
        const popup = document.getElementById(constants.POPUP_ID);
        if (popup) {
            if (popup.classList.contains('pinned')) {
                _showSuccessMessage(popup);
            } else {
                popup.remove();
                if (_hidePopupHandler) {
                    document.removeEventListener('click', _hidePopupHandler);
                }
            }
        }
    }

    /**
     * عرض رسالة نجاح في النافذة المثبتة
     * @private
     * @param {Element} popup - النافذة المنبثقة
     */
    function _showSuccessMessage(popup) {
        const content = popup.querySelector('.popover-content');
        if (content) {
            const successDiv = document.createElement('div');
            successDiv.className = 'popover-success';
            successDiv.textContent = 'تم استبدال النص بنجاح!';
            successDiv.style.cssText = `
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid rgba(76, 175, 80, 0.5);
                border-radius: 6px;
                padding: 8px 12px;
                color: #4CAF50;
                text-align: center;
                font-size: 12px;
                font-weight: 500;
                margin-top: 10px;
            `;
            content.appendChild(successDiv);
            
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.remove();
                }
            }, 2000);
        }
    }

    /**
     * عرض رسالة خطأ عند فشل الاستبدال
     * @private
     */
    function _showReplacementError() {
        const popup = document.getElementById(constants.POPUP_ID);
        if (popup) {
            const content = popup.querySelector('.popover-content');
            if (content) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'popover-error';
                errorDiv.textContent = 'لم يتم العثور على النص المراد استبداله.';
                errorDiv.style.marginTop = '10px';
                content.appendChild(errorDiv);
                
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 3000);
            }
        }
    }

    /**
     * تنظيف الموارد وإزالة النوافذ
     */
    function cleanup() {
        const popups = document.querySelectorAll('.moterjem-alzanad-popover');
        popups.forEach(popup => popup.remove());
        
        if (_hidePopupHandler) {
            document.removeEventListener('click', _hidePopupHandler, true);
        }
        
        localStorage.removeItem(constants.POPUP_STATE_KEY);
    }

    /**
     * ضبط موضع النافذة تلقائياً عند التمرير أو تغيير الحجم
     * @param {Element} popup - النافذة المنبثقة
     */
    function adjustPopupPosition(popup) {
        const rect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let adjustedX = parseInt(popup.style.left) || 0;
        let adjustedY = parseInt(popup.style.top) || 0;
        
        if (rect.right > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 20;
        } else if (rect.left < 0) {
            adjustedX = 20;
        }
        
        if (rect.bottom > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 20;
        } else if (rect.top < 0) {
            adjustedY = 20;
        }
        
        popup.style.left = adjustedX + 'px';
        popup.style.top = adjustedY + 'px';
    }

    // الواجهة العامة للوحدة
    return {
        showTranslationPopup,
        togglePin,
        closePopup,
        replaceSelectedTextFromPopup,
        cleanup,
        adjustPopupPosition
    };
})();
