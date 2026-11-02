import FoodUpdate from '../models/FoodUpdate.js'
import Stall from '../models/Stall.js'
import {
  FOOD_UPDATE_VALUES,
  FOOD_UPDATE_NOTE_MAX_LENGTH,
  DUPLICATE_WINDOW_MINUTES,
  REPORT_MAX_DISTANCE_METRES
} from '../utils/constants.js'
import { duplicateCutoff } from '../utils/reportUtils.js'
import { cleanNote, isExpired, isHidden, isLive } from '../utils/foodUpdateUtils.js'
import { distanceMetres, formatMetres, isCoordinate } from '../utils/geo.js'

// Food updates use the same location check as status reports (REPORT_LOCATION_CHECK=off turns both off).
const locationCheckOn = () => process.env.REPORT_LOCATION_CHECK !== 'off'

const fail = (res, status, message) => res.status(status).json({ success: false, message })

// A real MongoDB id is 24 hex characters. Checking the type too stops objects
// like { "$ne": null } from being slipped into a query.
const isObjectId = (value) => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)

// What the frontend gets for each update. We send the flag count, not the list of users who flagged it.
const toPublicUpdate = (update) => ({
  id: update._id,
  stall: update.stall,
  hawkerCentre: update.hawkerCentre,
  type: update.type,
  note: update.note ?? null,
  createdAt: update.createdAt,
  expiresAt: update.expiresAt,
  flagCount: update.flaggedBy?.length ?? 0
})

// POST /api/food-updates   body: { stallId, type, note?, lat, lng }
// lat and lng are the reporter's position. They are only used for the distance check, never stored.
export async function submitFoodUpdate(req, res) {
  const { stallId, type, note, lat, lng } = req.body ?? {}

  if (!isObjectId(stallId)) return fail(res, 400, 'A valid stallId is required')
  if (typeof type !== 'string' || !FOOD_UPDATE_VALUES.includes(type)) {
    return fail(res, 400, `type must be one of: ${FOOD_UPDATE_VALUES.join(', ')}`)
  }
  const cleaned = cleanNote(note)
  if (cleaned === undefined) return fail(res, 400, 'note must be text')
  if (cleaned && cleaned.length > FOOD_UPDATE_NOTE_MAX_LENGTH) {
    return fail(res, 400, `note can be at most ${FOOD_UPDATE_NOTE_MAX_LENGTH} characters`)
  }

  const stall = await Stall.findById(stallId).select('hawkerCentre').populate('hawkerCentre', 'name location')
  if (!stall) return fail(res, 404, 'Stall not found')

  if (locationCheckOn()) {
    if (!isCoordinate(lat, lng)) {
      return fail(res, 400, 'Turn on location so we can check you are at the hawker centre')
    }
    const centre = stall.hawkerCentre
    const coordinates = centre?.location?.coordinates
    if (coordinates?.length === 2) {
      const metres = distanceMetres({ lat, lng }, coordinates)
      if (metres > REPORT_MAX_DISTANCE_METRES) {
        return fail(
          res,
          403,
          `You need to be at ${centre.name} to update this stall. You seem to be about ${formatMetres(metres)} away.`
        )
      }
    }
  }

  // Duplicate rule: one food update per user per stall within the window
  const duplicate = await FoodUpdate.exists({
    user: req.user._id,
    stall: stall._id,
    createdAt: { $gte: duplicateCutoff() }
  })
  if (duplicate) {
    return fail(res, 409, `You already updated this stall's food in the last ${DUPLICATE_WINDOW_MINUTES} minutes`)
  }

  const update = await FoodUpdate.create({
    stall: stall._id,
    hawkerCentre: stall.hawkerCentre._id ?? stall.hawkerCentre, // taken from the stall, never from the request
    user: req.user._id,
    type,
    note: cleaned
  })

  res.status(201).json({ success: true, data: { foodUpdate: toPublicUpdate(update) } })
}

// GET /api/food-updates?stallId=...   or   ?hawkerCentreId=...
// Live food updates (newest first). Expired and hidden ones are left out.
export async function listFoodUpdates(req, res) {
  const { stallId, hawkerCentreId } = req.query

  if (stallId === undefined && hawkerCentreId === undefined) {
    return fail(res, 400, 'Provide a stallId or a hawkerCentreId')
  }
  if (stallId !== undefined && !isObjectId(stallId)) return fail(res, 400, 'Invalid stallId')
  if (hawkerCentreId !== undefined && !isObjectId(hawkerCentreId)) {
    return fail(res, 400, 'Invalid hawkerCentreId')
  }

  const filter = { expiresAt: { $gt: new Date() } }
  if (stallId) filter.stall = stallId
  if (hawkerCentreId) filter.hawkerCentre = hawkerCentreId

  const found = await FoodUpdate.find(filter).sort({ createdAt: -1 }).limit(200).lean()
  const foodUpdates = found.filter((update) => isLive(update)).map(toPublicUpdate)

  res.json({ success: true, data: { foodUpdates } })
}

// POST /api/food-updates/:id/flag
export async function flagFoodUpdate(req, res) {
  const { id } = req.params
  if (!isObjectId(id)) return fail(res, 400, 'Invalid food update id')

  const update = await FoodUpdate.findById(id)
  if (!update) return fail(res, 404, 'Food update not found')

  const userId = String(req.user._id)
  if (String(update.user) === userId) return fail(res, 400, 'You cannot flag your own update')
  if (isExpired(update)) return fail(res, 400, 'This update has already expired')
  if (update.flaggedBy.some((u) => String(u) === userId)) {
    return fail(res, 409, 'You already flagged this update')
  }

  // $addToSet means the same user can never be added twice, even on a double click
  const updated = await FoodUpdate.findByIdAndUpdate(
    id,
    { $addToSet: { flaggedBy: req.user._id } },
    { new: true }
  )

  res.json({
    success: true,
    data: { flagCount: updated.flaggedBy.length, hidden: isHidden(updated) }
  })
}
