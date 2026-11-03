// "Continue with Google": checks the ID token that Google's button gives the frontend.
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client()

// Must match the frontend's (frontend/src/utils/googleSignIn.js). Not a secret; GOOGLE_CLIENT_ID overrides it.
const DEFAULT_GOOGLE_CLIENT_ID = '59002596594-ken3g6tv7jftn7ul20f3et0hmclvhh0k.apps.googleusercontent.com'

// Returns { googleId, email, name } from a genuine token issued for our app, or null if the
// token is fake, expired, for another app, or its email isn't verified by Google.
export async function verifyGoogleToken(idToken) {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null
    return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name || payload.email.split('@')[0] }
  } catch {
    return null
  }
}
