const EDGE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function call(body) {
  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Edge function error ${res.status}`)
  return data
}

export const createCalendarEvent = (params) => call({ action: 'create', ...params })
export const deleteCalendarEvent = (eventId) => call({ action: 'delete', eventId })
export const getCalendarEvent = (eventId) => call({ action: 'get', eventId })
