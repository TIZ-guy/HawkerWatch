// OpenAPI description of the HawkerWatch API, shown as an interactive page at /api/docs.
// When you add or change a route, update it here too: tests/openapi.test.js fails if a route is missing.
import { STATUS_VALUES, REPORT_TTL_MINUTES, DUPLICATE_WINDOW_MINUTES, FOOD_UPDATE_VALUES, FOOD_UPDATE_NOTE_MAX_LENGTH, REVIEW_TEXT_MAX_LENGTH, REPORT_MAX_DISTANCE_METRES, MAX_REVIEW_PHOTOS, COMMENT_MAX_LENGTH, CUISINE_VALUES, SPECIALITY_MAX_LENGTH } from '../utils/constants.js'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../utils/passwordRules.js'

const id = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'string', example: '64b7f0c2a1b2c3d4e5f60718' } })
const query = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema })
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example && { example }) } } })
const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const ok = (description, data) => ({
  description,
  ...json({ type: 'object', properties: { success: { type: 'boolean', example: true }, data } })
})
const error = (description) => ({ description, ...json(ref('Error')) })
const loginRequired = { security: [{ cookieAuth: [] }] }
const notLoggedIn = error('Not logged in')

const description = `
REST API behind the HawkerWatch app. Every response is \`{ success: true, data }\` or \`{ success: false, message }\`.

**Trying endpoints that need a login:** call **POST /api/auth/login** (or register) with *Try it out* first.
The browser then keeps the login cookie and sends it with the other requests on this page.

### Outside services HawkerWatch uses

| Service | Used for | Where | Status |
|---|---|---|---|
| [OneMap](https://www.onemap.gov.sg/apidocs/) map tiles (Singapore Land Authority) | The Explore Map basemap | Frontend, \`MapView.vue\`; public tiles, no token | In use |
| [OneMap](https://www.onemap.gov.sg/apidocs/) search API | Postal code and place search on the home page and Explore Map | Backend only, \`GET /api/geocode\` calls \`services/oneMapService.js\`; no token needed | In use |
| [data.gov.sg / NEA](https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view) | Every hawker centre (name, address, location, photo, stall count) and its cleaning and works closures | Backend import, \`pnpm import:centres\`; the server also refreshes it on start-up when it is over a week old | In use |
| Google Maps | "Directions" link on each centre page | Frontend link only; no API call | In use |
| MongoDB Atlas | Database | Backend, \`MONGO_URI\` | In use |
`

export default {
  openapi: '3.0.3',
  info: { title: 'HawkerWatch API', version: '0.1.0', description },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Accounts and login. Login uses an httpOnly cookie called `token`.' },
    { name: 'Hawker centres', description: 'Centres with official NEA closures, their stalls and community summaries.' },
    { name: 'Stalls', description: 'No official stall list exists, so stalls are added by logged-in users. The person who added a stall, or an admin, can edit it; admins can remove it.' },
    { name: 'Reports', description: `Community status reports. Each expires after ${REPORT_TTL_MINUTES} minutes.` },
    { name: 'Food updates', description: 'What the food is like at a stall today (sold out, some items sold out, quality not great). Each lasts until the end of the day in Singapore time.' },
    { name: 'Favourites', description: 'Saved stalls and centres, with optional reminder preferences.' },
    { name: 'Reviews', description: 'Star ratings (1 to 5) with an optional written review. One review per user per stall; authors can edit and delete their own, admins can delete any.' }
,
    { name: 'Comments', description: 'Comments on a hawker centre. Authors can edit and delete their own; admins can delete any.' },
    { name: 'Admin', description: 'Admin-only tools.' },
    { name: 'Location search', description: 'Postal code, address and place search, using OneMap.' }
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token', description: 'Set by POST /api/auth/login or /api/auth/register.' }
    },
    schemas: {
      Comment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          hawkerCentre: { type: 'string' },
          text: { type: 'string', maxLength: COMMENT_MAX_LENGTH, example: 'Go before 11:30, the lunch crowd builds quickly.' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Later than createdAt once the comment has been edited' },
          user: { type: 'object', nullable: true, description: 'The author, or null if their account was deleted', properties: { _id: { type: 'string' }, name: { type: 'string', example: 'Demo Diner' } } }
        }
      },
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Please log in to continue' } } },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Demo Diner' },
          email: { type: 'string', example: 'diner@example.com' },
          role: { type: 'string', enum: ['user', 'admin'] },
          bannedUntil: { type: 'string', format: 'date-time', nullable: true, description: 'Set while an admin has suspended or banned the user from posting (year 9999 for a permanent ban)' },
          banReason: { type: 'string' },
          twoFactorEnabled: { type: 'boolean', example: false },
          hasPassword: { type: 'boolean', example: true, description: 'false for accounts made with Google that have not set a password. Sent for the logged-in user only.' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Closure: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['CLEANING', 'OTHER_WORKS'] },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          remarks: { type: 'string', example: 'Quarterly cleaning' }
        }
      },
      HawkerCentre: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Adam Road Food Centre' },
          stallCount: { type: 'integer', example: 12, description: 'Stalls listed in HawkerWatch right now (on the list and single-centre endpoints)' },
          cuisines: { type: 'array', items: { type: 'string', enum: CUISINE_VALUES }, example: ['Chinese', 'Malay'], description: 'Cuisines of the listed stalls (list endpoint only)' },
          live: { type: 'object', nullable: true, description: 'Live community reports (list endpoint only); null when there are none', properties: { stallsReported: { type: 'integer', example: 2 }, latestStatus: { type: 'string', enum: STATUS_VALUES }, latestReportAt: { type: 'string', format: 'date-time' } } },
          address: { type: 'string', example: '2, Adam Road' },
          postalCode: { type: 'string', example: '289876' },
          description: { type: 'string', example: 'Built in 1974, Adam Food Centre comprises 32 cooked food stalls.' },
          photoUrl: { type: 'string', example: 'https://www.nea.gov.sg/images/default-source/Hawker-Centres-Division/resize_1267437914368.jpg' },
          foodStallCount: { type: 'integer', example: 32, description: 'Cooked food stalls, according to NEA' },
          sourceId: { type: 'string', example: '1', description: 'NEA serial number; missing on centres added by hand' },
          location: {
            type: 'object',
            description: 'GeoJSON point: coordinates are [longitude, latitude]',
            properties: { type: { type: 'string', example: 'Point' }, coordinates: { type: 'array', items: { type: 'number' }, example: [103.8198, 1.3521] } }
          },
          closures: { type: 'array', items: ref('Closure') }
        }
      },
      LiveReport: {
        type: 'object',
        nullable: true,
        properties: {
          _id: { type: 'string' },
          stall: { type: 'string' },
          hawkerCentre: { type: 'string' },
          status: { type: 'string', enum: STATUS_VALUES },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      },
      Stall: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          hawkerCentre: { description: 'Centre id, or { _id, name, address, location } on GET /api/stalls', oneOf: [{ type: 'string' }, { type: 'object' }] },
          name: { type: 'string', example: 'Ah Demo Chicken Rice' },
          unitNumber: { type: 'string', example: '01-01' },
          cuisine: { type: 'string', enum: CUISINE_VALUES, example: 'Chinese' },
          speciality: { type: 'string', maxLength: SPECIALITY_MAX_LENGTH, example: 'Chicken rice', description: 'The dish the stall is known for' },
          isActive: { type: 'boolean' },
          pendingApproval: { type: 'boolean', description: 'true while a stall added by a user waits for an admin to approve it' },
          addedBy: { type: 'string', description: 'Id of the user who added the stall' },
          liveReport: ref('LiveReport'),
          rating: ref('Rating')
        }
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          stall: { type: 'string' },
          hawkerCentre: { type: 'string' },
          status: { type: 'string', enum: STATUS_VALUES },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          flagCount: { type: 'integer', example: 0 }
        }
      },
      FoodUpdate: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          stall: { type: 'string' },
          hawkerCentre: { type: 'string' },
          type: { type: 'string', enum: FOOD_UPDATE_VALUES },
          note: { type: 'string', nullable: true, example: 'Only plain rice left' },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          flagCount: { type: 'integer', example: 0 }
        }
      },
      Alert: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', example: true },
          days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: '0 = Sunday', example: [1, 5] },
          time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '11:30' }
        }
      },
      Review: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          stall: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5, example: 4 },
          text: { type: 'string', maxLength: REVIEW_TEXT_MAX_LENGTH, example: 'Generous portions, the chilli is great.' },
          photos: { type: 'array', maxItems: MAX_REVIEW_PHOTOS, description: 'Photo ids; each image is at GET /api/review-photos/{id}', items: { type: 'string', example: '64b7f0c2a1b2c3d4e5f60740' } },
          createdAt: { type: 'string', format: 'date-time' },
          editedAt: { type: 'string', format: 'date-time', nullable: true, description: 'When the stars or text were last changed; null if never edited' },
          user: { type: 'object', nullable: true, description: 'The author, or null if their account was deleted', properties: { _id: { type: 'string' }, name: { type: 'string', example: 'Demo Diner' } } }
        }
      },
      Rating: {
        type: 'object',
        description: 'Average star rating (1 decimal place, null with no reviews) and number of reviews',
        properties: { average: { type: 'number', nullable: true, example: 4.3 }, count: { type: 'integer', example: 12 } }
      },
      Favourite: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          targetType: { type: 'string', enum: ['Stall', 'HawkerCentre'] },
          target: { description: 'The stall or centre (filled in on GET, an id otherwise)', oneOf: [{ type: 'string' }, ref('Stall'), ref('HawkerCentre')] },
          alert: ref('Alert')
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: { tags: ['Health'], summary: 'Check the API is running', responses: { 200: ok('API is up', { type: 'object', example: { service: 'HawkerWatch API', status: 'ok' } }) } }
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account and log in',
        description: `Password needs ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters, a capital letter and a special character. Emails and names must be unique (names ignoring capitals and extra spaces).`,
        requestBody: { required: true, ...json({ type: 'object', required: ['name', 'email', 'password'] }, { name: 'Demo Tester', email: 'tester@example.com', password: 'Hawker#Run1' }) },
        responses: {
          201: ok('Account created; login cookie set', { type: 'object', properties: { user: ref('User') } }),
          400: error('Missing fields or the password breaks a rule'),
          409: error('Email or name already taken')
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'After 10 failed attempts from one IP address in 15 minutes, further attempts get 429 until the window ends.',
        requestBody: { required: true, ...json({ type: 'object', required: ['email', 'password'] }, { email: 'tester@example.com', password: 'Hawker#Run1' }) },
        responses: {
          200: ok('Logged in; login cookie set', { type: 'object', properties: { user: ref('User') } }),
          401: error('Wrong email or password'),
          429: error('Too many failed attempts')
        }
      }
    },
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with Google',
        description: 'Send the ID token from the "Sign in with Google" button as `credential`. Logs into the account with that Google id or the same verified email, or creates one without a password. Accounts with two-factor login on get `{ twoFactorRequired: true, challengeToken }`, as with POST /api/auth/login.',
        requestBody: { required: true, ...json({ type: 'object', required: ['credential'] }, { credential: 'eyJhbGciOiJSUzI1NiIs...' }) },
        responses: {
          200: ok('Logged in; login cookie set', { type: 'object', properties: { user: ref('User') } }),
          400: error('credential missing'),
          401: error('Token invalid, expired, for another app, or email not verified by Google'),
          429: error('Too many failed attempts')
        }
      }
    },
    '/api/auth/me': {
      get: { tags: ['Auth'], summary: 'Get the logged-in user', ...loginRequired, responses: { 200: ok('Current user', { type: 'object', properties: { user: ref('User') } }), 401: notLoggedIn } },
      patch: {
        tags: ['Auth'],
        summary: 'Change your name',
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['name'] }, { name: 'New Name' }) },
        responses: { 200: ok('Name changed', { type: 'object', properties: { user: ref('User') } }), 400: error('Name missing'), 401: notLoggedIn, 409: error('Name taken by someone else') }
      }
    },
    '/api/auth/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change your password',
        description: 'Accounts made with Google that have no password yet (hasPassword false) can leave out currentPassword to set one.',
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['newPassword'] }, { currentPassword: 'Hawker#Run1', newPassword: 'Hawker#Run2' }) },
        responses: { 200: ok('Password changed', { type: 'object', properties: { user: ref('User') } }), 400: error('Wrong current password or the new one breaks a rule'), 401: notLoggedIn }
      }
    },
    '/api/auth/login/2fa': {
      post: {
        tags: ['Auth'],
        summary: 'Log in, step 2: two-factor code',
        description: 'For accounts with two-factor login on. POST /api/auth/login answers `{ twoFactorRequired: true, challengeToken }` instead of setting the cookie; send that token (valid 5 minutes) with the 6-digit code from the authenticator app. Wrong codes count towards the failed-login limit.',
        requestBody: { required: true, ...json({ type: 'object', required: ['challengeToken', 'code'] }, { challengeToken: 'eyJhbGciOi...', code: '123456' }) },
        responses: {
          200: ok('Logged in; login cookie set', { type: 'object', properties: { user: ref('User') } }),
          400: error('Code missing'),
          401: error('Wrong code, or the challenge token expired'),
          429: error('Too many failed attempts')
        }
      }
    },
    '/api/auth/2fa/setup': {
      post: {
        tags: ['Auth'],
        summary: 'Start turning on two-factor login',
        description: 'Returns a QR code (PNG data URL) and secret for an authenticator app. Two-factor login stays off until POST /api/auth/2fa/enable gets a correct code.',
        ...loginRequired,
        responses: {
          200: ok('Setup details', { type: 'object', properties: { secret: { type: 'string' }, otpauthUrl: { type: 'string' }, qrCode: { type: 'string' } } }),
          400: error('Already on'),
          401: notLoggedIn
        }
      }
    },
    '/api/auth/2fa/enable': {
      post: {
        tags: ['Auth'],
        summary: 'Turn on two-factor login',
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['code'] }, { code: '123456' }) },
        responses: { 200: ok('Two-factor login on', { type: 'object', properties: { user: ref('User') } }), 400: error('Wrong code, setup not started, or already on'), 401: notLoggedIn }
      }
    },
    '/api/auth/2fa/disable': {
      post: {
        tags: ['Auth'],
        summary: 'Turn off two-factor login',
        description: 'Accounts without a password (hasPassword false) only need the code.',
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['code'] }, { password: 'Hawker#Run1', code: '123456' }) },
        responses: { 200: ok('Two-factor login off', { type: 'object', properties: { user: ref('User') } }), 400: error('Wrong password or code, or already off'), 401: notLoggedIn }
      }
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Log out (clears the login cookie)', responses: { 200: ok('Logged out', { type: 'object' }) } }
    },

    '/api/hawker-centres': {
      get: {
        tags: ['Hawker centres'],
        summary: 'List or search hawker centres',
        description: 'A to Z by default. With lat and lng, only centres within the radius are returned, nearest first.',
        parameters: [
          query('search', 'Part of the name or address, ignoring capitals', { type: 'string', example: 'kampong' }),
          query('lat', 'Latitude for nearby search', { type: 'number', example: 1.3521 }),
          query('lng', 'Longitude for nearby search', { type: 'number', example: 103.8198 }),
          query('radius', 'Metres, default 2000', { type: 'number', example: 2000 })
        ],
        responses: { 200: ok('Centres', { type: 'array', items: ref('HawkerCentre') }), 400: error('Invalid lat, lng or radius') }
      }
    },
    '/api/hawker-centres/{id}': {
      get: { tags: ['Hawker centres'], summary: 'Get one centre with its official closures', parameters: [id('id', 'Centre id')], responses: { 200: ok('Centre', ref('HawkerCentre')), 400: error('Invalid id'), 404: error('Not found') } }
    },
    '/api/hawker-centres/{id}/stalls': {
      get: {
        tags: ['Hawker centres'],
        summary: "A centre's active stalls, each with its newest live report",
        parameters: [id('id', 'Centre id'), query('search', 'Part of the stall name or dish'), query('cuisine', 'Exact cuisine category', { type: 'string', enum: CUISINE_VALUES, example: 'Chinese' })],
        responses: { 200: ok('Stalls', { type: 'array', items: ref('Stall') }), 404: error('Centre not found') }
      },
      post: {
        tags: ['Stalls'],
        summary: 'Add a stall to a centre',
        description: 'Unit numbers look like 01-23 (a leading # is fine). Names and unit numbers must be unique within the centre. Each IP can add 10 stalls per 15 minutes.',
        ...loginRequired,
        parameters: [id('id', 'Centre id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 2, maxLength: 60 }, cuisine: { type: 'string', enum: CUISINE_VALUES }, speciality: { type: 'string', maxLength: SPECIALITY_MAX_LENGTH }, unitNumber: { type: 'string', example: '01-23' } } }, { name: 'Ah Hock Chicken Rice', cuisine: 'Chinese', speciality: 'Chicken rice', unitNumber: '01-23' }) },
        responses: {
          201: ok('Stall added', ref('Stall')),
          400: error('Name missing or too long, bad unit number, or an invalid id'),
          401: notLoggedIn,
          404: error('Centre not found'),
          409: error('A stall with that name or unit number already exists here'),
          429: error('Too many stalls added')
        }
      }
    },
    '/api/hawker-centres/{id}/reviews': {
      get: {
        tags: ['Reviews'],
        summary: "The newest current reviews across a centre's stalls (at most 20)",
        parameters: [id('id', 'Centre id')],
        responses: {
          200: ok('Reviews', { type: 'object', properties: { count: { type: 'integer', example: 3 }, reviews: { type: 'array', items: { allOf: [ref('Review'), { type: 'object', properties: { stall: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string', example: 'Hock Lam Chicken Rice' } } } } }] } } } }),
          400: error('Invalid id'),
          404: error('Centre not found')
        }
      }
    },
    '/api/hawker-centres/{id}/community-summary': {
      get: {
        tags: ['Hawker centres'],
        summary: 'Count of live reports by status for a centre',
        parameters: [id('id', 'Centre id')],
        responses: {
          200: ok('Summary', { type: 'object', example: { windowMinutes: REPORT_TTL_MINUTES, stallsReported: 3, byStatus: { OPEN: 1, LONG_QUEUE: 1, TEMPORARILY_CLOSED: 1 }, latestReportAt: '2026-10-11T12:38:31.558Z' } }),
          404: error('Centre not found')
        }
      }
    },

    '/api/hawker-centres/{id}/comments': {
      get: {
        tags: ['Comments'],
        summary: "A centre's comments, newest first",
        parameters: [id('id', 'Centre id')],
        responses: { 200: ok('Comments', { type: 'array', items: ref('Comment') }), 400: error('Invalid id'), 404: error('Centre not found') }
      },
      post: {
        tags: ['Comments'],
        summary: 'Comment on a centre',
        description: `Text is 1 to ${COMMENT_MAX_LENGTH} characters. Each IP can post 10 comments per 15 minutes.`,
        ...loginRequired,
        parameters: [id('id', 'Centre id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['text'], properties: { text: { type: 'string' } } }, { text: 'Plenty of seats on the second floor.' }) },
        responses: {
          201: ok('Comment posted', ref('Comment')),
          400: error('Text missing or too long, or an invalid id'),
          401: notLoggedIn,
          404: error('Centre not found'),
          429: error('Too many comments')
        }
      }
    },

    '/api/stalls': {
      get: {
        tags: ['Stalls'],
        summary: 'Search stalls across all centres',
        parameters: [query('search', 'Part of the stall name or dish', { type: 'string', example: 'laksa' }), query('cuisine', 'Exact cuisine category', { type: 'string', enum: CUISINE_VALUES, example: 'Chinese' })],
        responses: { 200: ok('Stalls, each with its centre name and address', { type: 'array', items: ref('Stall') }) }
      }
    },
    '/api/stalls/{id}': {
      get: { tags: ['Stalls'], summary: 'Get one stall with its newest live report, rating, and the centre location and closures', parameters: [id('id', 'Stall id')], responses: { 200: ok('Stall', ref('Stall')), 404: error('Not found, or removed') } },
      patch: {
        tags: ['Stalls'],
        summary: "Change a stall's details (the person who added it, or an admin)",
        description: 'Send only the fields to change. An empty cuisine, speciality or unitNumber clears it. cuisine must be one of the categories (any capitals).',
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        requestBody: { required: true, ...json({ type: 'object', properties: { name: { type: 'string', minLength: 2, maxLength: 60 }, cuisine: { type: 'string', enum: CUISINE_VALUES }, speciality: { type: 'string', maxLength: SPECIALITY_MAX_LENGTH }, unitNumber: { type: 'string', example: '01-23' } } }, { cuisine: 'Chinese', speciality: 'Roast duck rice', unitNumber: '01-24' }) },
        responses: {
          200: ok('Stall updated', ref('Stall')),
          400: error('Bad name or unit number, or an invalid id'),
          401: notLoggedIn,
          403: error('Not the person who added it, and not an admin'),
          404: error('Stall not found'),
          409: error('Another stall here has that name or unit number')
        }
      },
      delete: {
        tags: ['Stalls'],
        summary: 'Remove a stall (admins only)',
        description: 'The stall is hidden everywhere; its reviews and reports are kept.',
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        responses: {
          200: ok('Removed', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60719' } }),
          401: notLoggedIn,
          403: error('Not an admin'),
          404: error('Stall not found')
        }
      }
    },
    '/api/stalls/{id}/reports': {
      get: { tags: ['Stalls'], summary: "A stall's live reports, newest first", parameters: [id('id', 'Stall id')], responses: { 200: ok('Reports', { type: 'array', items: ref('LiveReport') }), 404: error('Stall not found') } }
    },
    '/api/stalls/{id}/reviews': {
      get: {
        tags: ['Reviews'],
        summary: "A stall's average rating and reviews, newest first",
        description: 'Only current reviews are included: those posted, or with stars or text edited, in the last 3 months. Each review has expiresAt.',
        parameters: [id('id', 'Stall id')],
        responses: {
          200: ok('Reviews', { type: 'object', properties: { average: { type: 'number', nullable: true, example: 4.3 }, count: { type: 'integer', example: 2 }, reviews: { type: 'array', items: ref('Review') } } }),
          400: error('Invalid id'),
          404: error('Stall not found')
        }
      },
      post: {
        tags: ['Reviews'],
        summary: 'Review a stall',
        description: `rating is a whole number from 1 to 5; text is optional, up to ${REVIEW_TEXT_MAX_LENGTH} characters. One review per user per stall. Each IP can post 10 reviews per 15 minutes.`,
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, text: { type: 'string' } } }, { rating: 4, text: 'Generous portions, the chilli is great.' }) },
        responses: {
          201: ok('Review posted', ref('Review')),
          400: error('Invalid rating, text or id'),
          401: notLoggedIn,
          404: error('Stall not found'),
          409: error('Already reviewed this stall'),
          429: error('Too many reviews')
        }
      }
    },

    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'Live reports for a stall or centre',
        description: 'Give stallId or hawkerCentreId. With stallId, also returns the stall\'s overall status and how confident it is.',
        parameters: [query('stallId', 'Stall id'), query('hawkerCentreId', 'Centre id')],
        responses: {
          200: ok('Reports', { type: 'object', properties: { reports: { type: 'array', items: ref('Report') }, summary: { type: 'object', nullable: true, example: { status: 'LONG_QUEUE', confidence: 45, level: 'medium', reportCount: 2, lastReportedAt: '2026-10-11T12:38:31.558Z' } } } }),
          400: error('Neither id given, or an invalid id')
        }
      },
      post: {
        tags: ['Reports'],
        summary: "Report a stall's status right now",
        description: `One report per user per stall every ${DUPLICATE_WINDOW_MINUTES} minutes. Each IP can submit 10 reports per 15 minutes. The reporter must be within ${REPORT_MAX_DISTANCE_METRES} m of the hawker centre: send their lat and lng, which are used for the check only and never stored. With REPORT_LOCATION_CHECK=off (testing and demos) the location isn't needed.`,
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['stallId', 'status'], properties: { stallId: { type: 'string' }, status: { type: 'string', enum: STATUS_VALUES }, lat: { type: 'number' }, lng: { type: 'number' } } }, { stallId: '64b7f0c2a1b2c3d4e5f60719', status: 'SHORT_QUEUE', lat: 1.3521, lng: 103.8198 }) },
        responses: {
          201: ok('Report saved', { type: 'object', properties: { report: ref('Report') } }),
          400: error('Invalid stallId or status, or no location sent'),
          401: notLoggedIn,
          403: error(`More than ${REPORT_MAX_DISTANCE_METRES} m from the hawker centre`),
          404: error('Stall not found'),
          409: error(`Already reported this stall in the last ${DUPLICATE_WINDOW_MINUTES} minutes`),
          429: error('Too many reports')
        }
      }
    },
    '/api/reports/recent': {
      get: {
        tags: ['Reports'],
        summary: 'Newest live reports across every centre',
        description: 'Up to 50, newest first, with the stall and centre names filled in. Expired and hidden reports are left out.',
        parameters: [query('status', 'Only this status', { type: 'string', enum: STATUS_VALUES })],
        responses: {
          200: ok('Reports', { type: 'object', properties: { reports: { type: 'array', items: ref('Report') } } }),
          400: error('Unknown status')
        }
      }
    },
    '/api/reports/settings': {
      get: {
        tags: ['Reports'],
        summary: 'Whether reports need the reporter to be at the centre',
        responses: { 200: ok('Settings', { type: 'object', example: { locationCheck: true, maxDistanceMetres: REPORT_MAX_DISTANCE_METRES } }) }
      }
    },
    '/api/reports/{id}': {
      delete: {
        tags: ['Reports'],
        summary: 'Delete a report (admins only)',
        description: 'Deletes the report for good, e.g. spam or an abusive report.',
        ...loginRequired,
        parameters: [id('id', 'Report id')],
        responses: {
          200: ok('Deleted', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60720' } }),
          400: error('Invalid id'),
          401: notLoggedIn,
          403: error('Not an admin'),
          404: error('Report not found')
        }
      }
    },
    '/api/reports/{id}/flag': {
      post: {
        tags: ['Reports'],
        summary: 'Flag a report as wrong',
        description: 'A report flagged by 3 different users is hidden.',
        ...loginRequired,
        parameters: [id('id', 'Report id')],
        responses: {
          200: ok('Flag counted', { type: 'object', example: { flagCount: 1, hidden: false } }),
          400: error('Invalid id, your own report, or already expired'),
          401: notLoggedIn,
          404: error('Report not found'),
          409: error('Already flagged by you')
        }
      }
    },

    '/api/food-updates': {
      get: {
        tags: ['Food updates'],
        summary: 'Live food updates for a stall or centre',
        description: 'Give stallId or hawkerCentreId. Newest first. Expired and hidden updates are left out.',
        parameters: [query('stallId', 'Stall id'), query('hawkerCentreId', 'Centre id')],
        responses: {
          200: ok('Food updates', { type: 'object', properties: { foodUpdates: { type: 'array', items: ref('FoodUpdate') } } }),
          400: error('Neither id given, or an invalid id')
        }
      },
      post: {
        tags: ['Food updates'],
        summary: "Say what the food is like at a stall today",
        description: `Same rules as status reports: one update per user per stall every ${DUPLICATE_WINDOW_MINUTES} minutes, 10 per IP per 15 minutes, and the reporter must be within ${REPORT_MAX_DISTANCE_METRES} m of the hawker centre (send lat and lng; used for the check only, never stored). The optional note can be at most ${FOOD_UPDATE_NOTE_MAX_LENGTH} characters.`,
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['stallId', 'type'], properties: { stallId: { type: 'string' }, type: { type: 'string', enum: FOOD_UPDATE_VALUES }, note: { type: 'string', maxLength: FOOD_UPDATE_NOTE_MAX_LENGTH }, lat: { type: 'number' }, lng: { type: 'number' } } }, { stallId: '64b7f0c2a1b2c3d4e5f60719', type: 'SOME_SOLD_OUT', note: 'No more fish balls', lat: 1.3521, lng: 103.8198 }) },
        responses: {
          201: ok('Food update saved', { type: 'object', properties: { foodUpdate: ref('FoodUpdate') } }),
          400: error('Invalid stallId, type or note, or no location sent'),
          401: notLoggedIn,
          403: error(`More than ${REPORT_MAX_DISTANCE_METRES} m from the hawker centre`),
          404: error('Stall not found'),
          409: error(`Already updated this stall in the last ${DUPLICATE_WINDOW_MINUTES} minutes`),
          429: error('Too many updates')
        }
      }
    },
    '/api/food-updates/{id}': {
      delete: {
        tags: ['Food updates'],
        summary: 'Delete a food update (admins only)',
        ...loginRequired,
        parameters: [id('id', 'Food update id')],
        responses: {
          200: ok('Deleted', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60721' } }),
          400: error('Invalid id'),
          401: notLoggedIn,
          403: error('Not an admin'),
          404: error('Food update not found')
        }
      }
    },
    '/api/food-updates/{id}/flag': {
      post: {
        tags: ['Food updates'],
        summary: 'Flag a food update as wrong',
        description: 'An update flagged by 3 different users is hidden.',
        ...loginRequired,
        parameters: [id('id', 'Food update id')],
        responses: {
          200: ok('Flag counted', { type: 'object', example: { flagCount: 1, hidden: false } }),
          400: error('Invalid id, your own update, or already expired'),
          401: notLoggedIn,
          404: error('Food update not found'),
          409: error('Already flagged by you')
        }
      }
    },

    '/api/favourites': {
      get: { tags: ['Favourites'], summary: 'Your favourites, newest first', ...loginRequired, responses: { 200: ok('Favourites', { type: 'array', items: ref('Favourite') }), 401: notLoggedIn } },
      post: {
        tags: ['Favourites'],
        summary: 'Save a stall or centre',
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['targetType', 'target'], properties: { targetType: { type: 'string', enum: ['Stall', 'HawkerCentre'] }, target: { type: 'string' } } }, { targetType: 'HawkerCentre', target: '64b7f0c2a1b2c3d4e5f60718' }) },
        responses: { 201: ok('Saved', ref('Favourite')), 400: error('Invalid type or id'), 401: notLoggedIn, 404: error('Stall or centre not found (or stall no longer active)'), 409: error('Already saved') }
      }
    },
    '/api/favourites/{id}/alert': {
      patch: {
        tags: ['Favourites'],
        summary: 'Set reminder preferences for a favourite',
        description: 'Only the fields sent are changed. Reminders are saved but not sent yet.',
        ...loginRequired,
        parameters: [id('id', 'Favourite id')],
        requestBody: { required: true, ...json(ref('Alert'), { enabled: true, days: [1, 5], time: '11:30' }) },
        responses: { 200: ok('Updated', ref('Favourite')), 400: error('Invalid days or time'), 401: notLoggedIn, 404: error('Not one of your favourites') }
      }
    },
    '/api/favourites/{id}': {
      delete: {
        tags: ['Favourites'],
        summary: 'Remove a favourite',
        ...loginRequired,
        parameters: [id('id', 'Favourite id')],
        responses: { 200: ok('Removed', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60720' } }), 401: notLoggedIn, 404: error('Not one of your favourites') }
      }
    },

    '/api/reviews/{id}': {
      patch: {
        tags: ['Reviews'],
        summary: 'Edit your review',
        ...loginRequired,
        parameters: [id('id', 'Review id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, text: { type: 'string' } } }, { rating: 5, text: 'Even better on a second visit.' }) },
        responses: {
          200: ok('Review updated', ref('Review')),
          400: error('Invalid rating, text or id'),
          401: notLoggedIn,
          403: error('Not your review'),
          404: error('Review not found')
        }
      },
      delete: {
        tags: ['Reviews'],
        summary: 'Delete a review (yours, or any review as an admin)',
        ...loginRequired,
        parameters: [id('id', 'Review id')],
        responses: {
          200: ok('Deleted', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60721' } }),
          401: notLoggedIn,
          403: error('Not your review, and not an admin'),
          404: error('Review not found')
        }
      }
    },
    '/api/reviews/{id}/photos': {
      post: {
        tags: ['Reviews'],
        summary: 'Add photos to your review',
        description: `Send multipart/form-data with the images in the field \`photos\`. JPEG, PNG or WebP, up to 2 MB each, at most ${MAX_REVIEW_PHOTOS} per review. Each IP can upload 20 times per 15 minutes.`,
        ...loginRequired,
        parameters: [id('id', 'Review id')],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
        responses: {
          201: ok('Photos added; the updated review', ref('Review')),
          400: error('No photos, not an image, too big, or too many'),
          401: notLoggedIn,
          403: error('Not your review'),
          404: error('Review not found'),
          429: error('Too many uploads')
        }
      }
    },
    '/api/reviews/{id}/photos/{photoId}': {
      delete: {
        tags: ['Reviews'],
        summary: 'Remove a photo from a review (yours, or any review as an admin)',
        ...loginRequired,
        parameters: [id('id', 'Review id'), id('photoId', 'Photo id')],
        responses: {
          200: ok('Removed', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60740' } }),
          401: notLoggedIn,
          403: error('Not your review, and not an admin'),
          404: error('Review or photo not found')
        }
      }
    },

    '/api/review-photos/{id}': {
      get: {
        tags: ['Reviews'],
        summary: 'A review photo (the image itself, for <img src>)',
        parameters: [id('id', 'Photo id')],
        responses: {
          200: { description: 'The image', content: { 'image/jpeg': {}, 'image/png': {}, 'image/webp': {} } },
          400: error('Invalid id'),
          404: error('Photo not found')
        }
      }
    }
,

    '/api/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Edit your comment',
        ...loginRequired,
        parameters: [id('id', 'Comment id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['text'], properties: { text: { type: 'string' } } }, { text: 'Plenty of seats on the second floor after 2pm.' }) },
        responses: {
          200: ok('Comment updated', ref('Comment')),
          400: error('Text missing or too long, or an invalid id'),
          401: notLoggedIn,
          403: error('Not your comment'),
          404: error('Comment not found')
        }
      },
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment (yours, or any comment as an admin)',
        ...loginRequired,
        parameters: [id('id', 'Comment id')],
        responses: {
          200: ok('Deleted', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60721' } }),
          401: notLoggedIn,
          403: error('Not your comment, and not an admin'),
          404: error('Comment not found')
        }
      }
    },

    '/api/admin/import-centres': {
      post: {
        tags: ['Admin'],
        summary: "Import NEA's hawker centres and closures from data.gov.sg now (admins only)",
        description: 'Updates existing centres and adds new ones; nothing is deleted. The server also does this by itself on start-up when the data is over a week old.',
        ...loginRequired,
        responses: {
          200: ok('Import finished', { type: 'object', example: { status: 'SUCCESS', recordsFetched: 123, recordsCreated: 0, recordsUpdated: 123, failed: [] } }),
          401: notLoggedIn,
          403: error('Not an admin'),
          502: error('data.gov.sg could not be reached')
        }
      }
    },

    '/api/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Counts for the admin page (admins only)',
        ...loginRequired,
        responses: {
          200: ok('Counts', { type: 'object', example: { pendingStalls: 2, listedStalls: 340, removedStalls: 3, users: 58, liveReports: 12, flaggedReports: 1 } }),
          401: notLoggedIn,
          403: error('Not an admin')
        }
      }
    },
    '/api/admin/stalls': {
      get: {
        tags: ['Admin'],
        summary: 'Stalls waiting for approval, listed, or removed (admins only)',
        description: 'Newest first, up to 100. Each stall includes hawkerCentre { _id, name } and addedBy { _id, name, email }.',
        ...loginRequired,
        parameters: [
          query('status', 'Which stalls (default pending)', { type: 'string', enum: ['pending', 'listed', 'removed'] }),
          query('search', 'Part of the stall name or dish')
        ],
        responses: {
          200: ok('Stalls', { type: 'array', items: ref('Stall') }),
          400: error('Unknown status'),
          401: notLoggedIn,
          403: error('Not an admin')
        }
      }
    },
    '/api/admin/stalls/{id}/approve': {
      post: {
        tags: ['Admin'],
        summary: 'Approve a stall a user added, so everyone can see it (admins only)',
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        responses: { 200: ok('Approved', ref('Stall')), 401: notLoggedIn, 403: error('Not an admin'), 404: error('No stall waiting for approval with that id') }
      }
    },
    '/api/admin/stalls/{id}/reject': {
      post: {
        tags: ['Admin'],
        summary: 'Reject a stall a user added; it is deleted (admins only)',
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        responses: { 200: ok('Rejected', { type: 'object', example: { id: '64b7f0c2a1b2c3d4e5f60719' } }), 401: notLoggedIn, 403: error('Not an admin'), 404: error('No stall waiting for approval with that id') }
      }
    },
    '/api/admin/stalls/{id}/restore': {
      post: {
        tags: ['Admin'],
        summary: 'Bring back a removed stall, with its reviews (admins only)',
        ...loginRequired,
        parameters: [id('id', 'Stall id')],
        responses: { 200: ok('Restored', ref('Stall')), 401: notLoggedIn, 403: error('Not an admin'), 404: error('No removed stall with that id'), 409: error('Another stall at the centre has that name now') }
      }
    },
    '/api/admin/reports': {
      get: {
        tags: ['Admin'],
        summary: 'Newest community reports, with who sent them (admins only)',
        description: 'Up to 100, expired ones included. Each report has user { _id, name, email }, flagCount, live and hidden.',
        ...loginRequired,
        parameters: [query('flagged', 'true for only reports flagged at least once', { type: 'string', enum: ['true'] })],
        responses: {
          200: ok('Reports', { type: 'object', properties: { reports: { type: 'array', items: { type: 'object' } }, hideThreshold: { type: 'integer', example: 3 } } }),
          401: notLoggedIn,
          403: error('Not an admin')
        }
      }
    },

    '/api/admin/food-updates': {
      get: {
        tags: ['Admin'],
        summary: 'Newest food updates, with who sent them (admins only)',
        description: 'Up to 100, expired ones included. Each has user { _id, name, email }, flagCount, live and hidden.',
        ...loginRequired,
        parameters: [query('flagged', 'true for only updates flagged at least once', { type: 'string', enum: ['true'] })],
        responses: { 200: ok('Food updates', { type: 'array', items: { type: 'object' } }), 401: notLoggedIn, 403: error('Not an admin') }
      }
    },
    '/api/admin/reviews': {
      get: {
        tags: ['Admin'],
        summary: 'Newest reviews, with who wrote them (admins only)',
        description: 'Up to 100. Each has stall { name, hawkerCentre { name } }, user { _id, name, email } and photoCount. Delete with DELETE /api/reviews/{id}.',
        ...loginRequired,
        responses: { 200: ok('Reviews', { type: 'array', items: { type: 'object' } }), 401: notLoggedIn, 403: error('Not an admin') }
      }
    },
    '/api/admin/comments': {
      get: {
        tags: ['Admin'],
        summary: 'Newest centre comments, with who wrote them (admins only)',
        description: 'Up to 100. Delete with DELETE /api/comments/{id}.',
        ...loginRequired,
        responses: { 200: ok('Comments', { type: 'array', items: { type: 'object' } }), 401: notLoggedIn, 403: error('Not an admin') }
      }
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Users, with their ban status and how much they have posted (admins only)',
        description: 'Newest first, up to 100. Each has banned, permanentBan and posts { reports, reviews, comments }.',
        ...loginRequired,
        parameters: [
          query('search', 'Part of the name or email'),
          query('filter', 'Only admins, or only banned users', { type: 'string', enum: ['admins', 'banned'] })
        ],
        responses: { 200: ok('Users', { type: 'array', items: ref('User') }), 401: notLoggedIn, 403: error('Not an admin') }
      }
    },
    '/api/admin/users/{id}/role': {
      patch: {
        tags: ['Admin'],
        summary: "Make a user an admin, or remove their admin role (admins only)",
        description: 'You cannot change your own role, so there is always an admin left.',
        ...loginRequired,
        parameters: [id('id', 'User id')],
        requestBody: { required: true, ...json({ type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['user', 'admin'] } } }, { role: 'admin' }) },
        responses: { 200: ok('Role changed', ref('User')), 400: error('Bad role, or your own account'), 401: notLoggedIn, 403: error('Not an admin'), 404: error('User not found') }
      }
    },
    '/api/admin/users/{id}/ban': {
      post: {
        tags: ['Admin'],
        summary: 'Suspend or ban a user from posting (admins only)',
        description: 'Banned users can still log in and browse, but cannot post reports, food updates, reviews, comments or stalls. Admins cannot be banned.',
        ...loginRequired,
        parameters: [id('id', 'User id')],
        requestBody: { required: true, ...json({ type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, nullable: true, description: 'null for a permanent ban' }, reason: { type: 'string', maxLength: 200 } } }, { days: 7, reason: 'Fake queue reports' }) },
        responses: { 200: ok('Banned', ref('User')), 400: error('Bad days or reason, your own account, or an admin'), 401: notLoggedIn, 403: error('Not an admin'), 404: error('User not found') }
      }
    },
    '/api/admin/users/{id}/unban': {
      post: {
        tags: ['Admin'],
        summary: 'Lift a ban (admins only)',
        ...loginRequired,
        parameters: [id('id', 'User id')],
        responses: { 200: ok('Unbanned', ref('User')), 400: error('Not banned'), 401: notLoggedIn, 403: error('Not an admin'), 404: error('User not found') }
      }
    },
    '/api/admin/activity': {
      get: {
        tags: ['Admin'],
        summary: 'The admin activity log (admins only)',
        description: 'Newest first, up to 100: who approved, removed, deleted or banned what, and when.',
        ...loginRequired,
        responses: {
          200: ok('Entries', { type: 'array', items: { type: 'object', example: { action: 'stall.approve', summary: 'Approved stall "Ah Hock"', admin: { name: 'HawkerWatch Admin' }, createdAt: '2026-11-03T04:00:00.000Z' } } }),
          401: notLoggedIn,
          403: error('Not an admin')
        }
      }
    },

    '/api/geocode': {
      get: {
        tags: ['Location search'],
        summary: 'Find a postal code, address or place in Singapore',
        description: 'Uses OneMap. Returns up to 5 places, best match first. Each IP can search 100 times per 15 minutes.',
        parameters: [query('q', 'Postal code, address or place name (2 to 60 characters)', { type: 'string', example: '289876' })],
        responses: {
          200: ok('Places', { type: 'array', items: { type: 'object', properties: { name: { type: 'string', example: 'ADAM FOOD CENTRE' }, address: { type: 'string', example: '2 ADAM ROAD ADAM FOOD CENTRE SINGAPORE 289876' }, postalCode: { type: 'string', nullable: true, example: '289876' }, lat: { type: 'number', example: 1.3241598 }, lng: { type: 'number', example: 103.8141659 } } } }),
          400: error('Search text missing, too short or too long'),
          429: error('Too many searches'),
          502: error('OneMap could not be reached')
        }
      }
    }
  }
}
