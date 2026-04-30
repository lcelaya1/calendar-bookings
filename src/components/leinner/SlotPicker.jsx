import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function startOfMonth(year, month) {
  return new Date(year, month, 1)
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// Monday-first: Mon=0 … Sun=6
function dayOfWeek(date) {
  return (date.getDay() + 6) % 7
}

export default function SlotPicker({ onSelect, onBack, reviewerId, eventId }) {
  const [slotsByDate, setSlotsByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [today] = useState(() => new Date())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('slots')
        .select('date, time, duration_minutes, reviewer_id')
        .eq('booked', false)
        .order('date')
        .order('time')

      if (reviewerId) query = query.eq('reviewer_id', reviewerId)
      if (eventId) query = query.eq('event_id', eventId)

      const { data } = await query

      const map = {}
      for (const s of data ?? []) {
        if (!map[s.date]) map[s.date] = []
        // In round-robin mode deduplicate by time; in language mode all slots belong to one reviewer
        if (!map[s.date].find(x => x.time === s.time)) {
          map[s.date].push(s)
        }
      }
      setSlotsByDate(map)
      setLoading(false)
    }
    load()
  }, [reviewerId, eventId])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDate(null)
    setSelectedTime(null)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDate(null)
    setSelectedTime(null)
  }

  function selectDay(dateStr) {
    setSelectedDate(dateStr)
    setSelectedTime(null)
  }

  function confirmTime() {
    if (!selectedDate || !selectedTime) return
    const slot = slotsByDate[selectedDate].find(s => s.time === selectedTime)
    onSelect(slot)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Loading available slots…</p>
    </div>
  )

  const totalSlots = Object.values(slotsByDate).reduce((n, s) => n + s.length, 0)
  if (totalSlots === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-gray-600 font-medium">No slots available right now.</p>
      <p className="text-gray-400 text-sm mt-1">Check back later or contact the I&A team.</p>
    </div>
  )

  // Build calendar grid
  const firstDay = startOfMonth(viewYear, viewMonth)
  const offset = dayOfWeek(firstDay)
  const totalDays = daysInMonth(viewYear, viewMonth)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, dateStr })
  }

  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : []

  // Determine if we can go back (don't show past months)
  const isPrevDisabled = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <div className="flex flex-col lg:flex-row gap-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Calendar panel */}
      <div className="flex-1 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-100">
        {onBack && (
          <button onClick={onBack} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 transition-colors block">
            ← Back
          </button>
        )}
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Select a date &amp; time</h2>
        <p className="text-sm text-gray-400 mb-6">
          {reviewerId ? 'Choose an available slot below.' : 'Your reviewer will be assigned automatically.'}
        </p>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={prevMonth}
            disabled={isPrevDisabled}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />
            const { day, dateStr } = cell
            const hasSlots = !!slotsByDate[dateStr]
            const isPast = dateStr < todayStr
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === todayStr

            return (
              <div key={dateStr} className="flex items-center justify-center py-0.5">
                <button
                  onClick={() => hasSlots && !isPast && selectDay(dateStr)}
                  disabled={!hasSlots || isPast}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : hasSlots && !isPast
                        ? 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                        : isToday
                          ? 'text-gray-800 font-semibold'
                          : 'text-gray-300 cursor-default'
                    }
                  `}
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Time slots panel */}
      <div className="w-full lg:w-64 p-6 lg:p-8 flex flex-col">
        {!selectedDate ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-gray-400 text-center">Select a day to see available times.</p>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-80 lg:max-h-none">
              {selectedSlots.map(s => {
                const isChosen = selectedTime === s.time
                return (
                  <div key={s.time} className="flex gap-2">
                    <button
                      onClick={() => setSelectedTime(isChosen ? null : s.time)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all
                        ${isChosen
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50'
                        }
                      `}
                    >
                      {fmtTime(s.time)}
                    </button>
                    {isChosen && (
                      <button
                        onClick={confirmTime}
                        className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        Next
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
