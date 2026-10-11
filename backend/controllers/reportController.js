import StatusReport from '../models/StatusReport.js'
import Stall from '../models/Stall.js'
import { STATUS_VALUES, DUPLICATE_WINDOW_MINUTES } from '../utils/constants.js'
import {
  duplicateCutoff,
  isExpired,
  isHidden,
  isLive,
  calculateConfidence
} from '../utils/reportUtils.js'

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

// POST /api/reports   body: { stallId, status }
export async function submitReport(req, res) {
  const { stallId, status } = req.body ?? {}

  if (!isObjectId(stallId)) return fail(res, 400, 'A valid stallId is required')
  if (typeof status !== 'string' || !STATUS_VALUES.includes(status)) {
    return fail(res, 400, `status must be one of: ${STATUS_VALUES.join(', ')}`)
  }

  const stall = await Stall.findById(stallId).select('hawkerCentre')
  if (!stall) return fail(res, 404, 'Stall not found')

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
    hawkerCentre: stall.hawkerCentre, // taken from the stall, never from the request
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