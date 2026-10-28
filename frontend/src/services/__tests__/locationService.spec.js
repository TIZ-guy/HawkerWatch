import { afterEach, describe, it, expect, vi } from 'vitest'
import { distanceKm, formatDistance, getCurrentPosition } from '@/services/locationService.js'

// Centres store their location as GeoJSON: coordinates are [longitude, latitude]
const KAMPONG = { lat: 1.3521, lng: 103.8198 }
const SEASIDE = { coordinates: [103.902, 1.3048] }

describe('distanceKm', () => {
  it('is 0 for the same place', () => {
    expect(distanceKm(KAMPONG, { coordinates: [KAMPONG.lng, KAMPONG.lat] })).toBeCloseTo(0)
  })

  it('measures one degree of latitude as about 111.2 km', () => {
    expect(distanceKm({ lat: 1, lng: 103 }, { coordinates: [103, 2] })).toBeCloseTo(111.19, 1)
  })

  it('works out the distance between two hawker centres', () => {
    expect(distanceKm(KAMPONG, SEASIDE)).toBeCloseTo(10.5, 0)
  })

  it('is null when either place is missing', () => {
    expect(distanceKm(null, SEASIDE)).toBeNull()
    expect(distanceKm(KAMPONG, {})).toBeNull()
  })
})

describe('formatDistance', () => {
  it.each([
    [0.35, '350 m'],
    [0.9994, '999 m'],
    [1.234, '1.2 km'],
    [10.5, '10.5 km'],
    [null, '']
  ])('%s km reads "%s"', (km, text) => {
    expect(formatDistance(km)).toBe(text)
  })
})

describe('getCurrentPosition', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves with the position from the browser', async () => {
    const getPosition = vi.fn((success) => success({ coords: { latitude: 1.3, longitude: 103.8, accuracy: 25 } }))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getPosition } })

    await expect(getCurrentPosition()).resolves.toEqual({ lat: 1.3, lng: 103.8, accuracy: 25 })
  })

  it('asks for a new reading, not a remembered one, when fresh is true', async () => {
    const getPosition = vi.fn((success) => success({ coords: { latitude: 1, longitude: 103, accuracy: 10 } }))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getPosition } })

    await getCurrentPosition({ fresh: true })
    expect(getPosition.mock.calls[0][2]).toEqual(expect.objectContaining({ maximumAge: 0, enableHighAccuracy: true }))
  })

  it('explains how to fix a blocked permission', async () => {
    const getPosition = vi.fn((_success, failure) => failure({ code: 1, PERMISSION_DENIED: 1 }))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getPosition } })

    await expect(getCurrentPosition()).rejects.toThrow(/Allow location for this site/)
  })

  it('says so when the browser has no location support', async () => {
    vi.stubGlobal('navigator', {})

    await expect(getCurrentPosition()).rejects.toThrow('Your browser does not support location.')
  })
})
