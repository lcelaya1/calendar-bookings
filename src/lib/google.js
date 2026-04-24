const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function requestGoogleToken(onSuccess, onError) {
  if (!window.google?.accounts?.oauth2) {
    onError('Google Identity Services not loaded. Refresh the page and try again.')
    return
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (response) => {
      if (response.error) { onError(response.error); return }
      onSuccess({
        access_token: response.access_token,
        expiry: Date.now() + response.expires_in * 1000,
      })
    },
  })

  client.requestAccessToken({ prompt: 'consent' })
}

export function isTokenValid(token) {
  return token?.access_token && token?.expiry && Date.now() < token.expiry
}

export async function createCalendarEvent({
  accessToken, title, description, date, time,
  durationMinutes, reviewerEmail, leinnerEmail, leinnerName,
}) {
  const start = new Date(`${date}T${time}`)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  const requestId = `prb-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description: `${description}\n\nLEINNer: ${leinnerName}`,
        start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' },
        attendees: [{ email: reviewerEmail }, { email: leinnerEmail }],
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        guestsCanModifyEvent: false,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? `Calendar API error ${res.status}`)
  }

  return res.json()
}

export async function getCalendarEvent(accessToken, eventId) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (res.status === 404 || res.status === 410) return null
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`)
  return res.json()
}

// Returns 'leinner' | 'reviewer' | 'admin' | null
export function detectCanceller(event, leinnerEmail, reviewerEmail, opsEmail) {
  if (!event || event.status === 'cancelled') return 'admin'

  const attendees = event.attendees ?? []
  const original = [leinnerEmail, reviewerEmail, opsEmail].filter(Boolean).map(e => e.toLowerCase())

  const declined = attendees
    .filter(a => a.responseStatus === 'declined' && original.includes(a.email?.toLowerCase()))
    .map(a => a.email?.toLowerCase())

  if (declined.includes(leinnerEmail?.toLowerCase())) return 'leinner'
  if (declined.includes(reviewerEmail?.toLowerCase())) return 'reviewer'
  if (declined.includes(opsEmail?.toLowerCase())) return 'admin'
  return null
}

export async function deleteCalendarEvent(accessToken, eventId) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  // 204 = deleted, 410 = already deleted — both are fine
  if (!res.ok && res.status !== 410) {
    throw new Error(`Calendar delete failed: ${res.status}`)
  }
}

export function extractMeetLink(event) {
  return (
    event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null
  )
}
