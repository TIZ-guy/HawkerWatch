// Loads Google's "Sign in with Google" script (Google Identity Services) once, when first needed.
// https://developers.google.com/identity/gsi/web/guides/display-button
// The team's OAuth client ID. It isn't a secret (it's visible in the page anyway): Google only accepts
// it on the Authorised JavaScript origins set in Google Cloud. VITE_GOOGLE_CLIENT_ID overrides it.
export const DEFAULT_GOOGLE_CLIENT_ID = '59002596594-ken3g6tv7jftn7ul20f3et0hmclvhh0k.apps.googleusercontent.com'
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID

let loading = null

export function loadGoogleScript() {
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve(window.google)
    script.onerror = () => {
      loading = null // let a later visit try again
      reject(new Error("Couldn't load Google sign-in. Please try again or log in with your email."))
    }
    document.head.appendChild(script)
  })
  return loading
}

// Draws Google's button inside element. onCredential gets the ID token to send to the backend.
// text is Google's wording for the button, e.g. 'continue_with' or 'signup_with'.
export async function renderGoogleButton(element, onCredential, text = 'continue_with') {
  const google = await loadGoogleScript()
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => onCredential(response.credential)
  })
  google.accounts.id.renderButton(element, {
    type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular',
    width: Math.min(element.clientWidth || 400, 400)
  })
}
