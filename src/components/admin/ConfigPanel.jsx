import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ConfigPanel() {
  const [config, setConfig] = useState(null)
  const [opsEmail, setOpsEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single()
    if (data) {
      setConfig(data)
      setOpsEmail(data.ops_email ?? '')
    }
  }

  async function toggleBookings() {
    const next = !config.bookings_open
    setConfig(prev => ({ ...prev, bookings_open: next }))
    await supabase.from('config').update({ bookings_open: next }).eq('id', 1)
  }

  async function saveEmail(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await supabase.from('config').update({ ops_email: opsEmail.trim() }).eq('id', 1)
    setSaving(false)
    setSaved(true)
  }

  if (!config) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-5">

      {/* Global kill-switch */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Global bookings on/off</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {config.bookings_open
              ? 'Bookings enabled — individual event settings apply.'
              : 'All bookings disabled globally, regardless of individual event settings.'}
          </p>
        </div>
        <button
          onClick={toggleBookings}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.bookings_open ? 'bg-indigo-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.bookings_open ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Google Calendar status */}
      <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Google Calendar connected</p>
          <p className="text-xs text-green-700 mt-0.5">
            Service account active — no reconnection needed. Events are created in the <strong>PR RESERVAS</strong> calendar.
          </p>
        </div>
      </div>

      {/* Organizer email */}
      <form onSubmit={saveEmail} className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-500">
          Organizer email
          <span className="ml-1 font-normal text-gray-400">— used to detect admin cancellations from Google Calendar</span>
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={opsEmail}
            onChange={e => { setOpsEmail(e.target.value); setSaved(false) }}
            placeholder="operaciones@teamlabs.es"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved && <p className="text-xs text-green-600">Saved!</p>}
      </form>

    </div>
  )
}
