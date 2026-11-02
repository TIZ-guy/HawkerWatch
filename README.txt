================================================================================
HAWKERWATCH
================================================================================

HawkerWatch helps diners in Singapore check a hawker centre before they travel.
It combines official NEA closure dates with live, community-reported stall queues.


================================================================================
1. LINKS
================================================================================

Deployed app:  <TO BE ADDED>
GitHub repo:   https://github.com/TIZ-guy/HawkerWatch
               (private; instructors must be added as collaborators)


================================================================================
2. PREREQUISITES
================================================================================

- Node.js 22 or newer
- pnpm. Install it once with:  npm install -g pnpm
- A MongoDB Atlas connection string (URI). In Atlas, also allow your computer's
  IP address under Network Access.


================================================================================
3. SETUP
================================================================================

Step 1: Clone the repo and install all dependencies (the same on every system)

    git clone https://github.com/TIZ-guy/HawkerWatch.git
    cd HawkerWatch
    pnpm install:all

Step 2: Copy the environment files

    macOS / Linux:

        cp backend/.env.example backend/.env
        cp frontend/.env.example frontend/.env

    Windows PowerShell:

        Copy-Item backend/.env.example backend/.env
        Copy-Item frontend/.env.example frontend/.env

Step 3: Edit backend/.env

    You must fill in:

        MONGO_URI        Your MongoDB Atlas connection string.
        JWT_SECRET       Any long random text. It signs the login cookie.

    Already set for local use (leave as they are):

        PORT             API port. 3000.
        NODE_ENV         development for local use.
        FRONTEND_URL     Address allowed to call the API. http://localhost:5173.

    Optional (commented out; remove the # to use one):

        MONGO_DB_NAME            Database name. Default: hawker-watch.
        HAWKER_IMPORT_ON_START   Set to off to stop the NEA import on start-up.
        REPORT_LOCATION_CHECK    Set to off to report from away from a centre.
                                 Normally reports need you to be within 200 m.
        SEED_DEMO_PASSWORD       Password for the demo login made by pnpm seed.
        LOGIN_RATE_LIMIT_MAX     Failed logins per IP in 15 minutes. Default 10.
        COMMENT_RATE_LIMIT_MAX   Comments per IP in 15 minutes. Default 10.
        REVIEW_RATE_LIMIT_MAX    Reviews per IP in 15 minutes. Default 10.
        PHOTO_RATE_LIMIT_MAX     Photo uploads per IP in 15 minutes. Default 20.
        GEOCODE_RATE_LIMIT_MAX   Place searches per IP in 15 minutes. Default 100.
        REPORT_RATE_LIMIT_MAX    Reports per IP in 15 minutes. Default 10.
        STALL_RATE_LIMIT_MAX     Stalls added per IP in 15 minutes. Default 10.

Step 4: frontend/.env

    Nothing to fill in for local use. Its one variable is optional:

        VITE_API_URL     Full API address, only if the API is hosted elsewhere.
                         Leave it unset locally: Vite forwards /api to the backend.

Step 5: Load the data

    Import the NEA hawker centres and closures (needs internet), then the stalls:

        pnpm import:centres
        pnpm import:stalls

    Optional: pnpm seed also adds demo reports, reviews and favourites.
    WARNING: pnpm seed deletes everything in the database named by MONGO_DB_NAME,
    including all accounts. Only use it on your own empty database.


================================================================================
4. HOW TO RUN
================================================================================

    pnpm dev

This starts the frontend and backend together. Then open:

    App:        http://localhost:5173
    API:        http://localhost:3000
    API docs:   http://localhost:5173/api/docs   (interactive Swagger UI)


================================================================================
5. TESTING
================================================================================

There are 311 automated tests in three suites.

    Suite                  Tool                  Files   Tests   Needs MongoDB?
    ---------------------  --------------------  -----   -----   --------------
    Unit (frontend)        Vitest, jsdom            11      95   No
    API / integration      node:test                20     193   No
    End-to-end (E2E)       Playwright, Chromium      7      23   Yes

5.1 Commands (run from the repo root)

    Unit tests:

        pnpm test:unit

    API / integration tests:

        pnpm test

    E2E tests:

        pnpm --dir frontend exec playwright install chromium   (first time only)
        pnpm test:e2e

    Open the Playwright report from the last E2E run:

        pnpm --dir frontend exec playwright show-report

    Lint the frontend (ESLint):

        pnpm lint

    pnpm test:e2e starts its own servers, so do not start pnpm dev first. It
    reads MONGO_URI and JWT_SECRET from backend/.env, and needs ports 3100 and
    5174 to be free.

5.2 E2E tests (frontend/e2e/)

    auth.spec.js - Journey 1: register, log in, log out (4 tests)
      - A new user can register, log out and log back in
      - A wrong password is refused
      - An email that already has an account cannot register again
      - A logged-out visitor is sent to log in and returned afterwards

    home-search.spec.js - Journey 2: search and filter centres (6 tests)
      - Searching by name or address narrows the list
      - Searching for a dish finds the stall that sells it
      - A search with no matches shows a message and can be cleared
      - Open today hides a centre that is closed today
      - Has live updates shows only centres with a live report
      - A cuisine chip shows only centres with that cuisine

    hawker-centre.spec.js - Journey 3: open a hawker centre page (3 tests)
      - A centre page shows its details, stalls and live status
      - Searching within a centre narrows its stalls
      - A closed centre shows the official closure

    community-report.spec.js - Journey 4: submit a community report (2 tests)
      - A diner at the centre can report a queue and everyone can see it
      - A diner more than 200 m away is refused

    favourites.spec.js - Journey 5: favourite a centre, set a reminder (4 tests)
      - A saved centre and its reminder appear on Saved and Profile
      - A reminder needs at least one day and a time
      - Removing a favourite takes it off the Saved page
      - A logged-out visitor is sent to log in when saving

    map.spec.js - Journey 6: map page (1 test)
      - The map shows a marker for every centre and a centre can be selected

    add-stall.spec.js - Journey 7: add a stall to a hawker centre (3 tests)
      - A new stall appears in the list and stays after a reload
      - The same stall name cannot be added twice
      - A logged-out visitor is sent to log in first

5.3 API / integration tests (backend/tests/)

    File                       Tests   What it covers
    -------------------------  -----   -----------------------------------------
    auth.test.js                  29   Tokens, register, login, account changes
    comments.test.js              14   Centre comments
    db.test.js                     1   Database name selection
    e2eGuard.test.js               1   Guard accepts only the E2E database
    errorMiddleware.test.js        3   Shared error responses
    favourites.test.js            15   Favourites list, add, reminder, delete
    geocode.test.js                4   Postal code and place search
    hawkerApi.test.js             12   Centre and stall API
    hawkerImport.test.js           9   NEA data import
    hawkerUtils.test.js            5   Search helpers, live reports
    health.test.js                 1   Health endpoint
    loginRateLimit.test.js         1   Failed-login limit
    models.test.js                10   Database schema rules
    openapi.test.js                2   API docs match the real routes
    passwordRules.test.js          5   Password rules
    reportLocation.test.js         6   200 m report location check
    reportUtils.test.js           11   Report expiry and flags
    reviews.test.js               35   Reviews and review photos
    stalls.test.js                19   Adding, editing and removing stalls
    twoFactor.test.js             10   Two-factor login
    -------------------------  -----
    Total                        193

5.4 Unit tests (frontend/src/**/__tests__/)

    File                       Tests   What it covers
    -------------------------  -----   -----------------------------------------
    FilterChips.spec.js            8   Filter chip selection
    PlaceSearch.spec.js            4   Postal code search box
    ReminderBell.spec.js           3   Navbar reminder bell
    StatusBadge.spec.js            7   Queue status badge
    locationService.spec.js       13   Distance and browser location
    useFavouriteStore.spec.js      9   Favourites store
    alerts.spec.js                16   Reminder text
    closures.spec.js               9   Closure dates
    passwordRules.spec.js          9   Password rules
    reminders.spec.js              5   Working out which reminders are due
    time.spec.js                  12   Time formatting
    -------------------------  -----
    Total                         95

5.5 How the tests are designed

    Separate E2E database and guard
      E2E tests only use a database named hawker-watch-e2e. Before each run,
      backend/scripts/seedE2e.js clears it and adds a small, fixed set of
      centres, stalls, a user and a report (backend/scripts/e2eFixtures.js).
      A guard (backend/utils/e2eGuard.js) throws an error unless the database
      name is exactly hawker-watch-e2e. It checks before connecting and again
      after connecting, so the seed cannot touch any other database.
      The data needs no internet, and the NEA import is turned off for test runs.

    Stable selectors
      Tests find elements with getByTestId (data-testid attributes) and getByRole,
      not CSS classes, so styling changes do not break them. There is one
      exception: map markers are drawn by Leaflet and cannot carry a data-testid,
      so map.spec.js finds them with the CSS locator path.leaflet-interactive
      inside the map-container test id.

    Repeatability
      - The E2E database is reset before every run.
      - Each test creates its own user with a unique, timestamped email, so reruns
        do not clash.
      - Tests run one at a time, because they share one database.
      - There are no fixed waits; tests wait for what they expect to see.
      - Requests to outside services (map tiles, web fonts) are blocked, so results
        do not depend on the internet.
      - Playwright geolocation stands in for the phone's location.
      - E2E servers use their own ports and never reuse a running server, so a
        test run cannot attach to a pnpm dev server using another database.

    Mocking in backend tests
      API tests start the real Express app on a free port and call it over HTTP,
      so routes, login checks and error handling all run for real. Database calls
      are replaced with t.mock.method on the Mongoose models, so these tests need
      no MongoDB and run the same way everywhere.

    CI workflow (.github/workflows/ci.yml)
      Runs on every push and pull request, with two jobs:
      - validate: installs dependencies, then runs lint, the frontend build, the
        unit tests and the API / integration tests.
      - e2e: runs the E2E tests against a mongo:7 service container, so it needs
        no secrets, then uploads the Playwright HTML report as an artifact.


================================================================================
6. TEST ACCOUNTS
================================================================================

<TO BE ADDED>


================================================================================
7. KNOWN LIMITATIONS
================================================================================

- Stall data is partly simulated and partly community-added, because no public
  stall API exists. Sample stalls are not real businesses.
- Reminders show in the navbar bell, but no email or push notifications are sent.


================================================================================
8. AI USAGE
================================================================================

AI tools were used to help brainstorm ideas for this project.
