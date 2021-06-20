import { browser } from 'webextension-polyfill-ts'

let startTime: string | undefined

browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    browser.tabs.sendMessage(tabId, { id: 'urlChanged' })
  }
})

browser.runtime.onMessage.addListener(async (message) => {
  const { id, data } = message
  switch (id) {
    case 'sendStartTime':
      startTime = data
      return
    case 'requestStartTime':
      return startTime
  }
})
