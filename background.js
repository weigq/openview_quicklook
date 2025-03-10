chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('openreview.net')) {
        chrome.tabs.sendMessage(tabId, {
            message: 'TabUpdated'
        }).catch(error => {
            // Suppress errors from tabs where content script isn't loaded yet
            console.debug('Error sending message to tab', error);
        });
    }
})
