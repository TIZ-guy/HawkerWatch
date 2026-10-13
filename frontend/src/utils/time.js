const MINUTE = 60 * 1000

export function timeAgo(date, now = Date.now()) {
  const minutes = Math.floor((now - new Date(date)) / MINUTE)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function timeUntil(date, now = Date.now()) {
  const minutes = Math.ceil((new Date(date) - now) / MINUTE)
  if (minutes <= 0) return 'expired'
  if (minutes < 60) return `in ${minutes} min`
  return `in ${Math.round(minutes / 60)} h`
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}
