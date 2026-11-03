// The data the E2E tests run against. seedE2e.js saves it and the Playwright tests read it,
// so names and coordinates only live here. No imports, so frontend/e2e can use this file too.
export const DEMO_USER = {
  name: 'E2E Demo User',
  email: 'e2e-demo@example.com',
  password: 'Hawker#E2e1'
}

// Logs in to the Admin page in the admin journey
export const ADMIN_USER = {
  name: 'E2E Admin',
  email: 'e2e-admin@example.com',
  password: 'Hawker#E2e1'
}

export const ALPHA = {
  name: 'Alpha Food Centre',
  address: '1 Alpha Road',
  postalCode: '100001',
  lat: 1.3,
  lng: 103.85,
  foodStallCount: 20
}

export const BETA = {
  name: 'Beta Market',
  address: '2 Beta Street',
  postalCode: '200002',
  lat: 1.35,
  lng: 103.8,
  foodStallCount: 10
}

// Closed today, for the Open today filter and the closure notice
export const GAMMA = {
  name: 'Gamma Hawker Centre',
  address: '3 Gamma Avenue',
  postalCode: '300003',
  lat: 1.33,
  lng: 103.9,
  foodStallCount: 5
}

export const CENTRES = [ALPHA, BETA, GAMMA]

// Has a live report from the seed
export const REPORTED_STALL = { name: 'Alpha Chicken Rice', cuisine: 'Chinese', speciality: 'Chicken rice', unitNumber: '01-01' }
// The report journey reports this one
export const REPORT_TARGET_STALL = { name: 'Alpha Prata', cuisine: 'Indian', speciality: 'Roti prata', unitNumber: '01-02' }
// No test ever gets a report saved for this one, so it always shows "No reports"
export const QUIET_STALL = { name: 'Alpha Drinks', cuisine: 'Drinks', speciality: 'Kopi', unitNumber: '01-03' }
export const BETA_STALL = { name: 'Beta Laksa', cuisine: 'Peranakan', speciality: 'Laksa', unitNumber: '01-01' }
export const GAMMA_STALL = { name: 'Gamma Thai Kitchen', cuisine: 'Thai', speciality: 'Pad thai', unitNumber: '01-01' }
