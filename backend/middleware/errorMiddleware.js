export function notFound(_req, res) {
  res.status(404).json({ success: false, message: 'Route not found' })
}

// Express treats a middleware with four arguments as the error handler.
// Anything thrown in a route, or passed to next(err), ends up here.
export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || err.status || 500
  let message = err.message || 'Something went wrong'

  if (err.name === 'ValidationError') {
    status = 400
    message = Object.values(err.errors).map((e) => e.message).join(', ')
  } else if (err.name === 'CastError') {
    status = 400
    message = `Invalid ${err.path}`
  } else if (err.code === 11000) {
    status = 409
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ') || 'a unique field'}`
  } else if (err.name === 'MulterError') {
    // Upload problems found by multer (routes/reviewRoutes.js), e.g. a photo that is too big
    status = 400
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Each photo must be 2 MB or smaller'
    else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Too many photos, or photos sent in the wrong field'
  }

  if (status >= 500) {
    console.error(err)
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong'
  }

  res.status(status).json({ success: false, message })
}
