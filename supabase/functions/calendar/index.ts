const CALENDAR_ID = 'c_330a8c9b4aa47122f2bc86bb327a949308448ca781fb63ecd92bfe4866c1e0c8@group.calendar.google.com'
const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT')!)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${b64url(header)}.${b64url(payload)}`

  const pemContent = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----\n', '')
    .replace('\n-----END PRIVATE KEY-----\n', '')
    .replace(/\n/g, '')

  const keyBuffer = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth2:grant-type:jwt-bearer', assertion: jwt }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`)
  return tokenData.access_token
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { action, ...params } = await req.json()
    const token = await getAccessToken()
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`

    if (action === 'create') {
      const { title, description, date, time, durationMinutes, reviewerEmail, leinnerEmail, leinnerName } = params
      const start = new Date(`${date}T${time}`)
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      const requestId = `prb-${Date.now()}-${Math.random().toString(36).slice(2)}`

      const res = await fetch(`${calUrl}?conferenceDataVersion=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          description: `${description}\n\nLEINNer: ${leinnerName}`,
          start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
          end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' },
          attendees: [{ email: reviewerEmail }, { email: leinnerEmail }],
          conferenceData: {
            createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
          },
          guestsCanModifyEvent: false,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message ?? `Calendar API error ${res.status}`) }
      return json(await res.json())
    }

    if (action === 'get') {
      const res = await fetch(`${calUrl}/${params.eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 404 || res.status === 410) return json(null)
      if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`)
      return json(await res.json())
    }

    if (action === 'delete') {
      const res = await fetch(`${calUrl}/${params.eventId}?sendUpdates=all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204 && res.status !== 410) throw new Error(`Calendar delete failed: ${res.status}`)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
