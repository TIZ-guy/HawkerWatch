// How each food update looks in the UI. Keys match FOOD_UPDATE_VALUES in backend/utils/constants.js.
export const FOOD_UPDATE_DISPLAY = {
  SOLD_OUT: { label: 'Sold out', icon: 'bi-slash-circle' },
  SOME_SOLD_OUT: { label: 'Some items sold out', icon: 'bi-exclamation-circle' },
  QUALITY_NOT_GREAT: { label: 'Quality not great today', icon: 'bi-hand-thumbs-down' }
}

export const FOOD_UPDATE_ORDER = Object.keys(FOOD_UPDATE_DISPLAY)

// Keep in step with FOOD_UPDATE_NOTE_MAX_LENGTH in backend/utils/constants.js.
export const FOOD_UPDATE_NOTE_MAX_LENGTH = 140

export function foodUpdateDisplay(type) {
  return FOOD_UPDATE_DISPLAY[type] || { label: 'Update', icon: 'bi-info-circle' }
}
