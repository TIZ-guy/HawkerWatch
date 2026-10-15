const EARTH_RADIUS_METRES = 6371000
const toRadians = (degrees) => (degrees * Math.PI) / 180

// Straight-line distance in metres between { lat, lng } and a GeoJSON [lng, lat] pair.
export function distanceMetres(from, coordinates) {
  const [lng, lat] = coordinates
  const dLat = toRadians(lat - from.lat)
  const dLng = toRadians(lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const isCoordinate = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

// "150 m" or "3.2 km"
export const formatMetres = (metres) => (metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`)
