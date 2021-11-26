import browser from 'webextension-polyfill'
import { add, format, parseISO } from 'date-fns'
import { parseTime, querySelectorAsync } from './utils'

let startTime: Date | undefined

const updateItem = (node: HTMLElement) => {
  if (!startTime) {
    return
  }

  const timestamp = node.querySelector('#content > #timestamp')
  if (!timestamp) {
    return
  }

  const duration = parseTime(timestamp.textContent ?? '')
  if (!duration) {
    return
  }

  const time = add(startTime, duration)
  timestamp.textContent = format(time, 'p')
}

const updateItems = () => {
  const items = Array.from(
    document.querySelectorAll(
      '#items.yt-live-chat-item-list-renderer>yt-live-chat-text-message-renderer'
    )
  )
  for (const item of items) {
    if (item instanceof HTMLElement) {
      updateItem(item)
    }
  }
}

const init = async () => {
  const data = await browser.runtime.sendMessage({
    id: 'requestStartTime',
  })
  if (!data) {
    return
  }
  startTime = parseISO(data)

  let messageObserver: MutationObserver | undefined = undefined

  const observeMessages = async () => {
    messageObserver?.disconnect()

    const el = await querySelectorAsync(
      '#items.yt-live-chat-item-list-renderer'
    )
    if (!el) {
      return
    }

    messageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const nodes = Array.from(mutation.addedNodes)
        nodes.forEach((node: Node) => {
          if (node instanceof HTMLElement) {
            updateItem(node)
          }
        })
      })
    })
    messageObserver.observe(el, { childList: true })
  }

  await observeMessages()

  const el = await querySelectorAsync('#item-list.yt-live-chat-renderer')
  if (!el) {
    return
  }

  updateItems()

  const observer = new MutationObserver(async () => {
    updateItems()
    await observeMessages()
  })
  observer.observe(el, { childList: true })
}

browser.runtime.onMessage.addListener(async (message) => {
  const { id } = message
  switch (id) {
    case 'urlChanged':
      return await init()
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  await init()
})
