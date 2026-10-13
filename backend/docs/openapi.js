import { STATUS_VALUES, REPORT_TTL_MINUTES, DUPLICATE_WINDOW_MINUTES } from '../utils/constants.js'
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
| [OneMap](https://www.onemap.gov.sg/apidocs/) search API | Turning a postal code or address into coordinates | Backend only, \`services/oneMapService.js\`; needs \`ONEMAP_TOKEN\` | Planned (stub ready) |
| [data.gov.sg / NEA](https://data.gov.sg/datasets/d_bda4baa634dd1cc7a6c7cad5f19e2d68/view) | Official hawker centre cleaning and works closures | Backend import, \`npm run import:closures\` | Planned |
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
    { name: 'Stalls' },
    { name: 'Reports', description: `Community status reports. Each expires after ${REPORT_TTL_MINUTES} minutes.` },
    { name: 'Favourites', description: 'Saved stalls and centres, with optional reminder preferences.' }
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token', description: 'Set by POST /api/auth/login or /api/auth/register.' }
    },
    schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string', example: 'Please log in to continue' } } },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Demo Diner' },
          email: { type: 'string', example: 'diner@example.com' },
          role: { type: 'string', enum: ['user', 'admin'] },
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
          name: { type: 'string', example: 'Kampong Demo Food Centre' },
          address: { type: 'string', example: '1 Demo Road' },
          postalCode: { type: 'string', example: '100001' },
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
          hawkerCentre: { description: 'Centre id, or { _id, name, address } on /api/stalls endpoints', oneOf: [{ type: 'string' }, { type: 'object' }] },
          name: { type: 'string', example: 'Ah Demo Chicken Rice' },
          unitNumber: { type: 'string', example: '01-01' },
          cuisine: { type: 'string', example: 'Chicken rice' },
          isActive: { type: 'boolean' },
          liveReport: ref('LiveReport')
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
      Alert: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', example: true },
          days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: '0 = Sunday', example: [1, 5] },
          time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '11:30' }
        }
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
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['currentPassword', 'newPassword'] }, { currentPassword: 'Hawker#Run1', newPassword: 'Hawker#Run2' }) },
        responses: { 200: ok('Password changed', { type: 'object' }), 400: error('Wrong current password or the new one breaks a rule'), 401: notLoggedIn }
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
        parameters: [id('id', 'Centre id'), query('search', 'Part of the stall name'), query('cuisine', 'Part of the cuisine')],
        responses: { 200: ok('Stalls', { type: 'array', items: ref('Stall') }), 404: error('Centre not found') }
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

    '/api/stalls': {
      get: {
        tags: ['Stalls'],
        summary: 'Search stalls across all centres',
        parameters: [query('search', 'Part of the stall name', { type: 'string', example: 'laksa' }), query('cuisine', 'Part of the cuisine')],
        responses: { 200: ok('Stalls, each with its centre name and address', { type: 'array', items: ref('Stall') }) }
      }
    },
    '/api/stalls/{id}': {
      get: { tags: ['Stalls'], summary: 'Get one stall with its newest live report', parameters: [id('id', 'Stall id')], responses: { 200: ok('Stall', ref('Stall')), 404: error('Not found') } }
    },
    '/api/stalls/{id}/reports': {
      get: { tags: ['Stalls'], summary: "A stall's live reports, newest first", parameters: [id('id', 'Stall id')], responses: { 200: ok('Reports', { type: 'array', items: ref('LiveReport') }), 404: error('Stall not found') } }
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
        description: `One report per user per stall every ${DUPLICATE_WINDOW_MINUTES} minutes. Each IP can submit 10 reports per 15 minutes.`,
        ...loginRequired,
        requestBody: { required: true, ...json({ type: 'object', required: ['stallId', 'status'], properties: { stallId: { type: 'string' }, status: { type: 'string', enum: STATUS_VALUES } } }, { stallId: '64b7f0c2a1b2c3d4e5f60719', status: 'SHORT_QUEUE' }) },
        responses: {
          201: ok('Report saved', { type: 'object', properties: { report: ref('Report') } }),
          400: error('Invalid stallId or status'),
          401: notLoggedIn,
          404: error('Stall not found'),
          409: error(`Already reported this stall in the last ${DUPLICATE_WINDOW_MINUTES} minutes`),
          429: error('Too many reports')
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
    }
  }
}
