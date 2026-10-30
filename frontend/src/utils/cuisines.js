// Stall cuisine categories, in the order the filter chips show them.
// Must match CUISINE_VALUES in backend/utils/constants.js.
export const CUISINES = [
  'Chinese', 'Malay', 'Indian', 'Peranakan', 'Western', 'Japanese',
  'Korean', 'Thai', 'Vietnamese', 'Dessert', 'Drinks', 'Others'
]

// FilterChips wants [{ value, label }]
export const cuisineOptions = CUISINES.map((cuisine) => ({ value: cuisine, label: cuisine }))
