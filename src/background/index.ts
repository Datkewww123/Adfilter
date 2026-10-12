console.log('[AdFilter] Background Service Worker initialized');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AdFilter] Extension installed');
});