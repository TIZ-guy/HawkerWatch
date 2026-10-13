export const STATUS_DISPLAY = {
  OPEN: { label: 'Open', badgeClass: 'text-bg-success', icon: 'bi-check-circle' },
  SHORT_QUEUE: { label: 'Short queue', badgeClass: 'text-bg-info', icon: 'bi-person' },
  MODERATE_QUEUE: { label: 'Moderate queue', badgeClass: 'text-bg-warning', icon: 'bi-people' },
  LONG_QUEUE: { label: 'Long queue', badgeClass: 'text-bg-danger', icon: 'bi-people-fill' },
  TEMPORARILY_CLOSED: { label: 'Temporarily closed', badgeClass: 'text-bg-secondary', icon: 'bi-x-circle' }
}

export const STATUS_ORDER = Object.keys(STATUS_DISPLAY)

const UNKNOWN_STATUS = { label: 'Unknown', badgeClass: 'text-bg-light', icon: 'bi-question-circle' }

export function statusDisplay(status) {
  return STATUS_DISPLAY[status] || UNKNOWN_STATUS
}
