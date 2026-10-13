export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser does not support location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow it in your browser to use "Near me".'
          : "We couldn't get your location. Please try again."
      )),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

export function distanceKm(from, point) {
  if (!from || !point?.coordinates) return null
  const [lng, lat] = point.coordinates
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(lat - from.lat)
  const dLng = toRad(lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km) {
  if (km == null) return ''
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
