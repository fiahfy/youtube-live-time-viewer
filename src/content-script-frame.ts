import { add, format, parseISO } from 'date-fns'
import { parseTime, querySelectorAsync } from '~/utils'
import '~/content-script-frame.css'
import type { Settings } from '~/models'

const ClassName = {
  timestamp: 'yltv-timestamp',
}

let settings: Settings
let startTime: Date | undefined
let observer: MutationObserver | undefined

const updateItem = (node: HTMLElement) => {
  if (!startTime) {
    return
  }

  const timestamp = node.querySelector<HTMLElement>('#content > #timestamp')
  if (!timestamp) {
    return
  }

  const duration = parseTime(timestamp.textContent ?? '')
  if (!duration) {
    return
  }

  const time = add(startTime, duration)

  const oldEl = node.querySelector(`.${ClassName.timestamp}`)
  oldEl?.remove()

  timestamp.style.display = 'none'

  const el = timestamp.cloneNode(false) as HTMLElement
  el.classList.add(ClassName.timestamp)
  el.textContent = format(
    time,
    settings.timeFormat === '12h' ? 'h:mm a' : 'H:mm',
  )
  // Cancel cloned style
  el.style.display = 'inline'

  timestamp.parentElement?.insertBefore(el, timestamp.nextSibling)
}

const updateItems = () => {
  const items = Array.from(
    document.querySelectorAll(
      '#items.yt-live-chat-item-list-renderer>yt-live-chat-text-message-renderer',
    ),
  )
  for (const item of items) {
    if (item instanceof HTMLElement) {
      updateItem(item)
    }
  }
}

const init = async () => {
  const data = await chrome.runtime.sendMessage({
    type: 'get-start-time',
  })
  if (!data) {
    return
  }
  startTime = parseISO(data)

  let messageObserver: MutationObserver | undefined

  const observeMessages = async () => {
    messageObserver?.disconnect()

    const el = await querySelectorAsync(
      '#items.yt-live-chat-item-list-renderer',
    )
    if (!el) {
      return
    }

    messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const nodes = Array.from(mutation.addedNodes)
        for (const node of nodes) {
          if (node instanceof HTMLElement) {
            updateItem(node)
          }
        }
      }
    })
    messageObserver.observe(el, { childList: true })
  }

  const el = await querySelectorAsync('#item-list.yt-live-chat-renderer')
  if (!el) {
    return
  }

  updateItems()
  await observeMessages()

  observer?.disconnect()
  observer = new MutationObserver(async () => {
    updateItems()
    await observeMessages()
  })
  observer.observe(el, { childList: true })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, data } = message
  switch (type) {
    case 'settings-changed':
      settings = data.settings
      init().then(() => sendResponse())
      return true
  }
})

chrome.runtime.sendMessage({ type: 'content-loaded' }).then(async (data) => {
  settings = data.settings
  await init()
})
