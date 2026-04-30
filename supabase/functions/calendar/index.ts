const CALENDAR_ID = 'c_330a8c9b4aa47122f2bc86bb327a949308448ca781fb63ecd92bfe4866c1e0c8@group.calendar.google.com'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
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

      const res = await fetch(`${calUrl}?conferenceDataVersion=1&sendUpdates=all`, {
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
