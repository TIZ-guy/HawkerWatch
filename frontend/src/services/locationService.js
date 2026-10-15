// The user's location and distances. Used by Near me, the Explore Map distance filter and the report location check.

// Resolves to { lat, lng, accuracy } (accuracy in metres).
// fresh: true asks for a new reading instead of one the browser remembered, which reports need.
export function getCurrentPosition({ fresh = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser does not support location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission is blocked. Allow location for this site in your browser and try again.'
          : "We couldn't get your location. Please try again."
      )),
      { timeout: 15000, maximumAge: fresh ? 0 : 5 * 60 * 1000, enableHighAccuracy: fresh }
    )
  })
}

// Straight-line distance in km between { lat, lng } and a GeoJSON point ([lng, lat]).
export function distanceKm(from, point) {
  if (!from || !point?.coordinates) return null
  const [lng, lat] = point.coordinates
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(lat - from.lat)
  const dLng = toRad(lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// "350 m" or "1.2 km"
export function formatDistance(km) {
  if (km == null) return ''
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// Choices for "within X km", shared by the home page and Explore Map.
export const DISTANCE_OPTIONS_KM = [1, 5, 10]
export const DEFAULT_DISTANCE_KM = 5
