import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const DEFAULT_FORM_FIELDS = [
  { id: 'full_name', label: 'Full name', type: 'text', placeholder: 'Your full name', required: true, system: 'name' },
  { id: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com', required: true, system: 'email' },
  { id: 'project', label: 'Proyecto al que perteneces', type: 'text', placeholder: 'Nombre de tu proyecto', required: true, system: 'project' },
]

function fmtSlot(slot) {
  const d = new Date(slot.date + 'T00:00:00')
  const date = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const [h, m] = slot.time.split(':')
  return `${date} · ${h}:${m} (${slot.duration_minutes} min)`
}

function normalizeFormFields(fields) {
  return Array.isArray(fields) && fields.length > 0 ? fields : DEFAULT_FORM_FIELDS
}

function getSystemValue(fields, values, system, fallback = '') {
  const field = fields.find(f => f.system === system || f.id === system)
  return field ? (values[field.id] ?? '').trim() : fallback
}

export default function BookingForm({ slot, onBack, onConfirmed, reviewerId, eventId, formFields }) {
  const fields = normalizeFormFields(formFields)
  const [values, setValues] = useState(() => fields.reduce((acc, field) => ({ ...acc, [field.id]: '' }), {}))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = fields.every(field => !field.required || (values[field.id] ?? '').trim() !== '')

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const name = getSystemValue(fields, values, 'name', 'LEINNer')
    const email = getSystemValue(fields, values, 'email').toLowerCase()
    const project = getSystemValue(fields, values, 'project')
    const formResponses = fields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.type ?? 'text',
      required: !!field.required,
      system: field.system ?? null,
      value: values[field.id] ?? '',
    }))

    const { data, error: err } = await supabase.rpc('book_slot', {
      p_date: slot.date,
      p_time: slot.time,
      p_leinner_name: name,
      p_leinner_email: email,
      p_leinner_project: project,
      ...(reviewerId ? { p_reviewer_id: reviewerId } : {}),
      ...(eventId ? { p_event_id: eventId } : {}),
    })

    setLoading(false)

    if (err || data?.error) {
      setError(data?.error ?? err.message)
      return
    }

    await supabase
      .from('bookings')
      .update({ form_responses: formResponses })
      .eq('id', data.booking_id)

    onConfirmed({ bookingId: data.booking_id, reviewerId: data.reviewer_id, name, email, project, formResponses, slot })
  }

  function updateValue(fieldId, value) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <div>
        <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 transition-colors">
          ← Back to slots
        </button>
        <h2 className="text-xl font-semibold text-gray-800">Confirm your booking</h2>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Selected slot</p>
        <p className="text-sm font-medium text-indigo-800 mt-0.5 capitalize">{fmtSlot(slot)}</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {fields.map(field => (
          <div key={field.id} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={field.type === 'email' ? 'email' : 'text'}
              value={values[field.id] ?? ''}
              onChange={e => updateValue(field.id, e.target.value)}
              placeholder={field.placeholder ?? ''}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        ))}

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error === 'No available slot at this time'
              ? 'This slot was just taken by someone else. Please go back and choose another.'
              : error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className={`font-medium rounded-lg px-4 py-2.5 text-sm transition-all
            ${canSubmit && !loading
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {loading ? 'Confirming…' : 'Confirm booking'}
        </button>
      </form>
    </div>
  )
}
