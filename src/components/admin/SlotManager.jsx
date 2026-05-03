import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = [
  { key: 0, label: 'Domingo',    initial: 'D' },
  { key: 1, label: 'Lunes',      initial: 'L' },
  { key: 2, label: 'Martes',     initial: 'M' },
  { key: 3, label: 'Miércoles',  initial: 'M' },
  { key: 4, label: 'Jueves',     initial: 'J' },
  { key: 5, label: 'Viernes',    initial: 'V' },
  { key: 6, label: 'Sábado',     initial: 'S' },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateSlots(start, end, durationMin, breakMin) {
  const slots = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em
  const step = durationMin + breakMin
  while (cur + durationMin <= endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0')
    const m = String(cur % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
    cur += step
  }
  return slots
}

// Always build YYYY-MM-DD from local time — toISOString() converts to UTC
// which shifts the date back by 1 day in UTC+ timezones (e.g. Spain UTC+2)
function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDatesInRange(from, to, dayOfWeek) {
  const dates = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    if (cur.getDay() === dayOfWeek) dates.push(localDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function todayDate() {
  return localDateStr(new Date())
}

function initWeeklySchedule() {
  const s = {}
  DAYS.forEach(({ key }) => {
    s[key] = [1, 2, 3, 4, 5].includes(key)
      ? [{ start: '09:00', end: '17:00' }]
      : null
  })
  return s
}

function initOnceEntries() {
  return [{ date: todayDate(), start: '09:00', end: '17:00' }]
}

function slotKey({ reviewer_id, event_id, date, time }) {
  return `${reviewer_id}:${event_id ?? 'default'}:${date}:${time}`
}

function dedupeSlotRows(rows) {
  return Array.from(
    rows.reduce((map, row) => map.set(slotKey(row), row), new Map()).values()
  )
}

function createSlotRow(reviewerId, eventId, date, time, duration) {
  return {
    reviewer_id: reviewerId,
    date,
    time,
    duration_minutes: duration,
    ...(eventId ? { event_id: eventId } : {}),
  }
}

function buildWeeklyRows(schedule, dateFrom, dateTo, duration, breakTime, reviewerId, eventId) {
  if (!dateFrom || !dateTo || dateFrom > dateTo) return []

  const rows = []
  DAYS.forEach(({ key }) => {
    const ranges = schedule[key]
    if (!ranges) return
    getDatesInRange(dateFrom, dateTo, key).forEach(date => {
      ranges.forEach(({ start, end }) => {
        if (start && end && start < end) {
          generateSlots(start, end, duration, breakTime).forEach(time => {
            rows.push(createSlotRow(reviewerId, eventId, date, time, duration))
          })
        }
      })
    })
  })
  return dedupeSlotRows(rows)
}

function buildOnceRows(entries, duration, breakTime, reviewerId, eventId) {
  const rows = []
  entries.forEach(({ date, start, end }) => {
    if (!date || !start || !end || start >= end) return
    generateSlots(start, end, duration, breakTime).forEach(time => {
      rows.push(createSlotRow(reviewerId, eventId, date, time, duration))
    })
  })
  return dedupeSlotRows(rows)
}

// ── ModeDropdown ───────────────────────────────────────────────────────────────

function ModeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = [
    { value: 'once',   label: 'Puntual: no se repite' },
    { value: 'weekly', label: 'Recurrente semanal' },
  ]
  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative self-start">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 transition-colors border border-gray-200"
      >
        {current.label}
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden min-w-[200px]">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.value === value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TimeSelect ─────────────────────────────────────────────────────────────────

function TimeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

// ── DayRow (weekly mode) ───────────────────────────────────────────────────────

function DayRow({ day, ranges, onToggle, onAddRange, onRemoveRange, onUpdateRange }) {
  const isActive = ranges !== null

  return (
    <div className="flex items-start gap-3 min-h-[36px] py-0.5">
      <button
        type="button"
        onClick={() => onToggle(day.key)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
          isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
      >
        {day.initial}
      </button>

      <span className={`w-24 shrink-0 text-sm pt-1.5 ${isActive ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
        {day.label}
      </span>

      <div className="flex-1 flex flex-col gap-1.5">
        {!isActive ? (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-gray-400">No disponible</span>
            <button
              type="button"
              onClick={() => onToggle(day.key)}
              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors leading-none"
            >
              +
            </button>
          </div>
        ) : (
          <>
            {ranges.map((range, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <TimeSelect value={range.start} onChange={v => onUpdateRange(day.key, idx, 'start', v)} />
                <span className="text-gray-400 text-sm select-none">–</span>
                <TimeSelect value={range.end} onChange={v => onUpdateRange(day.key, idx, 'end', v)} />
                <button
                  type="button"
                  onClick={() => onRemoveRange(day.key, idx)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onAddRange(day.key)}
              className="self-start text-xs text-indigo-500 hover:text-indigo-700 transition-colors mt-0.5"
            >
              + Añadir franja
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── OnceDateRow (once mode) ────────────────────────────────────────────────────

function OnceDateRow({ entry, onUpdate, onDuplicate, onRemove }) {
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <input
        type="date"
        value={entry.date}
        min={todayDate()}
        onChange={e => onUpdate('date', e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <TimeSelect value={entry.start} onChange={v => onUpdate('start', v)} />
      <span className="text-gray-400 text-sm select-none">–</span>
      <TimeSelect value={entry.end} onChange={v => onUpdate('end', v)} />

      {/* ⊕ clone this row (same date) */}
      <button
        type="button"
        onClick={onDuplicate}
        title="Añadir otra franja en este día"
        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* ✕ remove row */}
      <button
        type="button"
        onClick={onRemove}
        title="Eliminar"
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-300 hover:border-red-300 hover:text-red-400 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── ReviewerSchedule ───────────────────────────────────────────────────────────

function ReviewerSchedule({ reviewer, eventId, duration, breakTime, onSlotsCreated }) {
  const [mode, setMode]           = useState('weekly')
  const [loadingAvailability, setLoadingAvailability] = useState(true)

  // Weekly mode state
  const [schedule, setSchedule]   = useState(initWeeklySchedule)
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  // Once mode state
  const [entries, setEntries]     = useState(initOnceEntries)

  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const rows = mode === 'weekly'
    ? buildWeeklyRows(schedule, dateFrom, dateTo, duration, breakTime, reviewer.id, eventId)
    : buildOnceRows(entries, duration, breakTime, reviewer.id, eventId)
  const preview = rows.length

  useEffect(() => {
    let ignore = false

    async function loadAvailability() {
      setLoadingAvailability(true)
      const { data, error: err } = await supabase
        .from('event_reviewer_availability')
        .select('mode, date_from, date_to, weekly_schedule, once_entries')
        .eq('event_id', eventId)
        .eq('reviewer_id', reviewer.id)
        .maybeSingle()

      if (ignore) return
      if (err) {
        setError(err.message)
        setLoadingAvailability(false)
        return
      }

      if (data) {
        setMode(data.mode === 'once' ? 'once' : 'weekly')
        setDateFrom(data.date_from ?? '')
        setDateTo(data.date_to ?? '')
        setSchedule(data.weekly_schedule ?? initWeeklySchedule())
        setEntries(Array.isArray(data.once_entries) && data.once_entries.length > 0 ? data.once_entries : initOnceEntries())
      }

      setLoadingAvailability(false)
    }

    loadAvailability()
    return () => { ignore = true }
  }, [eventId, reviewer.id])

  // ── Weekly helpers ──
  function toggleDay(key) {
    setSchedule(prev => ({
      ...prev,
      [key]: prev[key] === null ? [{ start: '09:00', end: '17:00' }] : null,
    }))
  }
  function addWeeklyRange(key) {
    setSchedule(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { start: '09:00', end: '17:00' }] }))
  }
  function removeWeeklyRange(key, idx) {
    setSchedule(prev => {
      const updated = prev[key].filter((_, i) => i !== idx)
      return { ...prev, [key]: updated.length === 0 ? null : updated }
    })
  }
  function updateWeeklyRange(key, idx, field, value) {
    setSchedule(prev => ({
      ...prev,
      [key]: prev[key].map((r, i) => i === idx ? { ...r, [field]: value } : r),
    }))
  }

  // ── Once helpers ──
  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }
  function duplicateEntry(idx) {
    setEntries(prev => [
      ...prev.slice(0, idx + 1),
      { ...prev[idx] },
      ...prev.slice(idx + 1),
    ])
  }
  function removeEntry(idx) {
    setEntries(prev => prev.length === 1 ? initOnceEntries() : prev.filter((_, i) => i !== idx))
  }
  function addEntry() {
    setEntries(prev => [...prev, { date: todayDate(), start: '09:00', end: '17:00' }])
  }

  // ── Save detected slots ──
  async function saveDetectedSlots() {
    setError('')

    if (mode === 'weekly') {
      if (!dateFrom || !dateTo)   { setError('Selecciona un rango de fechas.'); return }
      if (dateFrom > dateTo)      { setError('La fecha de inicio debe ser anterior a la fecha de fin.'); return }
    }

    if (rows.length === 0) { setError('No hay slots detectados con la configuración actual.'); return }

    setSaving(true)
    const availabilityRow = {
      event_id: eventId,
      reviewer_id: reviewer.id,
      mode,
      date_from: mode === 'weekly' ? dateFrom : null,
      date_to: mode === 'weekly' ? dateTo : null,
      weekly_schedule: schedule,
      once_entries: entries,
      updated_at: new Date().toISOString(),
    }

    const { error: availabilityErr } = await supabase
      .from('event_reviewer_availability')
      .upsert(availabilityRow, { onConflict: 'event_id,reviewer_id' })

    if (availabilityErr) {
      setSaving(false)
      setError(availabilityErr.message)
      return
    }

    // Fetch slot IDs that have real bookings so we never delete them
    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('slot_id')
    const bookedSlotIds = new Set((activeBookings ?? []).map(b => b.slot_id))

    // Fetch all slots for this reviewer+event
    let slotQuery = supabase
      .from('slots')
      .select('id')
      .eq('reviewer_id', reviewer.id)
    slotQuery = eventId
      ? slotQuery.eq('event_id', eventId)
      : slotQuery.is('event_id', null)

    const { data: existingSlots } = await slotQuery
    const idsToDelete = (existingSlots ?? [])
      .map(s => s.id)
      .filter(id => !bookedSlotIds.has(id))

    if (idsToDelete.length > 0) {
      const { error: deleteErr } = await supabase
        .from('slots')
        .delete()
        .in('id', idsToDelete)
      if (deleteErr) { setSaving(false); setError(deleteErr.message); return }
    }

    const { error: err } = await supabase
      .from('slots')
      .upsert(rows, { onConflict: 'reviewer_id,date,time' })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSlotsCreated()
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-800">{reviewer.name}</p>
        <p className="text-xs text-gray-400">{reviewer.email}</p>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {loadingAvailability && (
          <p className="text-sm text-gray-400">Cargando disponibilidad guardada…</p>
        )}

        {/* Mode switcher */}
        <div className="flex flex-col gap-2">
          <ModeDropdown value={mode} onChange={v => { setMode(v); setError('') }} />
          <p className="text-xs text-gray-400">
            {mode === 'once'
              ? 'Crea disponibilidad para fechas concretas, sin repetirse en otras semanas.'
              : 'Crea disponibilidad que se repite cada semana dentro del rango de fechas.'}
          </p>
        </div>

        {/* ── ONCE MODE ── */}
        {mode === 'once' && (
          <div className="flex flex-col gap-2">
            {entries.map((entry, idx) => (
              <OnceDateRow
                key={idx}
                entry={entry}
                onUpdate={(field, value) => updateEntry(idx, field, value)}
                onDuplicate={() => duplicateEntry(idx)}
                onRemove={() => removeEntry(idx)}
              />
            ))}
            <button
              type="button"
              onClick={addEntry}
              className="self-start text-xs text-indigo-500 hover:text-indigo-700 transition-colors mt-1"
            >
              + Añadir fecha
            </button>
          </div>
        )}

        {/* ── WEEKLY MODE ── */}
        {mode === 'weekly' && (
          <>
            <div className="flex flex-col gap-2">
              {DAYS.map(day => (
                <DayRow
                  key={day.key}
                  day={day}
                  ranges={schedule[day.key]}
                  onToggle={toggleDay}
                  onAddRange={addWeeklyRange}
                  onRemoveRange={removeWeeklyRange}
                  onUpdateRange={updateWeeklyRange}
                />
              ))}
            </div>

            <div className="border-t border-gray-100" />

            {/* Date range */}
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Aplicar desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Generate button */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={saveDetectedSlots}
            disabled={saving || preview === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors"
          >
            {saving
              ? 'Guardando…'
              : preview > 0
                ? `Guardar ${preview} slot${preview !== 1 ? 's' : ''}`
                : 'Guardar slots'}
          </button>
          {mode === 'weekly' && preview > 0 && dateFrom && dateTo && (
            <span className="text-xs text-gray-400">
              del {fmtDate(dateFrom)} al {fmtDate(dateTo)}
            </span>
          )}
        </div>
      </div>

    </div>
  )
}

// ── SlotManager (root) ─────────────────────────────────────────────────────────

export default function SlotManager({ eventId, reviewers = [], duration = 30, breakTime = 10 }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [eventId])

  async function load() {
    setLoading(true)
    setLoading(false)
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>

  if (reviewers.length === 0)
    return (
      <p className="text-sm text-gray-400">
        Añade revisores a este evento antes de configurar la disponibilidad.
      </p>
    )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Disponibilidad</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Define el horario de cada revisor para generar los slots de reserva.
        </p>
      </div>

      {reviewers.map(reviewer => (
        <ReviewerSchedule
          key={reviewer.id}
          reviewer={reviewer}
          eventId={eventId}
          duration={duration}
          breakTime={breakTime}
          onSlotsCreated={load}
        />
      ))}
    </div>
  )
}
