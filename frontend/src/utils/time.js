const MINUTE = 60 * 1000

// "just now", "5 min ago", "2 h ago", "3 days ago"
export function timeAgo(date, now = Date.now()) {
  const minutes = Math.floor((now - new Date(date)) / MINUTE)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// "in 40 min", "in 1 h"; "expired" once the time has passed
export function timeUntil(date, now = Date.now()) {
  const minutes = Math.ceil((new Date(date) - now) / MINUTE)
  if (minutes <= 0) return 'expired'
  if (minutes < 60) return `in ${minutes} min`
  return `in ${Math.round(minutes / 60)} h`
}

// "Fri, 16 Oct"
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

// "10:42 am"
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}
