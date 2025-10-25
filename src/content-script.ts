import { semaphore } from '@fiahfy/semaphore'
import { add, type Duration, format, formatISO, parseISO, sub } from 'date-fns'
import type { Settings } from '~/models'
import { addDuration, parseTime } from '~/utils'
import '~/content-script.css'

const ClassName = {
  currentTime: 'yltv-current-time',
  startTime: 'yltv-start-time',
  tooltip: 'yltv-tooltip',
}

let settings: Settings
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

  const tooltip = wrapper.querySelector('.ytp-tooltip-text')
  if (!tooltip) {
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
          el.classList.add(...tooltip.classList)
          wrapper.append(el)
        }
        el.textContent = `(${format(time, settings.timeFormat === '12h' ? 'h:mm:ss a' : 'H:mm:ss')})`
      }
      const [removedNode] = mutation.removedNodes
      if (removedNode) {
        const el = document.querySelector(`.${ClassName.tooltip}`)
        el?.remove()
      }
    }
  })
  seekingObserver.observe(tooltip, { childList: true })
}

const disconnectCurrentTime = () => {
  currentTimeObserver?.disconnect()
  const el = document.querySelector(`.${ClassName.currentTime}`)
  el?.remove()
}

const observeCurrentTime = () => {
  const timeDisplay = document.querySelector<HTMLElement>(
    '.html5-video-player .ytp-chrome-bottom > .ytp-chrome-controls > .ytp-left-controls > .ytp-time-display',
  )
  if (!timeDisplay) {
    return
  }
  const timeContents = timeDisplay.querySelector(
    '.ytp-time-wrapper > .ytp-time-contents',
  )
  const timeCurrent = timeContents?.querySelector('.ytp-time-current')
  if (!timeContents || !timeCurrent) {
    return
  }
  const timeDuration = timeContents?.querySelector('.ytp-time-duration')
  const totalDuration = parseTime(timeDuration?.textContent ?? '')

  timeDisplay.onclick = () => {
    if (endTime) {
      return
    }
    const badge = timeContents.querySelector<HTMLElement>('.ytp-live-badge')
    if (badge) {
      badge.click()
    }
  }

  currentTimeObserver = new MutationObserver((mutations) => {
    for (const _mutation of mutations) {
      if (!startTime) {
        return
      }
      let duration: Duration | undefined = parseTime(timeCurrent.textContent)
      if (!duration) {
        return
      }
      if (
        duration &&
        timeCurrent.textContent.charAt(0) === '-' &&
        totalDuration
      ) {
        duration = addDuration(duration, totalDuration)
      }

      const time = add(startTime, duration)
      let el = timeContents.querySelector(`.${ClassName.currentTime}`)
      if (!el) {
        el = document.createElement('span')
        el.classList.add(ClassName.currentTime)
        timeContents.append(el)
      }
      let text = `(${format(time, settings.timeFormat === '12h' ? 'h:mm:ss a' : 'H:mm:ss')})`
      if (!endTime) {
        text = ` • ${timeCurrent.textContent} ${text}`
      }
      el.textContent = text
    }
  })
  currentTimeObserver.observe(timeCurrent, { childList: true })
}

const removeStartTime = () => {
  const el = document.querySelector(`.${ClassName.startTime}`)
  el?.remove()
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

  let el = document.querySelector(`.${ClassName.startTime}`)
  if (!el) {
    el = document.createElement('span')
    el.classList.add(ClassName.startTime, 'yt-formatted-string', 'bold')
    wrapper.append(el)
  }
  el.textContent = `(${format(startTime, settings.timeFormat === '12h' ? 'PP h:mm:ss a' : 'PP H:mm:ss')}) `
}

const init = async (shouldLoad: boolean) => {
  if (!isVideoUrl()) {
    return
  }

  await s.acquire(async () => {
    disconnectSeeking()
    disconnectCurrentTime()
    removeStartTime()

    if (shouldLoad) {
      await loadTimes()
    }

    if (!startTime) {
      return
    }

    observeSeeking()
    observeCurrentTime()
    appendStartTime()
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, data } = message
  switch (type) {
    case 'url-changed':
      init(true).then(() => sendResponse())
      return true
    case 'settings-changed':
      settings = data.settings
      init(false).then(() => sendResponse())
      return true
    case 'start-time-requested':
      new Promise((resolve) => {
        const expireTime = Date.now() + 10000
        const timer = setInterval(() => {
          if (startTime || Date.now() > expireTime) {
            clearInterval(timer)
            resolve(startTime ? formatISO(startTime) : undefined)
          }
        }, 100)
      }).then((data) => sendResponse(data))
      return true
  }
})

chrome.runtime.sendMessage({ type: 'content-loaded' }).then(async (data) => {
  settings = data.settings
  await init(true)
})
