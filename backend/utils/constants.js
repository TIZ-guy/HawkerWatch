// Shared values used by models, controllers and the frontend contract.
export const STATUS_VALUES = ['OPEN', 'TEMPORARILY_CLOSED', 'SHORT_QUEUE', 'MODERATE_QUEUE', 'LONG_QUEUE']
export const ROLES = ['user', 'admin']

export const REPORT_TTL_MINUTES = 60
export const DUPLICATE_WINDOW_MINUTES = 15

export const COMMENT_MAX_LENGTH = 500

// Reports must be sent from within this distance of the hawker centre (unless REPORT_LOCATION_CHECK=off)
export const REPORT_MAX_DISTANCE_METRES = 200
