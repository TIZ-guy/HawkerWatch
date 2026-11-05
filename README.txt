================================================================================
HAWKERWATCH
================================================================================

HawkerWatch helps diners in Singapore check a hawker centre before they travel.

The problem: you can travel to a hawker centre and find it closed for cleaning, or find
that the stall you wanted has sold out or has a long queue. Official closure dates exist,
but they are hard to find, and nobody publishes live stall information.

What we built: HawkerWatch shows NEA's official closure dates for all hawker centres,
next to time-stamped community reports from diners who are at the centre right now
(queue length, stall open or closed, food sold out). Users can search and filter centres,
see them on a map, save favourites with reminders, add stalls, and leave reviews and
comments.

Contents

    1. Links and test account
    2. Set up the app on your computer
    3. How to run
    4. Testing
    5. Community reports and the 200 m rule
    6. Deployment
    7. Known limitations
    8. AI usage


================================================================================
1. LINKS AND TEST ACCOUNT
================================================================================

Deployed app:  https://hawkerwatch-1ahh.onrender.com
Backend API:   https://hawkerwatch-api.onrender.com/api   (health: /api/health)
GitHub repo:   https://github.com/TIZ-guy/HawkerWatch   (public)

The app is on free hosting. If nobody has used it for about 15 minutes, the first page
load (or the first login) can take about 50 seconds while the server wakes up. After that
it is fast.

Test account (on the deployed app):

    Email:         demo@hawkerwatch.test
    Password:      Demouser#2026
    Display name:  HawkerWatch Demo

You can also register your own account: click Log in, then Create an account.
Or click Continue with Google on the Log in page to log in with a Google account.

Note: this account only exists in the deployed database. On your own local copy, register
a new account (see section 2, step 7).


================================================================================
2. SET UP THE APP ON YOUR COMPUTER
================================================================================

The steps are the same on macOS and Windows unless a step shows two versions. On Windows,
use PowerShell. Run every command from the project folder (the folder that contains
README.txt, package.json, frontend and backend) unless the step says otherwise.

Step 1: Install the prerequisites

    a. Node.js 22 (LTS). Download it from https://nodejs.org and install it.
       Check it worked:

           node -v          (should print v22.something)

    b. pnpm, the package manager we use. Install it once:

           npm install -g pnpm

       Check it worked:

           pnpm -v

       Our package.json files ask for pnpm 12.12.1. pnpm switches to that version by
       itself, so any recent pnpm is fine.

       Windows only: if PowerShell says "running scripts is disabled on this system",
       run this once, then open a new PowerShell window and try again:

           Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

    c. Git (only if you clone the repo instead of using the zip): https://git-scm.com

Step 2: Get the project files

    Option A, from the submitted zip:
      Unzip it, then open a terminal (macOS) or PowerShell (Windows) in the unzipped
      folder. For example:

          cd ~/Downloads/HawkerWatch           (macOS)
          cd $HOME\Downloads\HawkerWatch       (Windows PowerShell)

    Option B, from GitHub:

          git clone https://github.com/TIZ-guy/HawkerWatch.git
          cd HawkerWatch

Step 3: Install the dependencies

    The project has three parts (root, frontend, backend), each with its own packages.
    This one command installs all three:

        pnpm install:all

    If pnpm prints "Ignored build scripts" for a package, you can ignore it. The app and
    the tests do not need those scripts.

Step 4: Get a MongoDB database

    The app needs a MongoDB database. A free MongoDB Atlas cluster is the easiest option.

    a. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
    b. Create a cluster. Choose the free tier (M0). Any region is fine; Singapore
       (ap-southeast-1) is closest.
    c. Create a database user. Atlas asks for this after the cluster is made (or go to
       Security > Database Access > Add New Database User). Pick "Password", enter a
       username and password, and keep them for step e. Use a password with only letters
       and numbers, so it does not need escaping in the connection string.
    d. Allow network access. Go to Security > Network Access > Add IP Address and either
       click "Add Current IP Address", or enter 0.0.0.0/0 to allow access from anywhere.
    e. Get the connection string. Go to Database > Clusters > Connect > Drivers. Copy the
       string. It looks like this:

           mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?appName=Cluster0

       Replace <username> and <password> with the user from step c. Remove the < > too.
       You will paste this into MONGO_URI in step 5.

    Local MongoDB also works. If you have MongoDB installed and running on your computer,
    use this instead:

           mongodb://127.0.0.1:27017

    You do not need to create the database or any collections. The app creates them.

Step 5: Create backend/.env

    Copy the example file:

        cp backend/.env.example backend/.env                (macOS)
        Copy-Item backend/.env.example backend/.env         (Windows PowerShell)

    Open backend/.env in a text editor. You must change two lines:

        MONGO_URI      Your connection string from step 4.
                       Example: mongodb+srv://hawkeruser:abc123@cluster0.abcde.mongodb.net/
                       The database name is set by MONGO_DB_NAME (below), not by this URI.
        JWT_SECRET     A long random string. It signs the login cookie. Make one with:

                           node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

                       and paste the output after JWT_SECRET=

    These are already set correctly for local use. Leave them as they are:

        PORT           Port the API runs on. Example: 3000
        NODE_ENV       development on your computer, production on the live server.
                       Example: development
        FRONTEND_URL   The address of the frontend, which is allowed to call the API.
                       Example: http://localhost:5173

    These are optional and commented out (they start with #). Remove the # to use one:

        MONGO_DB_NAME            Database name inside your cluster.
                                 Default: hawker-watch
        HAWKER_IMPORT_ON_START   Set to off to stop the automatic NEA import when the
                                 server starts (see step 6).
        REPORT_LOCATION_CHECK    Set to off to send reports from anywhere. By default
                                 you must be within 200 m of the centre (see section 5).
        SEED_DEMO_PASSWORD       Password for the demo login that pnpm seed creates.
                                 Default: Hawker#Run1
        LOGIN_RATE_LIMIT_MAX     Failed logins allowed per IP in 15 minutes. Default 10
        COMMENT_RATE_LIMIT_MAX   Comments per IP in 15 minutes. Default 10
        REVIEW_RATE_LIMIT_MAX    Reviews per IP in 15 minutes. Default 10
        PHOTO_RATE_LIMIT_MAX     Review photo uploads per IP in 15 minutes. Default 20
        GEOCODE_RATE_LIMIT_MAX   Postal code and place searches per IP in 15 minutes.
                                 Default 100
        REPORT_RATE_LIMIT_MAX    Community reports per IP in 15 minutes. Default 10
        STALL_RATE_LIMIT_MAX     Stalls added per IP in 15 minutes. Default 10
        GOOGLE_CLIENT_ID         Google OAuth client ID for Continue with Google.
                                 Default: the team's ID, built into
                                 backend/utils/googleAuth.js. Only set it to use
                                 your own (see section 6.4).

    The frontend needs no .env file for local use. frontend/.env.example has two optional
    variables. VITE_API_URL is only used when the API is on another server (see
    section 6); do not set it locally. VITE_GOOGLE_CLIENT_ID replaces the built-in Google
    client ID, and must match GOOGLE_CLIENT_ID in backend/.env (see section 6.4).

Step 6: Load the data

    Run these two commands, in this order:

        pnpm import:centres
        pnpm import:stalls

    a. pnpm import:centres imports all hawker centres and their official closure dates
       from NEA's dataset on data.gov.sg (no API key needed, but it needs internet). It
       takes a few seconds. It is safe to run again: centres are updated, never duplicated.
       (The backend also runs this import by itself when it starts and finds no centres,
       or data over a week old.)

    b. pnpm import:stalls adds the stalls. It needs the centres to exist first, because
       each stall is matched to its centre by NEA's serial number.

       It adds about 1,400 stalls from backend/data/stalls.json. There is no public API
       for hawker stalls, so most of these are simulated sample stalls, not real
       businesses (real stalls from food guides for 28 well-known centres, sample stalls
       for the rest). Logged-in users can add real stalls in the app. The import is safe
       to run again: it updates stalls instead of adding duplicates.

    WARNING: do not run pnpm seed unless you want a fresh start. It DELETES everything in
    the database (all accounts, reports, reviews and favourites) and then fills it with
    demo data, including a demo login demo@example.com / Hawker#Run1. Only use it on
    your own database. You do not need it to run or test the app.

Step 7: Create an account

    Start the app (section 3), open http://localhost:5173, click Log in, then Create an
    account. The deployed test account in section 1 does not exist in your local database.

    Optional: pnpm seed:demo adds fresh live reports, today's food updates and the
    sample reviews without deleting anything, recent centre comments, 3 stalls
    waiting for an admin to approve them, a user suspended for spam and past
    entries in the admin activity log, plus two logins if they are missing:
    demo@example.com and demo2fa@example.com, both with password Hawker#Run1. The
    second has two-factor login on: in an authenticator app, choose Enter a setup key
    and enter HAWKERWATCHDEMO2. Reports expire after 60 minutes, so run it shortly
    before trying the app.


================================================================================
3. HOW TO RUN
================================================================================

From the project folder:

    pnpm dev

This starts the backend (API) and the frontend together in one terminal. Wait until you
see "MongoDB connected" and "HawkerWatch API listening on port 3000", then open:

    App (home page):   http://localhost:5173
    API docs:          http://localhost:3000/api/docs   (Swagger UI, with Try it out)
    Health check:      http://localhost:3000/api/health

Stop both with Ctrl+C.

If the backend says "MONGO_URI is not set" or cannot connect, check backend/.env (step 5)
and Atlas network access (step 4d).

Things to try: search for a centre or a dish on the home page (Discover), use the Open
today and Has live updates filters, open a centre page, open the Map page, save a centre
with the heart button and set a reminder, add a stall, and send a community report (see
section 5).


================================================================================
4. TESTING
================================================================================

We have 407 automated tests in three suites.

    Suite                       Tool                         Files   Tests   Needs MongoDB?
    --------------------------  ---------------------------  -----   -----   --------------
    Backend API / integration   node:test (built into Node)     24     266   No
    Frontend unit / component   Vitest, Vue Test Utils, jsdom   14     115   No
    End-to-end (E2E)            Playwright, Chromium             8      26   Yes
    --------------------------  ---------------------------  -----   -----   --------------
    Total                                                       46     407

What each suite tests:

    - Backend API / integration tests start the real Express app and send real HTTP
      requests to it, so routes, login checks, validation and error handling all run.
      Database calls are mocked (see 4.6), so no database is needed.
    - Frontend unit / component tests check helper functions, the Pinia store, and Vue
      components mounted in a fake browser page (jsdom).
    - E2E tests open the real app in a Chromium browser, with the real backend and a real
      database, and click through the main user journeys like a user would.

4.1 Commands (run from the project folder)

    Backend API / integration tests:

        pnpm test

    Frontend unit / component tests:

        pnpm test:unit

    Lint the frontend code (ESLint):

        pnpm lint

    E2E tests. The first time only, download the Chromium browser Playwright uses:

        pnpm --dir frontend exec playwright install chromium

    Then run the tests:

        pnpm test:e2e

    Open the HTML report from the last E2E run (it opens in your browser):

        pnpm --dir frontend exec playwright show-report

    Before running E2E tests:

    - backend/.env must have MONGO_URI and JWT_SECRET (section 2, step 5). Atlas or local
      MongoDB both work.
    - The E2E tests only write to a separate database called hawker-watch-e2e, never to
      your normal database (see 4.6).
    - pnpm test:e2e starts its own backend and frontend, so stop pnpm dev first, or at
      least make sure ports 3100 and 5174 are free.
    - No internet is needed apart from reaching your database. The NEA import is turned
      off and outside requests (map tiles, fonts) are blocked during the tests.

4.2 E2E tests (frontend/e2e/): the 8 user journeys

    auth.spec.js - Journey 1: register, log in and log out (4 tests)
      - A new user can register, log out and log back in
      - A wrong password is refused
      - An email that already has an account cannot register again
      - A logged-out visitor is sent to log in and returned afterwards

    home-search.spec.js - Journey 2: search and filter hawker centres (7 tests)
      - Searching by name or address narrows the list
      - Searching for a dish finds the stall that sells it
      - A search with no matches shows a message and can be cleared
      - Open today hides a centre that is closed today
      - Has live updates shows only centres with a live report
      - A cuisine chip shows only centres with that cuisine
      Journey 2b: stall results nearest first
      - Stalls at the closest centre come first, and A to Z sorts by name

    hawker-centre.spec.js - Journey 3: open a hawker centre page (3 tests)
      - A centre page shows its details, stalls and live status
      - Searching within a centre narrows its stalls
      - A closed centre shows the official closure

    community-report.spec.js - Journey 4: submit a community report (2 tests)
      - A diner at the centre can report a queue and everyone can see it
      - A diner more than 200 m away is refused

    favourites.spec.js - Journey 5: favourite a centre and set a reminder (4 tests)
      - A saved centre and its reminder appear on Saved and Profile
      - A reminder needs at least one day and a time
      - Removing a favourite takes it off the Saved page
      - A logged-out visitor is sent to log in when saving

    map.spec.js - Journey 6: map page (1 test)
      - The map shows a marker for every centre and a centre can be selected

    add-stall.spec.js - Journey 7: add a stall to a hawker centre (3 tests)
      - A new stall is sent for approval instead of appearing straight away
      - The same stall name cannot be added twice, even while the first waits for approval
      - A logged-out visitor is sent to log in first

    admin.spec.js - Journey 8: admin page (2 tests)
      - Approve, moderate, suspend, and see it all in the activity log
      - Action buttons line up on every row, however long the details are

4.3 Backend API / integration tests (backend/tests/)

    File                        Tests   What it covers
    --------------------------  -----   ------------------------------------------------
    admin.test.js                  28   Stall approval, bans, moderation, activity log
    auth.test.js                   36   Tokens, register, login, account changes
    comments.test.js               14   Centre comments
    db.test.js                      1   Choosing the database name
    e2eGuard.test.js                1   Guard only accepts the E2E database
    errorMiddleware.test.js         3   Shared error responses
    favourites.test.js             15   Favourites list, add, reminder, delete
    foodUpdates.test.js            11   Food updates: expiry, submit checks, flagging
    geocode.test.js                 4   Postal code and place search
    googleLogin.test.js            11   Google login, setting a first password
    hawkerApi.test.js              12   Centre and stall API
    hawkerImport.test.js            9   NEA data import
    hawkerUtils.test.js             5   Search helpers, live reports
    health.test.js                  1   Health endpoint
    loginRateLimit.test.js          1   Failed-login limit
    models.test.js                 10   Database schema rules
    openapi.test.js                 2   API docs match the real routes
    passwordRules.test.js           5   Password rules
    reportEndpoints.test.js        16   Report submit checks, duplicates, list, flag
    reportLocation.test.js          6   200 m report location check
    reportUtils.test.js            11   Report expiry and flags
    reviews.test.js                35   Reviews and review photos
    stalls.test.js                 19   Adding, editing and removing stalls
    twoFactor.test.js              10   Two-factor login
    --------------------------  -----
    Total                         266

4.4 Frontend unit / component tests (frontend/src/**/__tests__/)

    File                        Tests   What it covers
    --------------------------  -----   ------------------------------------------------
    ConfidenceLabel.spec.js         8   Confidence label next to a status
    FilterChips.spec.js             8   Filter chip selection
    FoodUpdateForm.spec.js          6   Food update form, including the too-far check
    PlaceSearch.spec.js             4   Postal code search box
    ReminderBell.spec.js            3   Navbar reminder bell
    ReportStatusForm.spec.js        6   Report form, including the too-far check
    StatusBadge.spec.js             7   Queue status badge
    locationService.spec.js        13   Distance and browser location
    useFavouriteStore.spec.js       9   Favourites store (Pinia)
    alerts.spec.js                 16   Reminder text
    closures.spec.js                9   Closure dates
    passwordRules.spec.js           9   Password rules
    reminders.spec.js               5   Working out which reminders are due
    time.spec.js                   12   Time formatting
    --------------------------  -----
    Total                         115

4.5 Testing manually on the deployed app

    Log in with the test account in section 1 and follow the same journeys as in 4.2.
    To test community reports, see section 5.

4.6 How the tests are designed

    Separate E2E database and safety guard
      E2E tests only use a database called hawker-watch-e2e. Before each run,
      backend/scripts/seedE2e.js empties it and adds a small, fixed set of centres,
      stalls, a user and a report (backend/scripts/e2eFixtures.js). A guard
      (backend/utils/e2eGuard.js) throws an error unless the database name is exactly
      hawker-watch-e2e. It checks before connecting and again after connecting, so a
      test run can never clear the normal hawker-watch database.

    Stable selectors
      Tests find elements with getByTestId (data-testid attributes we added to the Vue
      components) and getByRole, not CSS classes or page text that changes. So a design
      change does not break the tests. There is one exception: map markers are drawn by
      the Leaflet library, and we cannot add a data-testid to them. map.spec.js finds
      them with the CSS locator path.leaflet-interactive, but only inside the element
      with the map-container test id.

    Repeatability
      - The E2E database is reset to the same data before every run.
      - Each test that needs an account registers its own user with a unique,
        timestamped email, so running the tests again does not clash with old data.
      - Tests run one at a time (1 worker), because they share one database.
      - There are no fixed waits (no sleep). Tests wait for what they expect to see.
      - Outside services (map tiles, web fonts) are blocked, so results do not depend
        on the internet.
      - Playwright sets the browser's location, so the 200 m check gives the same
        result every time.
      - The E2E servers use their own ports (3100 and 5174) and never reuse a running
        server, so a test run cannot attach to a pnpm dev server using another database.
      - Retries are off, so a flaky test shows up as a failure instead of being hidden.

    Mocking in backend tests
      The backend tests start the real Express app on a free port and call it over
      HTTP. Database calls are replaced with mocks (t.mock.method from node:test on the
      Mongoose models), so each test controls exactly what the "database" returns. This
      means the tests need no MongoDB, run in about 2 seconds, and give the same result
      on every computer. Calls to outside services (data.gov.sg, OneMap) are mocked the
      same way.

    CI (GitHub Actions, .github/workflows/ci.yml)
      Runs on every push and pull request. It has two jobs:
      - validate: installs dependencies, then runs lint, the frontend build, the
        frontend unit tests and the backend tests.
      - e2e: starts a MongoDB 7 service container (a throwaway database), runs the E2E
        tests against it, and uploads the Playwright HTML report as an artifact. It
        needs no secrets.


================================================================================
5. COMMUNITY REPORTS AND THE 200 M RULE
================================================================================

Community reports (queue length, open or closed) and food updates (sold out, some items
sold out, quality not great) can only be sent by a logged-in user who is within 200 m of
the hawker centre. This stops people reporting on a centre they are not at. The browser
asks for your location when you send a report. Reports expire after 60 minutes, and
food updates at the end of the day.

To send a report: open a centre page and click Report status on a stall, or click Reports
in the navbar and use Report a stall.

On the deployed app (you are probably not at a hawker centre), fake your location in
Chrome:

    1. Open the app and log in.
    2. Open DevTools (F12, or Cmd+Option+I on macOS).
    3. Click the three-dot menu (the vertical dots) at the top right of DevTools, then
       More tools > Sensors.
    4. Under Location, choose "Other..." (custom location) and enter the latitude and
       longitude of a hawker centre. For example, Maxwell Food Centre (Kim Hua Market):

           Latitude:   1.280551
           Longitude:  103.844460

       To get the coordinates of any other centre, open this address in your browser
       with part of the centre's name at the end:

           https://hawkerwatch-api.onrender.com/api/hawker-centres?search=<name>

       In the response, find "location": { "coordinates": [ ... ] }. The first number is
       the LONGITUDE and the second is the LATITUDE (GeoJSON order), so swap them when
       you type them into Sensors.
    5. Keep DevTools open, open that centre's page in HawkerWatch and send a report.
       Allow location access if the browser asks.
    6. To see the refusal, set a location far away (for example the preset "London")
       and try again. The app says you need to be at the centre and shows how far away
       you are.

On your own computer, you can turn the check off instead. Add this line to backend/.env
and restart pnpm dev:

    REPORT_LOCATION_CHECK=off

The report form then shows "Location check off (testing)". Remove the line to turn the
check back on.


================================================================================
6. DEPLOYMENT
================================================================================

This is how the live site is hosted, so it can be reproduced. Both parts are on Render
(https://render.com, free plan), connected to the GitHub repo. Both redeploy by
themselves on every push to main.

6.1 Database: MongoDB Atlas

    Use an Atlas cluster as in section 2, step 4. Under Network Access, allow 0.0.0.0/0,
    because Render's servers do not have a fixed IP address.

6.2 Backend: Render Web Service

    New > Web Service, connect the GitHub repo, then:

        Root Directory:      backend
        Runtime:             Node
        Build Command:       npx --yes pnpm@12.12.1 install --frozen-lockfile
        Start Command:       node server.js
        Health Check Path:   /api/health

    Environment variables:

        NODE_ENV       production
        MONGO_URI      the Atlas connection string
        JWT_SECRET     a long random string (made as in section 2, step 5)
        FRONTEND_URL   the frontend's address, here https://hawkerwatch-1ahh.onrender.com
                       (no / at the end)

    Render sets PORT by itself. NODE_ENV=production hides server error details, makes the
    login cookie work between the two onrender.com sites (SameSite=None; Secure), and
    stops pnpm seed and pnpm import:stalls from running against the live database.

    On first start the server imports the hawker centres and closures from data.gov.sg.
    Because pnpm import:stalls refuses to run in production, we loaded the stalls by
    running pnpm import:stalls on our own computer with MONGO_URI pointing at the same
    Atlas database (NODE_ENV=development locally).

6.3 Frontend: Render Static Site

    New > Static Site, connect the GitHub repo, then:

        Root Directory:      frontend
        Build Command:       npx --yes pnpm@12.12.1 install --frozen-lockfile &&
                             npx --yes pnpm@12.12.1 run build      (all on one line)
        Publish Directory:   dist

    Environment variable:

        VITE_API_URL   the backend's address followed by /api,
                       here https://hawkerwatch-api.onrender.com/api

    Redirects/Rewrites (needed so that reloading a page like /map works):

        Source: /*     Destination: /index.html     Action: Rewrite

6.4 Google login

    Continue with Google uses the team's OAuth client ID, which is built into
    frontend/src/utils/googleSignIn.js and backend/utils/googleAuth.js. A client ID is
    public (anyone can see it in the page), so it is in the repo; there is no client
    secret. No Render environment variable is needed for it.

    Google only shows the button on sites listed in Google Cloud Console > APIs &
    Services > Credentials > the OAuth client ID > Authorised JavaScript origins:

        http://localhost:5173
        http://localhost
        https://hawkerwatch-1ahh.onrender.com      (no / at the end)

    To use your own instead: create an OAuth client ID (Web application) with your
    origins, then set GOOGLE_CLIENT_ID on the backend and VITE_GOOGLE_CLIENT_ID on the
    frontend (rebuild the Static Site, because Vite builds it into the page).


================================================================================
7. KNOWN LIMITATIONS
================================================================================

- Free hosting: after about 15 minutes without visitors the backend sleeps, and the
  next request takes about 50 seconds.
- Stall data is mostly simulated, because there is no public API for hawker stalls.
  Sample stalls are not real businesses. Users can add real stalls in the app.
- Reminders for favourites only show in the bell icon in the navbar, while the app is
  open. No email or push notifications are sent.
- The frontend and backend are on two different onrender.com sites, so the login cookie
  is a third-party cookie. Normal Chrome and Firefox windows work. Safari, or private /
  Incognito windows that block third-party cookies, may not keep you logged in.


================================================================================
8. AI USAGE
================================================================================

We used AI tools (Claude) as an assistant for lower-order
tasks allowed by the course guidelines. Every AI-generated change was reviewed,
tested and adjusted by the team before it was merged into main. 

Parts that relied on AI:
- Test code: the favourites API tests and most of the Playwright end-to-end
  tests, including the data-testid selectors they use. We decided which user
  journeys to cover, reviewed the tests and ran them until they passed locally
  and in CI.
- CI and deployment config: the E2E job in the GitHub Actions workflow and the
  deployment config files, plus help working out the Render settings.
- Documentation: the first draft of this README, which we then checked and
  edited ourselves.
- Styling: the Bootstrap card grid layout for the centre cards
  (fix/centre-card-style).
