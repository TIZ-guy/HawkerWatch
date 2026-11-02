// Keeps the /api/docs page honest: every real route must be documented, and nothing documented may be missing.
import test from 'node:test'
import assert from 'node:assert/strict'
import openapi from '../docs/openapi.js'
import authRoutes from '../routes/authRoutes.js'
import hawkerCentreRoutes from '../routes/hawkerCentreRoutes.js'
import stallRoutes from '../routes/stallRoutes.js'
import favouriteRoutes from '../routes/favouriteRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'
import foodUpdateRoutes from '../routes/foodUpdateRoutes.js'
import reviewRoutes from '../routes/reviewRoutes.js'
import reviewPhotoRoutes from '../routes/reviewPhotoRoutes.js'
import commentRoutes from '../routes/commentRoutes.js'
import adminRoutes from '../routes/adminRoutes.js'
import geocodeRoutes from '../routes/geocodeRoutes.js'

// Same prefixes as app.js
const MOUNTED = {
  '/api/auth': authRoutes,
  '/api/hawker-centres': hawkerCentreRoutes,
  '/api/stalls': stallRoutes,
  '/api/favourites': favouriteRoutes,
  '/api/reports': reportRoutes,
  '/api/food-updates': foodUpdateRoutes,
  '/api/reviews': reviewRoutes,
  '/api/review-photos': reviewPhotoRoutes,
  '/api/comments': commentRoutes,
  '/api/admin': adminRoutes,
  '/api/geocode': geocodeRoutes
}

// Express writes ':id', OpenAPI writes '{id}'. Trailing '/' is dropped so '/api/stalls/' matches '/api/stalls'.
const toOpenApiPath = (prefix, path) => `${prefix}${path === '/' ? '' : path}`.replace(/:(\w+)/g, '{$1}')

function realRoutes() {
  const routes = ['GET /api/health']
  for (const [prefix, router] of Object.entries(MOUNTED)) {
    for (const layer of router.stack) {
      if (!layer.route) continue
      for (const method of Object.keys(layer.route.methods)) {
        routes.push(`${method.toUpperCase()} ${toOpenApiPath(prefix, layer.route.path)}`)
      }
    }
  }
  return routes.sort()
}

function documentedRoutes() {
  return Object.entries(openapi.paths)
    .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`))
    .sort()
}

test('every API route is documented on /api/docs, and every documented route exists', () => {
  assert.deepEqual(documentedRoutes(), realRoutes())
})

test('every documented operation has a summary and at least one response', () => {
  for (const [path, methods] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      assert.ok(operation.summary, `${method.toUpperCase()} ${path} needs a summary`)
      assert.ok(Object.keys(operation.responses || {}).length, `${method.toUpperCase()} ${path} needs responses`)
    }
  }
})
