export const querySelectorAsync = (
  selector: string,
  interval = 100,
  timeout = 1000
): Promise<Element | null> => {
  return new Promise((resolve) => {
    const expireTime = Date.now() + timeout
    const timer = window.setInterval(() => {
      const e = document.querySelector(selector)
      if (e || Date.now() > expireTime) {
        clearInterval(timer)
        resolve(e)
      }
    }, interval)
  })
}

export const parseTime = (
  str: string
): { hours: number; minutes: number; seconds: number } | undefined => {
  const sign = str.charAt(0) === '-' ? -1 : 1
  const units = str
    .split(':')
    .map(Number)
    .map((i) => sign * Math.abs(i))
  const nan = units.some((u) => isNaN(u))
  if (nan) {
    return undefined
  }
  if (units.length === 3) {
    return { hours: units[0], minutes: units[1], seconds: units[2] }
  }
  if (units.length === 2) {
    return { hours: 0, minutes: units[0], seconds: units[1] }
  }
  return undefined
}
