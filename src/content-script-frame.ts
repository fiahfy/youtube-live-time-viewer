import { add, format, parseISO } from 'date-fns'
import { parseTime, querySelectorAsync } from './utils'
import './content-script-frame.css'

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

  let messageObserver: MutationObserver | undefined = undefined

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

  const observer = new MutationObserver(async () => {
    updateItems()
    await observeMessages()
  })
  observer.observe(el, { childList: true })
}

init()
