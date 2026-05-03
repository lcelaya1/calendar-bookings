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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function addMinutesLocal(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, mins] = time.split(':').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, hours, mins + minutes))
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:00`
}

function madridOffset(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, mins] = time.split(':').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, hours, mins))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'shortOffset',
  }).formatToParts(value)
  const offset = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT+1'
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+01:00'
  return `${match[1]}${pad(Number(match[2]))}:${match[3] ?? '00'}`
}

function madridDateTime(date: string, time: string) {
  const clock = time.slice(0, 5)
  return `${date}T${clock}:00${madridOffset(date, clock)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { action, ...params } = await req.json()
    const token = await getAccessToken()
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`

    if (action === 'create') {
      const { title, date, time, durationMinutes, reviewerEmail, leinnerEmail } = params
      const start = madridDateTime(date, time)
      const endTime = addMinutesLocal(date, time, durationMinutes)
      const [endDate, endClock] = endTime.split('T')
      const end = madridDateTime(endDate, endClock.slice(0, 5))
      const requestId = `prb-${Date.now()}-${Math.random().toString(36).slice(2)}`

      const res = await fetch(`${calUrl}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          start: { dateTime: start, timeZone: 'Europe/Madrid' },
          end: { dateTime: end, timeZone: 'Europe/Madrid' },
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
