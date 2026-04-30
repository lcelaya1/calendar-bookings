import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createCalendarEvent } from '../lib/calendarApi'
import { extractMeetLink } from '../lib/google'
import LanguagePicker from '../components/leinner/LanguagePicker'
import SlotPicker from '../components/leinner/SlotPicker'
import BookingForm from '../components/leinner/BookingForm'
import Confirmation from '../components/leinner/Confirmation'

export default function BookingPage() {
  const { eventId } = useParams()

  const [event, setEvent] = useState(undefined) // undefined = loading, null = not found
  const [reviewersByLanguage, setReviewersByLanguage] = useState({})
  const [step, setStep] = useState(null) // 'language' | 'pick' | 'form' | 'confirmed'
  const [selectedReviewer, setSelectedReviewer] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [confirmedBooking, setConfirmedBooking] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data }, { data: cfg }] = await Promise.all([
        supabase
          .from('events')
          .select('*, event_reviewers(reviewer_id, language, reviewers(id, name, email))')
          .eq('id', eventId)
          .single(),
        supabase.from('config').select('bookings_open').eq('id', 1).single(),
      ])

      // Global kill-switch overrides individual event setting
      if (!data) { setEvent(null); return }
      const effectivelyOpen = data.is_open && (cfg?.bookings_open ?? true)
      setEvent({ ...data, is_open: effectivelyOpen })

      if (data.assignment_method === 'language') {
        const byLang = {}
        for (const er of data.event_reviewers ?? []) {
          if (er.language && er.reviewers) {
            byLang[er.language] = er.reviewers
          }
        }
        setReviewersByLanguage(byLang)
        setStep('language')
      } else {
        setStep('pick')
      }
    }
    load()
  }, [eventId])

  function handleLanguageSelect(lang) {
    setSelectedReviewer(reviewersByLanguage[lang] ?? null)
    setStep('pick')
  }

  async function handleConfirmed(booking) {
    setConfirmedBooking(booking)
    setStep('confirmed')

    try {
      const { data: reviewer } = await supabase
        .from('reviewers')
        .select('email, name')
        .eq('id', booking.reviewerId)
        .single()

      const reviewerFirstName = reviewer.name.split(' ')[0].toUpperCase()
      const eventTitle = `[ONLINE] ${reviewerFirstName} - CANDIDATURA SUP (${booking.name})`

      const calEvent = await createCalendarEvent({
        title: eventTitle,
        description: event?.event_desc || '',
        date: booking.slot.date,
        time: booking.slot.time,
        durationMinutes: booking.slot.duration_minutes,
        reviewerEmail: reviewer.email,
        leinnerEmail: booking.email,
        leinnerName: `${booking.name} — ${booking.project}`,
      })

      const meetLink = extractMeetLink(calEvent)
      await supabase.from('bookings').update({
        google_event_id: calEvent.id,
        google_meet_link: meetLink ?? '',
      }).eq('id', booking.bookingId)

      if (meetLink) setConfirmedBooking(prev => ({ ...prev, meetLink }))
    } catch (err) {
      console.error('Google Calendar error:', err.message)
    }
  }

  // Loading
  if (event === undefined || step === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  // Event not found
  if (event === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-gray-700">Event not found</p>
          <p className="text-sm text-gray-400 mt-1">This booking link is invalid or the event no longer exists.</p>
        </div>
      </div>
    )
  }

  // Event closed
  if (!event.is_open) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-gray-700">Bookings are closed</p>
          <p className="text-sm text-gray-400 mt-1">
            <strong>{event.name}</strong> is not accepting bookings right now. Check back later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`mx-auto px-6 py-10 ${step === 'pick' ? 'max-w-4xl' : 'max-w-lg'}`}>
        {step === 'language' && (
          <LanguagePicker
            reviewersByLanguage={reviewersByLanguage}
            onSelect={handleLanguageSelect}
          />
        )}
        {step === 'pick' && (
          <SlotPicker
            reviewerId={selectedReviewer?.id ?? null}
            eventId={eventId}
            onSelect={slot => { setSelectedSlot(slot); setStep('form') }}
            onBack={event.assignment_method === 'language' ? () => setStep('language') : null}
          />
        )}
        {step === 'form' && (
          <BookingForm
            slot={selectedSlot}
            reviewerId={selectedReviewer?.id ?? null}
            eventId={eventId}
            onBack={() => setStep('pick')}
            onConfirmed={handleConfirmed}
          />
        )}
        {step === 'confirmed' && (
          <Confirmation booking={confirmedBooking} />
        )}
      </div>
    </div>
  )
}
