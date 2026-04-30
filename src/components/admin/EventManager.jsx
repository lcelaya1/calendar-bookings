import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SlotManager from './SlotManager'

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90]
const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30]
const MIN_NOTICE_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48]
const DEFAULT_FORM_FIELDS = [
  { id: 'full_name', label: 'Full name', type: 'text', placeholder: 'Your full name', required: true, system: 'name' },
  { id: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com', required: true, system: 'email' },
  { id: 'project', label: 'Proyecto al que perteneces', type: 'text', placeholder: 'Nombre de tu proyecto', required: true, system: 'project' },
]
const DEFAULT_CALENDAR_TITLE_TEMPLATE = '[ONLINE] {reviewer_first_name} - {event_name} ({leinner_name})'

const EVENT_TYPES = [
  {
    id: 'round_robin',
    label: 'Round Robin',
    description: 'Automatically balance bookings across multiple reviewers.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    id: 'language',
    label: 'Language-based',
    description: 'Users choose English or Spanish — each language routes to a specific reviewer.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'One reviewer, users book any available slot. Simple and straightforward.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

function MethodToggle({ value, onChange }) {
  return (
    <div className="flex rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('round_robin')}
        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
          value === 'round_robin' || !value
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        Round Robin
      </button>
      <button
        type="button"
        onClick={() => onChange('language')}
        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 ${
          value === 'language'
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        Language-based
      </button>
    </div>
  )
}

function normalizeFormFields(fields) {
  return Array.isArray(fields) && fields.length > 0 ? fields : DEFAULT_FORM_FIELDS
}

function createCustomField() {
  return {
    id: `field_${Date.now()}`,
    label: 'New question',
    type: 'text',
    placeholder: '',
    required: false,
  }
}

function eventSlug(name) {
  const slug = (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'event'
}

function eventBookingPath(event) {
  return `/book/${eventSlug(event.name)}/${event.id}`
}

function previewCalendarTitle(template, eventName) {
  return (template || DEFAULT_CALENDAR_TITLE_TEMPLATE).replace(/\{(\w+)\}/g, (_, key) => {
    const values = {
      event_name: eventName || 'Event name',
      reviewer_name: 'Laura Celaya',
      reviewer_first_name: 'LAURA',
      leinner_name: 'Prueba',
      leinner_email: 'leinner@example.com',
      project: 'Proyecto',
    }
    return values[key] ?? ''
  })
}

// ─── List View ───────────────────────────────────────────────────────────────

function EventList({ onSelect }) {
  const [events, setEvents] = useState([])
  const [bookingCounts, setBookingCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Creation panel state
  const [panel, setPanel] = useState(null) // null | 'type' | 'form'
  const [selectedType, setSelectedType] = useState(null)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(45)
  const [breakTime, setBreakTime] = useState(10)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: evts }, { data: bookings }] = await Promise.all([
      supabase.from('events').select('*').order('created_at'),
      supabase.from('bookings').select('event_id'),
    ])
    setEvents(evts ?? [])
    const counts = {}
    for (const b of bookings ?? []) {
      if (b.event_id) counts[b.event_id] = (counts[b.event_id] ?? 0) + 1
    }
    setBookingCounts(counts)
    setLoading(false)
  }

  async function createEvent() {
    if (!name.trim() || !selectedType) return
    setError('')
    setSaving(true)
    const method = selectedType === 'language' ? 'language' : 'round_robin'
    const { data, error: err } = await supabase
      .from('events')
      .insert({
        name: name.trim(),
        assignment_method: method,
        duration_minutes: Number(duration),
        break_minutes: Number(breakTime),
        min_notice_hours: 4,
        form_fields: DEFAULT_FORM_FIELDS,
        calendar_title_template: DEFAULT_CALENDAR_TITLE_TEMPLATE,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setPanel(null)
    setName('')
    setDuration(45)
    setBreakTime(10)
    setSelectedType(null)
    onSelect(data)
  }

  const [copiedId, setCopiedId] = useState(null)

  function copyLink(ev, e) {
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}${eventBookingPath(ev)}`)
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function openCreate() { setPanel('type'); setSelectedType(null); setName(''); setDuration(45); setBreakTime(10) }
  function closePanel() { setPanel(null); setSelectedType(null) }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="relative flex gap-0">
      {/* ── Main area ── */}
      <div className={`flex-1 flex flex-col gap-6 transition-all ${panel ? 'mr-96' : ''}`}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-400 mt-0.5">Create and manage your booking event types.</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create event
          </button>
        </div>

        {/* Empty state */}
        {events.length === 0 && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 bg-white rounded-2xl border border-gray-200 shadow-sm px-10 py-14">
            <div className="max-w-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Create your first event</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Events are templates for your booking sessions. Set the type, duration, and reviewers — then share the link with your users.
              </p>
              <button
                onClick={openCreate}
                className="mt-6 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New event type
              </button>
            </div>
            {/* Illustration */}
            <div className="shrink-0 opacity-80">
              <svg width="220" height="160" viewBox="0 0 220 160" fill="none">
                <rect x="10" y="20" width="120" height="130" rx="10" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
                <rect x="20" y="35" width="100" height="14" rx="4" fill="#C7D2FE"/>
                <rect x="20" y="57" width="70" height="10" rx="3" fill="#DDE3FF"/>
                <rect x="20" y="73" width="90" height="10" rx="3" fill="#DDE3FF"/>
                <rect x="20" y="89" width="60" height="10" rx="3" fill="#DDE3FF"/>
                <rect x="100" y="60" width="110" height="90" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="1.5"/>
                <rect x="112" y="75" width="86" height="12" rx="4" fill="#6366F1"/>
                <rect x="112" y="94" width="60" height="8" rx="3" fill="#E0E7FF"/>
                <rect x="112" y="108" width="75" height="8" rx="3" fill="#E0E7FF"/>
                <rect x="112" y="122" width="50" height="8" rx="3" fill="#E0E7FF"/>
                <circle cx="170" cy="35" r="20" fill="#6366F1" opacity="0.15"/>
                <circle cx="170" cy="35" r="12" fill="#6366F1" opacity="0.3"/>
                <path d="M165 35l3 3 7-7" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}

        {/* Event cards */}
        {events.length > 0 && (
          <div className="flex flex-col gap-3">
            {events.map(ev => (
              <div key={ev.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex hover:shadow-md transition-shadow">
                <div className={`w-1.5 shrink-0 ${ev.is_open ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                <div className="flex-1 flex items-center justify-between px-5 py-4 gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{ev.name}</span>
                      {!ev.is_open && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Closed</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ev.duration_minutes < 60 ? `${ev.duration_minutes} min` : `${ev.duration_minutes / 60}h`}
                      {' · '}
                      {ev.assignment_method === 'language' ? '🌐 Language-based' : '⟳ Round Robin'}
                      {' · '}
                      {bookingCounts[ev.id] ?? 0} bookings
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => copyLink(ev, e)}
                      className={`flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors ${
                        copiedId === ev.id ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {copiedId === ev.id ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => onSelect(ev)}
                      className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Manage
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Slide-in panel ── */}
      {panel && (
        <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col z-40">
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Event type</p>
            <button onClick={closePanel} className="text-gray-400 hover:text-gray-700 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Step 1: choose type */}
            {panel === 'type' && (
              <div className="flex flex-col divide-y divide-gray-100">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedType(t.id); setPanel('form') }}
                    className="flex items-start gap-4 px-6 py-5 text-left hover:bg-indigo-50 transition-colors group"
                  >
                    <span className="mt-0.5 text-indigo-500 group-hover:text-indigo-700 transition-colors shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-800">{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: fill in details */}
            {panel === 'form' && (
              <div className="flex flex-col gap-6 px-6 py-6">
                {/* Selected type badge */}
                <button
                  onClick={() => setPanel('type')}
                  className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {EVENT_TYPES.find(t => t.id === selectedType)?.label}
                </button>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Event name</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && name.trim() && createEvent()}
                    placeholder="e.g. Project Review SOP"
                    className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-500">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDuration(m)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          duration === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                      >
                        {m < 60 ? `${m} min` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-500">Break between slots</label>
                  <div className="flex flex-wrap gap-2">
                    {BREAK_OPTIONS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBreakTime(m)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          breakTime === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                      >
                        {m === 0 ? 'No break' : `${m} min`}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>
            )}
          </div>

          {/* Panel footer */}
          {panel === 'form' && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button onClick={closePanel} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={createEvent}
                disabled={!name.trim() || saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Detail View ─────────────────────────────────────────────────────────────

function EventDetail({ initialEvent, onBack }) {
  const [event, setEvent] = useState(initialEvent)
  const [eventReviewers, setEventReviewers] = useState([])
  const [allReviewers, setAllReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingField, setSavingField] = useState(null)
  const [error, setError] = useState('')

  // Add reviewer form
  const [addReviewerId, setAddReviewerId] = useState('')
  const [addLanguage, setAddLanguage] = useState('en')
  const [addingReviewer, setAddingReviewer] = useState(false)

  // Copy link feedback
  const [copied, setCopied] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => { load() }, [initialEvent.id])

  async function load() {
    setLoading(true)
    const [{ data: erData }, { data: revData }] = await Promise.all([
      supabase
        .from('event_reviewers')
        .select('reviewer_id, language, reviewers(id, name, email)')
        .eq('event_id', initialEvent.id),
      supabase.from('reviewers').select('id, name, email').order('name'),
    ])
    setEventReviewers(erData ?? [])
    setAllReviewers(revData ?? [])
    setLoading(false)
  }

  // Auto-save event field after short delay
  async function updateField(field, value) {
    const updated = { ...event, [field]: value }
    setEvent(updated)
    setError('')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingField(field)
      const { error: err } = await supabase.from('events').update({ [field]: value }).eq('id', event.id)
      if (err) setError(err.message)
      setSavingField(null)
    }, 600)
  }

  // Immediate save for toggles
  async function updateFieldNow(field, value) {
    const updated = { ...event, [field]: value }
    setEvent(updated)
    setError('')
    setSavingField(field)
    const { error: err } = await supabase.from('events').update({ [field]: value }).eq('id', event.id)
    if (err) setError(err.message)
    setSavingField(null)
  }

  async function addReviewer() {
    if (!addReviewerId) return
    setError('')
    setAddingReviewer(true)
    const row = {
      event_id: event.id,
      reviewer_id: addReviewerId,
      language: event.assignment_method === 'language' ? addLanguage : null,
    }
    const { error: err } = await supabase.from('event_reviewers').insert(row)
    setAddingReviewer(false)
    if (err) { setError(err.message); return }
    setAddReviewerId('')
    setAddLanguage('en')
    load()
  }

  async function removeReviewer(reviewerId) {
    setError('')
    const { error: err } = await supabase
      .from('event_reviewers')
      .delete()
      .eq('event_id', event.id)
      .eq('reviewer_id', reviewerId)
    if (err) { setError(err.message); return }
    load()
  }

  function copyLink() {
    const url = `${window.location.origin}${eventBookingPath(event)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const usedReviewerIds = new Set(eventReviewers.map(er => er.reviewer_id))
  const availableReviewers = allReviewers.filter(r => !usedReviewerIds.has(r.id))

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>

  const bookingUrl = `${window.location.origin}${eventBookingPath(event)}`
  const slotManagerReviewers = eventReviewers.map(er => er.reviewers).filter(Boolean)
  const eventDuration = event.duration_minutes ?? 45
  const eventBreakTime = event.break_minutes ?? 10
  const eventMinNoticeHours = event.min_notice_hours ?? 4
  const formFields = normalizeFormFields(event.form_fields)

  function updateFormFields(nextFields) {
    updateFieldNow('form_fields', nextFields)
  }

  function updateFormField(fieldId, patch) {
    updateFormFields(formFields.map(field => (
      field.id === fieldId ? { ...field, ...patch } : field
    )))
  }

  function addFormField() {
    updateFormFields([...formFields, createCustomField()])
  }

  function removeFormField(fieldId) {
    const nextFields = formFields.filter(field => field.id !== fieldId)
    updateFormFields(nextFields.length > 0 ? nextFields : DEFAULT_FORM_FIELDS)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Events
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">{event.name}</span>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-700">Event settings</h2>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Open/Closed toggle */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Bookings open</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {event.is_open ? 'Users can book this event.' : 'This event is closed to bookings.'}
            </p>
          </div>
          <button
            onClick={() => updateFieldNow('is_open', !event.is_open)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${event.is_open ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${event.is_open ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Event name {savingField === 'name' && <span className="text-indigo-400">saving…</span>}
            </label>
            <input
              value={event.name}
              onChange={e => updateField('name', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Duration {savingField === 'duration_minutes' && <span className="text-indigo-400">saving…</span>}
            </label>
            <select
              value={eventDuration}
              onChange={e => updateFieldNow('duration_minutes', Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {DURATION_OPTIONS.map(m => (
                <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60}h`}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Time between slots {savingField === 'break_minutes' && <span className="text-indigo-400">saving…</span>}
            </label>
            <select
              value={eventBreakTime}
              onChange={e => updateFieldNow('break_minutes', Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {BREAK_OPTIONS.map(m => (
                <option key={m} value={m}>{m === 0 ? 'No break' : `${m} min`}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Minimum booking notice {savingField === 'min_notice_hours' && <span className="text-indigo-400">saving…</span>}
            </label>
            <select
              value={eventMinNoticeHours}
              onChange={e => updateFieldNow('min_notice_hours', Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {MIN_NOTICE_OPTIONS.map(h => (
                <option key={h} value={h}>{h === 0 ? 'No minimum' : `${h}h before`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">
            Calendar event title {savingField === 'calendar_title_template' && <span className="text-indigo-400">saving…</span>}
          </label>
          <input
            value={event.calendar_title_template ?? DEFAULT_CALENDAR_TITLE_TEMPLATE}
            onChange={e => updateField('calendar_title_template', e.target.value)}
            onBlur={e => updateFieldNow('calendar_title_template', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-400">
            Available placeholders: {'{event_name}'}, {'{reviewer_name}'}, {'{reviewer_first_name}'}, {'{leinner_name}'}, {'{leinner_email}'}, {'{project}'}
          </p>
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            Preview: {previewCalendarTitle(event.calendar_title_template, event.name)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Assignment method:</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            event.assignment_method === 'language'
              ? 'bg-purple-50 text-purple-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            {event.assignment_method === 'language' ? '🌐 Language-based' : '⟳ Round Robin'}
          </span>
        </div>
      </div>

      {/* Booking form section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Booking form</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose which fields LEINNers fill in when confirming a slot.
            </p>
          </div>
          <button
            type="button"
            onClick={addFormField}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            + Add field
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {formFields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto_auto] gap-2 items-end bg-gray-50 rounded-lg px-3 py-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-500">Label</label>
                <input
                  value={field.label}
                  onChange={e => updateFormField(field.id, { label: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-500">Placeholder</label>
                <input
                  value={field.placeholder ?? ''}
                  onChange={e => updateFormField(field.id, { placeholder: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-500">Type</label>
                <select
                  value={field.type ?? 'text'}
                  onChange={e => updateFormField(field.id, { type: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500 pb-2">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => updateFormField(field.id, { required: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => removeFormField(field.id)}
                className="text-red-400 hover:text-red-600 text-xs font-medium pb-2 text-left"
                disabled={formFields.length === 1 && idx === 0}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Reviewers section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-700">Reviewers</h2>

        {eventReviewers.length === 0 ? (
          <p className="text-sm text-gray-400">No reviewers assigned to this event yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {eventReviewers.map(er => (
              <div key={er.reviewer_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{er.reviewers?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{er.reviewers?.email ?? ''}</p>
                  </div>
                  {er.language && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      er.language === 'en' ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {er.language === 'en' ? 'EN' : 'ES'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeReviewer(er.reviewer_id)}
                  className="text-red-400 hover:text-red-600 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add reviewer row */}
        {availableReviewers.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <select
              value={addReviewerId}
              onChange={e => setAddReviewerId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select reviewer…</option>
              {availableReviewers.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {event.assignment_method === 'language' && (
              <select
                value={addLanguage}
                onChange={e => setAddLanguage(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            )}
            <button
              onClick={addReviewer}
              disabled={!addReviewerId || addingReviewer}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors whitespace-nowrap"
            >
              {addingReviewer ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
      </div>

      {/* Slots section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Slots</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Define each reviewer’s punctual or recurring availability.
          </p>
        </div>

        <SlotManager
          eventId={event.id}
          reviewers={slotManagerReviewers}
          duration={eventDuration}
          breakTime={eventBreakTime}
        />
      </div>

      {/* Shareable link */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Shareable booking link</h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={bookingUrl}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 focus:outline-none"
          />
          <button
            onClick={copyLink}
            className={`shrink-0 text-sm font-medium rounded-lg px-4 py-2 transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function EventManager() {
  const [selectedEvent, setSelectedEvent] = useState(null)

  if (selectedEvent) {
    return (
      <EventDetail
        key={selectedEvent.id}
        initialEvent={selectedEvent}
        onBack={() => setSelectedEvent(null)}
      />
    )
  }

  return <EventList onSelect={setSelectedEvent} />
}
