import AdminAction from '../models/AdminAction.js'

// Adds an entry to the admin activity log (models/AdminAction.js).
// `admin` is req.user; `target` is { type, id, user } (all optional), user being whose post or account it was.
// The action has already happened by the time this runs, so a logging failure is only printed, never sent
// to the admin as an error.
// Usage: await logAdminAction(req.user, 'stall.approve', `Approved stall "${stall.name}"`, { type: 'Stall', id: stall._id, user: stall.addedBy })
export async function logAdminAction(admin, action, summary, target = {}) {
  try {
    await AdminAction.create({
      admin: admin._id,
      action,
      summary,
      targetType: target.type,
      targetId: target.id,
      subjectUser: target.user
    })
  } catch (error) {
    console.error(`Could not log admin action ${action}: ${error.message}`)
  }
}

// The start of a post's text for the log, e.g. '"Rubbish food, wouldn't go ..."'
export function quote(text, length = 60) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return `"${clean.length > length ? `${clean.slice(0, length).trimEnd()}...` : clean}"`
}

// 'LONG_QUEUE' -> 'long queue'
export const readable = (value) => String(value).toLowerCase().replace(/_/g, ' ')
