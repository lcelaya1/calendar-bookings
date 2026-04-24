import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ConfigPanel() {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single()
    if (data) setConfig(data)
  }

  function update(field, value) {
    setConfig(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error: err } = await supabase.from('config').update({
      ops_email: config.ops_email,
      event_title: config.event_title,
      event_desc: config.event_desc,
      bookings_open: config.bookings_open,
    }).eq('id', 1)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
  }

  async function toggleBookings() {
    const next = !config.bookings_open
    update('bookings_open', next)
    await supabase.from('config').update({ bookings_open: next }).eq('id', 1)
  }

  if (!config) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-6 max-w-lg">

      {/* Bookings toggle */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Bookings open</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {config.bookings_open ? 'LEINNers can currently book slots.' : 'Booking is closed — LEINNers see a message.'}
          </p>
        </div>
        <button
          onClick={toggleBookings}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.bookings_open ? 'bg-indigo-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.bookings_open ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Google Calendar connection */}
      <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Google Calendar connected</p>
          <p className="text-xs text-green-700 mt-0.5">
            Using service account — always active, no reconnection needed.
            Events are created in the <strong>PR RESERVAS</strong> calendar.
          </p>
        </div>
      </div>

      {/* Event settings */}
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Organizer email</label>
          <input
            type="email"
            value={config.ops_email}
            onChange={e => update('ops_email', e.target.value)}
            placeholder="operaciones@teamlabs.es"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Event title</label>
          <input
            value={config.event_title}
            onChange={e => update('event_title', e.target.value)}
            placeholder="Project Review — SOP"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Event description</label>
          <textarea
            value={config.event_desc}
            onChange={e => update('event_desc', e.target.value)}
            rows={4}
            placeholder="Description shown in the Google Calendar invite…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
        </div>
      </form>
    </div>
  )
}
