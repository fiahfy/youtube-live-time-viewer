chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    await chrome.tabs.sendMessage(tabId, { type: 'url-changed' })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, data } = message
  switch (type) {
    case 'set-start-time':
      chrome.storage.local.set({ data }).then(() => sendResponse())
      return true
    case 'get-start-time':
      chrome.storage.local.get(['data']).then((result) => sendResponse(result))
      return true
  }
})
