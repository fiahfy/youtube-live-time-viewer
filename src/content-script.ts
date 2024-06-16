import { semaphore } from '@fiahfy/semaphore'
import { add, format, formatISO, parseISO } from 'date-fns'
import { parseTime, querySelectorAsync } from './utils'
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

const fetchTimes = async () => {
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

const removeStartTime = async () => {
  const label = document.querySelector(`.${ClassName.startTime}`)
  label && label.remove()
}

const appendStartTime = async () => {
  if (!startTime) {
    return
  }

  const wrapper = await querySelectorAsync(
    '#bottom-row > #description > #description-inner > #info-container > #info',
  )
  if (!wrapper) {
    return
  }

  let label = document.querySelector(`.${ClassName.startTime}`)
  if (!label) {
    label = document.createElement('span')
    label.classList.add(ClassName.startTime, 'yt-formatted-string', 'bold')
    wrapper.append(label)
  }
  label.textContent = `(${format(startTime, 'PPp')})`
}

const disconnectCurrentTime = () => {
  currentTimeObserver?.disconnect()
  const el = document.querySelector(`.${ClassName.currentTime}`)
  el && el.remove()
}

const observeCurrentTime = () => {
  const timeDisplay = document.querySelector(
    '.html5-video-player .ytp-chrome-bottom>.ytp-chrome-controls>.ytp-left-controls>.ytp-time-display',
  )
  const currentTime = timeDisplay?.querySelector('.ytp-time-current')
  if (!timeDisplay || !currentTime) {
    return
  }

  currentTimeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const [addedNode] = mutation.addedNodes
      if (!addedNode) {
        return
      }
      if (!startTime) {
        return
      }
      const duration = parseTime(addedNode.textContent ?? '')
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
    })
  })
  currentTimeObserver.observe(currentTime, { childList: true })
}

const disconnectSeeking = () => {
  seekingObserver?.disconnect()
  const el = document.querySelector(`.${ClassName.tooltip}`)
  el && el.remove()
}

const observeSeeking = () => {
  const wrapper = document.querySelector(
    '.html5-video-player > div > .ytp-tooltip-text-wrapper',
  )
  if (!wrapper) {
    return
  }

  const sourceTooltip = wrapper.querySelector('.ytp-tooltip-text')
  if (!sourceTooltip) {
    return
  }

  seekingObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
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
        tooltip && tooltip.remove()
      }
    })
  })
  seekingObserver.observe(sourceTooltip, { childList: true })
}

const init = async () => {
  if (!isVideoUrl()) {
    return
  }

  await s.acquire(async () => {
    await removeStartTime()
    disconnectSeeking()
    disconnectCurrentTime()

    await fetchTimes()

    if (!startTime) {
      return
    }

    await chrome.runtime.sendMessage({
      type: 'set-start-time',
      data: formatISO(startTime),
    })

    await appendStartTime()
    observeSeeking()
    if (endTime) {
      observeCurrentTime()
    }
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
