// Shared values used by models, controllers and the frontend contract.
export const STATUS_VALUES = ['OPEN', 'TEMPORARILY_CLOSED', 'SHORT_QUEUE', 'MODERATE_QUEUE', 'LONG_QUEUE']

// Stall cuisine categories. Kept deliberately short so the filter chips stay usable.
// The frontend has its own copy in frontend/src/utils/cuisines.js - keep them in step.
export const CUISINE_VALUES = [
    'Chinese', 'Malay', 'Indian', 'Peranakan', 'Western', 'Japanese',
    'Korean', 'Thai', 'Vietnamese', 'Dessert', 'Drinks', 'Others'
]
export const SPECIALITY_MAX_LENGTH = 60
export const ROLES = ['user', 'admin']

export const REPORT_TTL_MINUTES = 60
export const DUPLICATE_WINDOW_MINUTES = 15

export const COMMENT_MAX_LENGTH = 500
export const REVIEW_TEXT_MAX_LENGTH = 500
export const MAX_REVIEW_PHOTOS = 4
// Reviews count for this long after they are posted or their stars or text are last edited
export const REVIEW_TTL_DAYS = 90
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2 MB per photo; the frontend shrinks photos well below this

// Reports must be sent from within this distance of the hawker centre (unless REPORT_LOCATION_CHECK=off)
export const REPORT_MAX_DISTANCE_METRES = 200
