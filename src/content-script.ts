import { semaphore } from '@fiahfy/semaphore'
import { add, format, formatISO, parseISO } from 'date-fns'
import { parseTime } from './utils'
import './content-script.css'

const ClassName = {
  currentTime: 'yltv-current-time',
  startTime: 'yltv-start-time',
  tooltip: 'yltv-tooltip',
}

const s = semaphore()
const isVideoUrl = () => new URL(location.href).pathname === '/watch'
let seekingObserver: MutationObserver | undefined
let currentTimeObserver: MutationObserver | undefined
let startTime: Date | undefined
let endTime: Date | undefined

const loadTimes = async () => {
  const res = await fetch(location.href)
  const text = await res.text()
  const doc = new DOMParser().parseFromString(text, 'text/html')

  const startDate = doc.querySelector<HTMLMetaElement>(
    'meta[itemprop=startDate]',
  )?.content
  startTime = startDate ? parseISO(startDate) : undefined

  const endDate = doc.querySelector<HTMLMetaElement>(
    'meta[itemprop=endDate]',
  )?.content
  endTime = endDate ? parseISO(endDate) : undefined
}

const disconnectSeeking = () => {
  seekingObserver?.disconnect()
  const el = document.querySelector(`.${ClassName.tooltip}`)
  el?.remove()
}

const observeSeeking = () => {
  const wrapper = document.querySelector(
    '.html5-video-player > div > .ytp-tooltip-text-wrapper > .ytp-tooltip-bottom-text',
  )
  if (!wrapper) {
    return
  }

  const sourceTooltip = wrapper.querySelector('.ytp-tooltip-text')
  if (!sourceTooltip) {
    return
  }

  seekingObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const [addedNode] = mutation.addedNodes
      if (addedNode) {
        if (!startTime) {
          return
        }
        const duration = parseTime(addedNode.textContent ?? '')
        if (!duration) {
          return
        }
        const target = endTime ? startTime : new Date()
        const time = add(target, duration)
        let el = document.querySelector(`.${ClassName.tooltip}`)
        if (!el) {
          el = document.createElement('span')
          el.classList.add(ClassName.tooltip)
          el.classList.add(...sourceTooltip.classList)
          wrapper.append(el)
        }
        el.textContent = `(${format(time, 'pp')})`
      }
      const [removedNode] = mutation.removedNodes
      if (removedNode) {
        const tooltip = document.querySelector(`.${ClassName.tooltip}`)
        tooltip?.remove()
      }
    }
  })
  seekingObserver.observe(sourceTooltip, { childList: true })
}

const disconnectCurrentTime = () => {
  currentTimeObserver?.disconnect()
  const el = document.querySelector(`.${ClassName.currentTime}`)
  el?.remove()
}

const observeCurrentTime = () => {
  const timeDisplay = document.querySelector(
    '.html5-video-player .ytp-chrome-bottom > .ytp-chrome-controls > .ytp-left-controls > .ytp-time-display',
  )
  const currentTime = timeDisplay?.querySelector('.ytp-time-current')
  if (!timeDisplay || !currentTime) {
    return
  }

  currentTimeObserver = new MutationObserver((mutations) => {
    for (const _mutation of mutations) {
      if (!startTime) {
        return
      }
      const duration = parseTime(currentTime.textContent ?? '')
      if (!duration) {
        return
      }
      const time = add(startTime, duration)
      let el = document.querySelector(`.${ClassName.currentTime}`)
      if (!el) {
        el = document.createElement('span')
        el.classList.add(ClassName.currentTime)
        timeDisplay.parentElement?.insertBefore(el, timeDisplay.nextSibling)
      }
      el.textContent = `(${format(time, 'pp')})`
    }
  })
  currentTimeObserver.observe(currentTime, { childList: true })
}

const removeStartTime = () => {
  const label = document.querySelector(`.${ClassName.startTime}`)
  label?.remove()
}

const appendStartTime = () => {
  const wrapper = document.querySelector(
    '#bottom-row > #description > #description-inner > #ytd-watch-info-text > #info-container > #info',
  )
  if (!wrapper) {
    return
  }

  if (!startTime) {
    return
  }

  let label = document.querySelector(`.${ClassName.startTime}`)
  if (!label) {
    label = document.createElement('span')
    label.classList.add(ClassName.startTime, 'yt-formatted-string', 'bold')
    wrapper.append(label)
  }
  label.textContent = ` (${format(startTime, 'PPp')}) `
}

const init = async () => {
  if (!isVideoUrl()) {
    return
  }

  await s.acquire(async () => {
    disconnectSeeking()
    disconnectCurrentTime()
    removeStartTime()

    await loadTimes()

    if (!startTime) {
      return
    }

    observeSeeking()
    observeCurrentTime()
    appendStartTime()

    await chrome.runtime.sendMessage({
      type: 'set-start-time',
      data: formatISO(startTime),
    })
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type } = message
  switch (type) {
    case 'url-changed':
      init().then(() => sendResponse())
      return true
  }
})

init()
