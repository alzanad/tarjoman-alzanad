/******************************************************************************
 * # الملف: background/service_worker.js
 * # الغرض: منسق العمل الرئيسي لجميع خدمات الخلفية
 ******************************************************************************/

import { handleRuntimeMessage } from './handlers/message_handlers.js';
import { handleTabUpdate, handleTabRemove } from './handlers/tab_handlers.js';
import { handleContextMenuClick } from './services/context_menu_service.js';
import { initializeExtension } from './services/initialization_service.js';

// --- معالج الرسائل الرئيسي ---
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

// --- أحداث دورة حياة الإضافة ---
chrome.runtime.onInstalled.addListener(initializeExtension);

// --- معالجات قائمة النقر الأيمن ---
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// --- معالجات التبويبات ---
chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onRemoved.addListener(handleTabRemove);
