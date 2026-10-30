// How each community status looks in the UI. Keys match STATUS_VALUES in backend/utils/constants.js.
// qClass: coloured dot + label (StatusBadge's default); pillClass: soft pill for dense rows;
// dotColor: the same colour as a CSS value, e.g. for map markers (see cssColor in utils/colors.js).
export const STATUS_DISPLAY = {
  OPEN: { label: 'Open', qClass: 'hw-q-open', pillClass: 'hw-pill-open', dotColor: 'var(--q-open)', icon: 'bi-check-circle' },
  SHORT_QUEUE: { label: 'Short queue', qClass: 'hw-q-short', pillClass: 'hw-pill-short', dotColor: 'var(--q-short)', icon: 'bi-person' },
  MODERATE_QUEUE: { label: 'Moderate queue', qClass: 'hw-q-mod', pillClass: 'hw-pill-mod', dotColor: 'var(--q-mod)', icon: 'bi-people' },
  LONG_QUEUE: { label: 'Long queue', qClass: 'hw-q-long', pillClass: 'hw-pill-long', dotColor: 'var(--q-long)', icon: 'bi-people-fill' },
  TEMPORARILY_CLOSED: { label: 'Temporarily closed', qClass: 'hw-q-shut', pillClass: 'hw-pill-shut', dotColor: 'var(--q-shut)', icon: 'bi-x-circle' }
}

export const STATUS_ORDER = Object.keys(STATUS_DISPLAY)

const UNKNOWN_STATUS = { label: 'Unknown', qClass: 'hw-q-shut', pillClass: 'hw-pill-shut', dotColor: 'var(--q-shut)', icon: 'bi-question-circle' }

export function statusDisplay(status) {
  return STATUS_DISPLAY[status] || UNKNOWN_STATUS
}
