import StatusReport from '../models/StatusReport.js'
import Stall from '../models/Stall.js'
import { STATUS_VALUES, DUPLICATE_WINDOW_MINUTES, REPORT_MAX_DISTANCE_METRES } from '../utils/constants.js'
import {
  duplicateCutoff,
  isExpired,
  isHidden,
  isLive,
  calculateConfidence,
  FLAG_HIDE_THRESHOLD
} from '../utils/reportUtils.js'
import { distanceMetres, formatMetres, isCoordinate } from '../utils/geo.js'

// Set REPORT_LOCATION_CHECK=off in backend/.env to test or demo away from a hawker centre.
const locationCheckOn = () => process.env.REPORT_LOCATION_CHECK !== 'off'

const RECENT_LIMIT = 50

const fail = (res, status, message) => res.status(status).json({ success: false, message })

// A real MongoDB id is 24 hex characters. Checking the type too stops objects
// like { "$ne": null } from being slipped into a query.
const isObjectId = (value) => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)

// What the frontend gets for each report. We send the flag count, not the list
// of users who flagged it.
const toPublicReport = (report) => ({
  id: report._id,
  stall: report.stall,
  hawkerCentre: report.hawkerCentre,
  status: report.status,
  createdAt: report.createdAt,
  expiresAt: report.expiresAt,
  flagCount: report.flaggedBy?.length ?? 0
})

// POST /api/reports   body: { stallId, status, lat, lng }
// lat and lng are the reporter's position. They are only used for the distance check, never stored.
export async function submitReport(req, res) {
  const { stallId, status, lat, lng } = req.body ?? {}

  if (!isObjectId(stallId)) return fail(res, 400, 'A valid stallId is required')
  if (typeof status !== 'string' || !STATUS_VALUES.includes(status)) {
    return fail(res, 400, `status must be one of: ${STATUS_VALUES.join(', ')}`)
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
          `You need to be at ${centre.name} to report this stall. You seem to be about ${formatMetres(metres)} away.`
        )
      }
    }
  }

  // Duplicate rule: one report per user per stall within the window
  const duplicate = await StatusReport.exists({
    user: req.user._id,
    stall: stall._id,
    createdAt: { $gte: duplicateCutoff() }
  })
  if (duplicate) {
    return fail(
      res,
      409,
      `You already reported this stall in the last ${DUPLICATE_WINDOW_MINUTES} minutes`
    )
  }

  const report = await StatusReport.create({
    stall: stall._id,
    hawkerCentre: stall.hawkerCentre._id ?? stall.hawkerCentre, // taken from the stall, never from the request
    user: req.user._id,
    status
  })

  res.status(201).json({ success: true, data: { report: toPublicReport(report) } })
}

// GET /api/reports?stallId=...   or   ?hawkerCentreId=...
// Returns live reports (newest first). With a stallId it also returns the
// stall's current status and confidence.
export async function listReports(req, res) {
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

  const found = await StatusReport.find(filter).sort({ createdAt: -1 }).limit(200).lean()
  const live = found.filter((report) => isLive(report))

  const data = { reports: live.map(toPublicReport) }
  if (stallId) data.summary = calculateConfidence(live)

  res.json({ success: true, data })
}

// GET /api/reports/recent?status=LONG_QUEUE
// The newest live reports across every centre, with the stall and centre names, for the Community reports page.
export async function recentReports(req, res) {
  const { status } = req.query
  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    return fail(res, 400, `status must be one of: ${STATUS_VALUES.join(', ')}`)
  }

  const filter = {
    expiresAt: { $gt: new Date() },
    [`flaggedBy.${FLAG_HIDE_THRESHOLD - 1}`]: { $exists: false }
  }
  if (status) filter.status = status

  const found = await StatusReport.find(filter)
    .sort({ createdAt: -1 })
    .limit(RECENT_LIMIT)
    .populate('stall', 'name unitNumber cuisine')
    .populate('hawkerCentre', 'name')
    .lean()

  // A stall or centre deleted since the report was made comes back as null
  const reports = found.filter((report) => report.stall && report.hawkerCentre).map(toPublicReport)
  res.json({ success: true, data: { reports } })
}

// GET /api/reports/settings
// Lets the frontend say whether reports need the user's location.
export function reportSettings(_req, res) {
  res.json({
    success: true,
    data: { locationCheck: locationCheckOn(), maxDistanceMetres: REPORT_MAX_DISTANCE_METRES }
  })
}

// POST /api/reports/:id/flag
export async function flagReport(req, res) {
  const { id } = req.params
  if (!isObjectId(id)) return fail(res, 400, 'Invalid report id')

  const report = await StatusReport.findById(id)
  if (!report) return fail(res, 404, 'Report not found')

  const userId = String(req.user._id)
  if (String(report.user) === userId) return fail(res, 400, 'You cannot flag your own report')
  if (isExpired(report)) return fail(res, 400, 'This report has already expired')
  if (report.flaggedBy.some((u) => String(u) === userId)) {
    return fail(res, 409, 'You already flagged this report')
  }

  // $addToSet means the same user can never be added twice, even on a double click
  const updated = await StatusReport.findByIdAndUpdate(
    id,
    { $addToSet: { flaggedBy: req.user._id } },
    { new: true }
  )

  res.json({
    success: true,
    data: { flagCount: updated.flaggedBy.length, hidden: isHidden(updated) }
  })
}