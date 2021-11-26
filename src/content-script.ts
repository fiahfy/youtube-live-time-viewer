import browser from 'webextension-polyfill'
import { semaphore } from '@fiahfy/semaphore'
import { add, format, formatISO, parseISO } from 'date-fns'
import { parseTime, querySelectorAsync } from './utils'

const ClassName = {
  startTime: 'yltv-start-time',
  tooltip: 'yltv-tooltip',
}

const s = semaphore()
const isVideoUrl = () => new URL(location.href).pathname === '/watch'
let observer: MutationObserver | undefined
let startTime: Date | undefined
let endTime: Date | undefined

const fetchTimes = async () => {
  const res = await fetch(location.href)
  const text = await res.text()
  const doc = new DOMParser().parseFromString(text, 'text/html')

  const startDate = doc.querySelector<HTMLMetaElement>(
    'meta[itemprop=startDate]'
  )?.content
  startTime = startDate ? parseISO(startDate) : undefined

  const endDate = doc.querySelector<HTMLMetaElement>(
    'meta[itemprop=endDate]'
  )?.content
  endTime = endDate ? parseISO(endDate) : undefined
}

const removeStartTime = async () => {
  const wrapper = await querySelectorAsync(
    'ytd-video-primary-info-renderer > #container > #info > #info-text'
  )
  if (!wrapper) {
    return
  }

  const label = document.querySelector(`.${ClassName.startTime}`)
  label && label.remove()
}

const addStartTime = async () => {
  if (!startTime) {
    return
  }

  const wrapper = await querySelectorAsync(
    'ytd-video-primary-info-renderer > #container > #info > #info-text'
  )
  if (!wrapper) {
    return
  }

  let label = document.querySelector(`.${ClassName.startTime}`)
  if (!label) {
    label = document.createElement('yt-formatted-string')
    label.classList.add(ClassName.startTime)
    wrapper.append(label)
  }
  label.textContent = `(Started at ${format(startTime, 'PP, p')})`
}

const disconnectSeeking = () => {
  observer?.disconnect()
  const tooltip = document.querySelector(`.${ClassName.tooltip}`)
  tooltip && tooltip.remove()
}

const observeSeeking = () => {
  const wrapper = document.querySelector(
    '.html5-video-player > div > .ytp-tooltip-text-wrapper'
  )
  if (!wrapper) {
    return
  }

  const tooltip = wrapper.querySelector('.ytp-tooltip-text')
  if (!tooltip) {
    return
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const addedNodes = Array.from(mutation.addedNodes)
      if (
        addedNodes.length &&
        wrapper.parentElement?.classList.contains('ytp-preview') &&
        startTime
      ) {
        const duration = parseTime(addedNodes[0].textContent ?? '')
        if (!duration) {
          return
        }
        const target = endTime ? startTime : new Date()
        const time = add(target, duration)
        let tooltip = document.querySelector(`.${ClassName.tooltip}`)
        if (!tooltip) {
          tooltip = document.createElement('span')
          tooltip.classList.add(ClassName.tooltip)
          wrapper.append(tooltip)
        }
        tooltip.textContent = `(${format(time, 'pp')})`
      }
      const removedNodes = Array.from(mutation.removedNodes)
      if (removedNodes.length) {
        const tooltip = document.querySelector(`.${ClassName.tooltip}`)
        tooltip && tooltip.remove()
      }
    })
  })
  observer.observe(tooltip, { childList: true })
}

const init = async () => {
  if (!isVideoUrl()) {
    return
  }

  await s.acquire(async () => {
    await removeStartTime()
    disconnectSeeking()

    await fetchTimes()

    if (!startTime) {
      return
    }

    await browser.runtime.sendMessage({
      id: 'sendStartTime',
      data: formatISO(startTime),
    })

    await addStartTime()
    observeSeeking()
  })
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
