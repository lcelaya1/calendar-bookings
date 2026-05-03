import { useState, useEffect, useRef, cloneElement } from 'react'

const ALLOWED_EMAIL = 'operaciones@teamlabs.es'

function decodeJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

function initGoogleSignIn(clientId, callback) {
  window.google.accounts.id.initialize({ client_id: clientId, callback })
}

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('admin_user')) } catch { return null }
  })
  const [error, setError] = useState('')
  const [gisReady, setGisReady] = useState(false)
  const btnRef = useRef(null)

  useEffect(() => {
    if (user) return
    const check = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(check)
        setGisReady(true)
      }
    }, 100)
    return () => clearInterval(check)
  }, [user])

  useEffect(() => {
    if (!gisReady || user || !btnRef.current) return
    initGoogleSignIn(import.meta.env.VITE_GOOGLE_CLIENT_ID, handleCredential)
    window.google.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280,
    })
  }, [gisReady, user])

  function handleCredential(response) {
    const payload = decodeJwt(response.credential)
    const email = payload.email ?? ''
    if (email !== ALLOWED_EMAIL) {
      setError('Access restricted. Only the operations account can sign in.')
      return
    }
    const userData = { email, name: payload.name, picture: payload.picture }
    sessionStorage.setItem('admin_user', JSON.stringify(userData))
    setUser(userData)
  }

  function signOut() {
    sessionStorage.removeItem('admin_user')
    window.google?.accounts?.id?.disableAutoSelect()
    setUser(null)
    setGisReady(false)
    setError('')
  }

  if (user) return cloneElement(children, { adminUser: user, onSignOut: signOut })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 w-full max-w-sm flex flex-col items-center gap-5">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800">Admin access</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in with operaciones@teamlabs.es</p>
        </div>

        {!gisReady ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div ref={btnRef} />
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
