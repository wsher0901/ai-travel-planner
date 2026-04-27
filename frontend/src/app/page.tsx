'use client'

import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Thermometer, Users, Camera, Sun, TrendingUp, Compass, Clock, CreditCard, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const GlobeSection = dynamic(() => import('@/components/landing/GlobeSection'), { ssr: false })

// Arc phase type — mirrors the type exported from GlobeSection
type ArcPhase = 'idle' | 'chatting' | 'drawing' | 'holding' | 'fading' | 'pause'

// Destination intelligence data — one entry per arc (destination = second city)
// Row display order: TRAVEL DATES (D), TEMPERATURE (A), FLIGHT TIME (B), CROWD LEVEL (B),
//   PHOTO SPOTS (C), GOLDEN HOUR (B), TRENDING (C), KNOWN FOR (C), EST. TRIP COST (A)
type DestRow  = { category: string; value: string }
type DestData = { city: string; country: string; photo: string; rows: DestRow[] }

const DESTINATION_DATA: DestData[] = [
  // 0 — nyc → lisbon
  { city: 'Lisbon',       country: 'Portugal',
    photo: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'May 10–17' },
      { category: 'TEMPERATURE',   value: '24°C — Warm & sunny' },
      { category: 'FLIGHT TIME',   value: '7h direct from JFK' },
      { category: 'CROWD LEVEL',   value: 'Low — Off-peak season' },
      { category: 'PHOTO SPOTS',   value: 'Alfama rooftops, Belém Tower' },
      { category: 'GOLDEN HOUR',   value: '8:47 PM — Long summer evenings' },
      { category: 'TRENDING',      value: 'Pastéis de nata food tours' },
      { category: 'KNOWN FOR',     value: 'Fado music, tiled streets, tram 28' },
      { category: 'EST. TRIP COST',value: '$1,200 — flights + 7 nights' },
    ] },
  // 1 — tokyo → sydney
  { city: 'Sydney',       country: 'Australia',
    photo: 'https://images.unsplash.com/photo-1524293581917-878a6d017c71?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Apr 5–16' },
      { category: 'TEMPERATURE',   value: '19°C — Crisp autumn days' },
      { category: 'FLIGHT TIME',   value: '9.5h from Narita' },
      { category: 'CROWD LEVEL',   value: 'Moderate — Shoulder season' },
      { category: 'PHOTO SPOTS',   value: 'Opera House, Bondi to Coogee' },
      { category: 'GOLDEN HOUR',   value: '5:12 PM — Perfect beach light' },
      { category: 'TRENDING',      value: 'Vivid Sydney light festival' },
      { category: 'KNOWN FOR',     value: 'Harbour Bridge, surf, wildlife' },
      { category: 'EST. TRIP COST',value: '$2,800 — flights + 11 nights' },
    ] },
  // 2 — london → capeTown
  { city: 'Cape Town',    country: 'South Africa',
    photo: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Jan 8–22' },
      { category: 'TEMPERATURE',   value: '28°C — Peak summer' },
      { category: 'FLIGHT TIME',   value: '11h from Heathrow' },
      { category: 'CROWD LEVEL',   value: 'High — Holiday season' },
      { category: 'PHOTO SPOTS',   value: 'Table Mountain, Camps Bay sunset' },
      { category: 'GOLDEN HOUR',   value: '7:58 PM — Dramatic mountain light' },
      { category: 'TRENDING',      value: 'Winelands day trips' },
      { category: 'KNOWN FOR',     value: 'Safari, penguins, Cape Point' },
      { category: 'EST. TRIP COST',value: '$2,100 — flights + 14 nights' },
    ] },
  // 3 — nyc → hawaii
  { city: 'Honolulu',     country: 'Hawaii, USA',
    photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Mar 15–22' },
      { category: 'TEMPERATURE',   value: '27°C — Tropical paradise' },
      { category: 'FLIGHT TIME',   value: '11h from JFK' },
      { category: 'CROWD LEVEL',   value: 'Moderate — Shoulder season' },
      { category: 'PHOTO SPOTS',   value: 'Waikiki Beach, Diamond Head' },
      { category: 'GOLDEN HOUR',   value: '6:45 PM — Pacific glow' },
      { category: 'TRENDING',      value: 'North Shore surf season' },
      { category: 'KNOWN FOR',     value: 'Volcanoes, luaus, snorkeling' },
      { category: 'EST. TRIP COST',value: '$1,800 — flights + 7 nights' },
    ] },
  // 4 — dubai → reykjavik
  { city: 'Reykjavik',    country: 'Iceland',
    photo: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Nov 18–25' },
      { category: 'TEMPERATURE',   value: '4°C — Bundle up' },
      { category: 'FLIGHT TIME',   value: '7h via Helsinki' },
      { category: 'CROWD LEVEL',   value: 'Low — Quiet season' },
      { category: 'PHOTO SPOTS',   value: 'Hallgrímskirkja, Blue Lagoon' },
      { category: 'GOLDEN HOUR',   value: '3:30 PM — Arctic golden glow' },
      { category: 'TRENDING',      value: 'Northern lights tours' },
      { category: 'KNOWN FOR',     value: 'Geysers, glaciers, hot springs' },
      { category: 'EST. TRIP COST',value: '$2,400 — flights + 7 nights' },
    ] },
  // 5 — nyc → tokyo
  { city: 'Tokyo',        country: 'Japan',
    photo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Mar 28–Apr 8' },
      { category: 'TEMPERATURE',   value: '18°C — Cherry blossom season' },
      { category: 'FLIGHT TIME',   value: '14h non-stop from JFK' },
      { category: 'CROWD LEVEL',   value: 'Moderate — Temples busy at dawn' },
      { category: 'PHOTO SPOTS',   value: 'Fushimi Inari 6am, Shibuya crossing' },
      { category: 'GOLDEN HOUR',   value: '6:12 PM — Soft spring light' },
      { category: 'TRENDING',      value: 'Tsukiji outer market, teamLab' },
      { category: 'KNOWN FOR',     value: '2,000+ temples, kaiseki, tech culture' },
      { category: 'EST. TRIP COST',value: '$2,600 — flights + 11 nights' },
    ] },
  // 6 — chicago → miami
  { city: 'Miami',        country: 'United States',
    photo: 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'May 5–10' },
      { category: 'TEMPERATURE',   value: '30°C — Hot and humid' },
      { category: 'FLIGHT TIME',   value: '3h from O\'Hare' },
      { category: 'CROWD LEVEL',   value: 'Low — Pre-summer' },
      { category: 'PHOTO SPOTS',   value: 'South Beach, Wynwood Walls' },
      { category: 'GOLDEN HOUR',   value: '8:02 PM — Art Deco sunset' },
      { category: 'TRENDING',      value: 'Little Havana food walks' },
      { category: 'KNOWN FOR',     value: 'Nightlife, Cuban coffee, Ocean Drive' },
      { category: 'EST. TRIP COST',value: '$900 — flights + 5 nights' },
    ] },
  // 7 — sanFrancisco → buenosAires
  { city: 'Buenos Aires', country: 'Argentina',
    photo: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Apr 1–9' },
      { category: 'TEMPERATURE',   value: '18°C — Mild autumn' },
      { category: 'FLIGHT TIME',   value: '13h from SFO' },
      { category: 'CROWD LEVEL',   value: 'Low — Off-peak' },
      { category: 'PHOTO SPOTS',   value: 'La Boca, Recoleta Cemetery' },
      { category: 'GOLDEN HOUR',   value: '6:15 PM — Golden barrio light' },
      { category: 'TRENDING',      value: 'Underground tango milongas' },
      { category: 'KNOWN FOR',     value: 'Steak, Malbec, tango' },
      { category: 'EST. TRIP COST',value: '$1,600 — flights + 8 nights' },
    ] },
  // 8 — nyc → paris
  { city: 'Paris',        country: 'France',
    photo: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Jun 10–15' },
      { category: 'TEMPERATURE',   value: '22°C — Perfect spring' },
      { category: 'FLIGHT TIME',   value: '7.5h from JFK' },
      { category: 'CROWD LEVEL',   value: 'High — Peak tourism' },
      { category: 'PHOTO SPOTS',   value: 'Trocadéro, Montmartre, Seine at dusk' },
      { category: 'GOLDEN HOUR',   value: '9:15 PM — Late European sunset' },
      { category: 'TRENDING',      value: 'Hidden wine bars in Le Marais' },
      { category: 'KNOWN FOR',     value: 'Louvre, Eiffel Tower, patisseries' },
      { category: 'EST. TRIP COST',value: '$2,200 — flights + 5 nights' },
    ] },
  // 9 — denver → seattle
  { city: 'Seattle',      country: 'United States',
    photo: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=640&q=80',
    rows: [
      { category: 'TRAVEL DATES',  value: 'Jul 18–22' },
      { category: 'TEMPERATURE',   value: '21°C — Dry summer' },
      { category: 'FLIGHT TIME',   value: '3.5h from Denver' },
      { category: 'CROWD LEVEL',   value: 'Moderate — Festival season' },
      { category: 'PHOTO SPOTS',   value: 'Pike Place, Kerry Park skyline' },
      { category: 'GOLDEN HOUR',   value: '9:05 PM — Mountain sunset' },
      { category: 'TRENDING',      value: 'Coffee crawl in Capitol Hill' },
      { category: 'KNOWN FOR',     value: 'Tech scene, seafood, Mount Rainier' },
      { category: 'EST. TRIP COST',value: '$650 — flights + 4 nights' },
    ] },
]

// Category → lucide-react icon + row style type for DestinationPanel rows
// A=Highlight, B=Detail, C=Tags, D=Dates
type RowStyleType = 'A' | 'B' | 'C' | 'D'
const ROW_TYPE: Record<string, RowStyleType> = {
  'TRAVEL DATES':   'D',
  'TEMPERATURE':    'A',
  'FLIGHT TIME':    'B',
  'CROWD LEVEL':    'B',
  'PHOTO SPOTS':    'C',
  'GOLDEN HOUR':    'B',
  'TRENDING':       'C',
  'KNOWN FOR':      'C',
  'EST. TRIP COST': 'A',
}
const ICON_COLOR = 'rgba(245,158,11,0.6)'
const ROW_ICONS: Record<string, React.ReactNode> = {
  'TEMPERATURE':    <Thermometer size={14} color={ICON_COLOR} />,
  'CROWD LEVEL':    <Users       size={14} color={ICON_COLOR} />,
  'PHOTO SPOTS':    <Camera      size={14} color={ICON_COLOR} />,
  'GOLDEN HOUR':    <Sun         size={14} color={ICON_COLOR} />,
  'TRENDING':       <TrendingUp  size={14} color={ICON_COLOR} />,
  'KNOWN FOR':      <Compass     size={14} color={ICON_COLOR} />,
  'FLIGHT TIME':    <Clock       size={14} color={ICON_COLOR} />,
  'EST. TRIP COST': <CreditCard  size={14} color={ICON_COLOR} />,
  'TRAVEL DATES':   <Calendar    size={14} color={ICON_COLOR} />,
}

const CHAT_PROMPTS = [
  "I'm based in NYC. Got May 10–17 off work. Looking for an international trip — warm weather, good food, walkable city.",
  "Living in Tokyo right now. Free April 5–16. Want beaches and hiking — somewhere in the Southern Hemisphere.",
  "Based in London. Two weeks off in January. Thinking safari + beach. International, budget flexible.",
  "I'm in New York. March 15–22 is open. Domestic trip, need to fully disconnect. Beach and nature.",
  "Currently in Dubai. Week off in November. International — want the exact opposite of desert heat.",
  "NYC resident. Free late March through early April. International, culture-heavy. I love food and temples.",
  "Living in Chicago. May 5–10 free. Quick domestic getaway. Warm, fun, easy flight.",
  "Based in SF. April 1–9 off. International trip, want something completely different from tech culture. Good wine a plus.",
  "I'm in NYC. June 10–15 open. Classic European city. International, okay to splurge a little.",
  "Based in Denver. July 18–22, short trip. Domestic, love good coffee and outdoors.",
]

const SYSTEM_RESPONSES = [
  { line1: "May in Europe, warm and walkable... checking flights from JFK.",       line2: "Lisbon is your answer. Here's the full picture →"    },
  { line1: "Southern Hemisphere beaches with hiking access... let me look.",       line2: "Sydney in April is ideal. Breaking it down →"         },
  { line1: "Safari and beach for two weeks in January... perfect timing.",         line2: "Cape Town has both. Here's everything →"              },
  { line1: "Domestic beach escape from NYC in March... nice.",                     line2: "Hawaii is the move. Check this out →"                 },
  { line1: "Opposite of desert heat in November... I know exactly where.",         line2: "Iceland. No question. Here's why →"                   },
  { line1: "Culture and food in late March from NYC... one clear answer.",         line2: "Tokyo during cherry blossoms. Look →"                 },
  { line1: "Quick warm getaway from Chicago... easy one.",                         line2: "Miami in May. Short flight, big vibes →"              },
  { line1: "Something different from SF with good wine... love this.",             line2: "Buenos Aires. Tango and Malbec await →"               },
  { line1: "Classic European splurge from NYC in June... say less.",               line2: "Paris. Always Paris. Here's the plan →"               },
  { line1: "Short domestic trip, coffee and outdoors... got it.",                  line2: "Seattle in July is chef's kiss →"                     },
]

// ── Row visual-enhancement helpers (only) ────────────────────────────────────

function parseTemp(val: string): { c: number; gradient: string; glowColor: string; icon: 'snowflake' | 'wind' | 'cloud-sun' | 'sun-pulse' | 'sun' | 'sun-heat' } {
  const m = val.match(/-?\d+/)
  const c = m ? parseInt(m[0], 10) : 20
  const gradient = c <= 5
    ? 'linear-gradient(135deg, rgba(56,140,220,0.22) 0%, rgba(30,80,160,0.12) 100%)'
    : c <= 12 ? 'linear-gradient(135deg, rgba(50,180,180,0.20) 0%, rgba(30,120,140,0.10) 100%)'
    : c <= 18 ? 'linear-gradient(135deg, rgba(200,170,60,0.18) 0%, rgba(140,120,30,0.08) 100%)'
    : c <= 25 ? 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(200,120,0,0.08) 100%)'
    : c <= 30 ? 'linear-gradient(135deg, rgba(230,120,30,0.22) 0%, rgba(180,70,10,0.10) 100%)'
    : 'linear-gradient(135deg, rgba(220,60,40,0.24) 0%, rgba(160,30,20,0.10) 100%)'
  const glowColor = c <= 5 ? 'rgba(56,140,220,0.3)' : c <= 12 ? 'rgba(50,180,180,0.25)' : c <= 18 ? 'rgba(200,170,60,0.25)' : c <= 25 ? 'rgba(245,158,11,0.3)' : c <= 30 ? 'rgba(230,120,30,0.35)' : 'rgba(220,60,40,0.35)'
  const icon = c <= 5 ? 'snowflake' as const : c <= 12 ? 'wind' as const : c <= 18 ? 'cloud-sun' as const : c <= 25 ? 'sun-pulse' as const : c <= 30 ? 'sun' as const : 'sun-heat' as const
  return { c, gradient, glowColor, icon }
}

function parseCrowd(val: string): { filled: number; color: string; dotColor: string } {
  const l = val.toLowerCase()
  if (l.startsWith('low')) return { filled: 2, color: 'rgba(74,222,128,0.85)', dotColor: 'rgba(74,222,128,0.9)' }
  if (l.startsWith('moderate')) return { filled: 3, color: 'rgba(245,158,11,0.85)', dotColor: 'rgba(245,158,11,0.9)' }
  return { filled: 5, color: 'rgba(248,113,113,0.85)', dotColor: 'rgba(248,113,113,0.9)' }
}

function parseCost(val: string): number {
  const m = val.replace(/,/g, '').match(/\d+/)
  const n = m ? parseInt(m[0], 10) : 1000
  if (n <= 700) return 1
  if (n <= 1500) return 2
  if (n <= 2200) return 3
  return 4
}

function parseGoldenHour(val: string): number {
  const m = val.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return 0.5
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const pm = m[3].toUpperCase() === 'PM'
  if (pm && h !== 12) h += 12
  if (!pm && h === 12) h = 0
  const totalMin = h * 60 + min
  // 6am = 360min, 9pm = 1260min → range 900min
  return Math.max(0, Math.min(1, (totalMin - 360) / 900))
}

function TempIcon({ type, size = 46 }: { type: string; size?: number }) {
  const s = size, o = 0.7, c = 'rgba(255,255,255,0.9)'
  if (type === 'snowflake') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={o}>
      <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  )
  if (type === 'wind') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={o}>
      <path d="M3 8h12a3 3 0 100-3" /><path d="M3 16h16a3 3 0 010 3" /><path d="M3 12h9a3 3 0 110 3" />
    </svg>
  )
  if (type === 'cloud-sun') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={o}>
      <circle cx="10" cy="10" r="3" /><path d="M10 3v2" /><path d="M10 15v2" /><path d="M3 10h2" /><path d="M15 10h2" />
      <path d="M18 18H8a4 4 0 01-.5-7.97" />
    </svg>
  )
  if (type === 'sun-heat') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={o}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" />
      <path d="M5.6 5.6l1.8 1.8" /><path d="M16.6 16.6l1.8 1.8" /><path d="M18.4 5.6l-1.8 1.8" /><path d="M7.4 16.6l-1.8 1.8" />
      <path d="M8 20s1-2 4-2 4 2 4 2" />
    </svg>
  )
  // sun / sun-pulse — same icon
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity={o}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" />
      <path d="M5.6 5.6l1.8 1.8" /><path d="M16.6 16.6l1.8 1.8" /><path d="M18.4 5.6l-1.8 1.8" /><path d="M7.4 16.6l-1.8 1.8" />
    </svg>
  )
}

// ── Typing indicator — three pulsing dots ─────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0' }}>
      {[0, 1, 2].map(d => (
        <motion.span
          key={d}
          style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)', display: 'inline-block', flexShrink: 0 }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// ── Chat command bar content — clean text on glass, no bubble backgrounds ─────
function ChatBarContent({ arcIdx }: { arcIdx: number }) {
  const query    = CHAT_PROMPTS[arcIdx]
  const response = SYSTEM_RESPONSES[arcIdx]

  const [displayed,           setDisplayed]           = useState('')
  const [typingDone,          setTypingDone]          = useState(false)
  const [systemShown,         setSystemShown]         = useState(false)
  const [line1Shown,          setLine1Shown]          = useState(false)
  const [line2IndicatorShown, setLine2IndicatorShown] = useState(false)
  const [line2Shown,          setLine2Shown]          = useState(false)

  useEffect(() => {
    if (typingDone) return
    if (displayed.length < query.length) {
      const id = setTimeout(() => setDisplayed(query.slice(0, displayed.length + 1)), 35)
      return () => clearTimeout(id)
    }
    // Typing finished — schedule the completion flag via a microtask so React
    // doesn't flag it as a setState-in-effect cascading render.
    const id = setTimeout(() => setTypingDone(true), 0)
    return () => clearTimeout(id)
  }, [displayed, typingDone, query])

  useEffect(() => {
    if (!typingDone) return
    const id = setTimeout(() => setSystemShown(true), 300)
    return () => clearTimeout(id)
  }, [typingDone])

  useEffect(() => {
    if (!systemShown) return
    const id = setTimeout(() => setLine1Shown(true), 800)
    return () => clearTimeout(id)
  }, [systemShown])

  useEffect(() => {
    if (!line1Shown) return
    const id = setTimeout(() => setLine2IndicatorShown(true), 1000)
    return () => clearTimeout(id)
  }, [line1Shown])

  useEffect(() => {
    if (!line2IndicatorShown) return
    const id = setTimeout(() => setLine2Shown(true), 800)
    return () => clearTimeout(id)
  }, [line2IndicatorShown])

  const tShadow = '0 1px 16px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.8)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── User message row ── */}
      <div>
        <span style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.25)',
          fontFamily: 'var(--font-sora)', letterSpacing: '0.04em',
          display: 'block', marginBottom: '5px', textShadow: tShadow,
        }}>You</span>
        <div style={{
          fontSize: '14px', color: 'rgba(255,255,255,0.85)',
          fontFamily: 'var(--font-sora)', lineHeight: 1.5, textShadow: tShadow,
        }}>
          {displayed}
          {!typingDone && (
            <motion.span
              className="ml-[2px] inline-block h-[13px] w-[2px] align-middle"
              style={{ backgroundColor: '#f59e0b' }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
            />
          )}
        </div>
      </div>

      {/* ── Roam response row ── */}
      <AnimatePresence>
        {systemShown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {/* Roam label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <Compass size={12} color="rgba(245,158,11,0.65)" style={{ filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.9))' }} />
              <span style={{
                fontSize: '10px', color: 'rgba(245,158,11,0.65)',
                fontFamily: 'var(--font-sora)', fontWeight: 500, letterSpacing: '0.04em', textShadow: tShadow,
              }}>Roam</span>
            </div>

            {/* Response lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <AnimatePresence mode="wait">
                {!line1Shown ? (
                  <motion.div key="dots1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <TypingDots />
                  </motion.div>
                ) : (
                  <motion.div
                    key="line1"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-sora)', lineHeight: 1.5, textShadow: tShadow }}
                  >
                    {response.line1}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {line2IndicatorShown && !line2Shown && (
                  <motion.div key="dots2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <TypingDots />
                  </motion.div>
                )}
                {line2Shown && (
                  <motion.div
                    key="line2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(245,158,11,0.85)', fontFamily: 'var(--font-sora)', lineHeight: 1.5, textShadow: tShadow }}
                  >
                    {response.line2}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}



// ── Chat overlay — frosted-glass command bar at bottom center ─────────────────
function ChatOverlay({ arcIdx, arcPhase }: { arcIdx: number; arcPhase: ArcPhase }) {
  const chatVisible = arcPhase === 'chatting' || arcPhase === 'drawing' || arcPhase === 'holding'

  return (
    <div style={{
      position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, pointerEvents: 'none',
      width: '680px', maxWidth: '88vw',
    }}>
      <AnimatePresence mode="wait">
        {chatVisible && (
          <motion.div
            key={`chat-${arcIdx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{
              borderLeft: '2px solid rgba(245,158,11,0.55)',
              paddingLeft: '14px',
            }}>
              <ChatBarContent arcIdx={arcIdx} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Destination intelligence panel ───────────────────────────────────────────
function DestinationPanel({ arcIdx, arcPhase, cardVisible }: {
  arcIdx: number; arcPhase: ArcPhase; cardVisible: boolean
}) {
  const dest = DESTINATION_DATA[arcIdx]
  const showCard = cardVisible && (arcPhase === 'drawing' || arcPhase === 'holding')

  return (
    <div
      className="absolute top-0 bottom-0 hidden lg:flex items-start"
      style={{ right: '5%', pointerEvents: 'none', paddingTop: '8vh', paddingBottom: '3vh' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '380px', maxHeight: 'calc(89vh)', overflow: 'hidden' }}>

        {/* Destination card — appears only when arc reaches 30% drawn */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {showCard && (
              <motion.div
                key={`card-${arcIdx}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
            <div
            style={{
              width: '380px',
              backgroundColor: 'rgba(10,10,10,0.82)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '2px solid rgba(245,158,11,0.55)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column' as const,
              maxHeight: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Hero image — always at top, never moves */}
            <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
              <Image
                src={dest.photo}
                alt={dest.city}
                width={640}
                height={200}
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '85px',
                background: 'linear-gradient(to bottom, transparent, rgba(10,10,10,0.97))',
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '18px', right: '18px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sora)', lineHeight: 1.1 }}>
                  {dest.city}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sora)', marginTop: '3px' }}>
                  {dest.country}
                </div>
              </div>
            </div>

            {/* Data rows — staggered reveal, type-based styling */}
            <div className="no-scrollbar" style={{ padding: '10px 18px 16px', display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'] }}>
              {dest.rows.map((row, i) => {
                const type = ROW_TYPE[row.category] ?? 'B'
                const labelEl = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                    {ROW_ICONS[row.category]}
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-sora)' }}>
                      {row.category}
                    </span>
                  </div>
                )
                let inner: React.ReactNode

                if (row.category === 'TEMPERATURE') {
                  const { c, gradient, glowColor, icon } = parseTemp(row.value)
                  const pct = Math.max(0, Math.min(100, ((c + 10) / 50) * 100))
                  inner = (
                    <div style={{
                      background: gradient, borderRadius: '8px', padding: '12px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '70px',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      {/* Radial glow on icon side */}
                      <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', width: '90px', height: '90px', borderRadius: '50%', background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`, pointerEvents: 'none' }} />
                      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                        {labelEl}
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sora)', marginBottom: '8px', letterSpacing: '-0.01em' }}>{row.value}</div>
                        <div style={{ position: 'relative', width: '130px', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #3b82f6, #06b6d4, #f59e0b, #ef4444)', boxShadow: '0 0 6px rgba(0,0,0,0.3)' }}>
                          <div style={{ position: 'absolute', top: '-3px', left: `${pct}%`, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fff', border: '2px solid rgba(0,0,0,0.25)', transform: 'translateX(-50%)', boxShadow: '0 0 6px rgba(255,255,255,0.5)' }} />
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: '10px', position: 'relative', zIndex: 1 }}>
                        <TempIcon type={icon} />
                      </div>
                    </div>
                  )
                } else if (row.category === 'CROWD LEVEL') {
                  const { filled, color, dotColor } = parseCrowd(row.value)
                  const crowdWord = row.value.includes('—') ? row.value.split('—')[1].trim() : row.value
                  const levelWord = row.value.toLowerCase().startsWith('low') ? 'Low' : row.value.toLowerCase().startsWith('moderate') ? 'Moderate' : 'High'
                  inner = (
                    <div style={{ borderLeft: '2px solid rgba(245,158,11,0.15)', paddingLeft: '12px' }}>
                      {labelEl}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0', position: 'relative' }}>
                          {/* Track line behind dots */}
                          <div style={{ position: 'absolute', top: '50%', left: '5px', right: '5px', height: '2px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '1px', transform: 'translateY(-50%)' }} />
                          {[0, 1, 2, 3, 4].map(j => (
                            <div key={j} style={{
                              width: '11px', height: '11px', borderRadius: '50%', position: 'relative', zIndex: 1,
                              backgroundColor: j < filled ? dotColor : 'rgba(255,255,255,0.12)',
                              boxShadow: j < filled ? `0 0 6px ${dotColor}, 0 0 2px ${dotColor}` : 'none',
                              margin: '0 2px',
                            }} />
                          ))}
                        </div>
                        <span style={{ fontSize: '13px', fontFamily: 'var(--font-sora)' }}>
                          <span style={{ color, fontWeight: 600 }}>{levelWord}</span>
                          {crowdWord !== levelWord && <span style={{ color: 'rgba(255,255,255,0.5)' }}> — {crowdWord}</span>}
                        </span>
                      </div>
                    </div>
                  )
                } else if (row.category === 'GOLDEN HOUR') {
                  const pos = parseGoldenHour(row.value)
                  const gradId = `gh-grad-${i}`
                  // Semicircle arc: 100px wide, lowered so labels fit below
                  const cx = 50, cy = 38, r = 34
                  const angle = Math.PI - pos * Math.PI
                  const dotX = cx + r * Math.cos(angle)
                  const dotY = cy - r * Math.sin(angle)
                  inner = (
                    <div style={{ borderLeft: '2px solid rgba(245,158,11,0.15)', paddingLeft: '12px' }}>
                      {labelEl}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <svg width="100" height="58" viewBox="0 0 100 58">
                          <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#fde68a" />
                              <stop offset="50%" stopColor="#7dd3fc" />
                              <stop offset="100%" stopColor="#fb923c" />
                            </linearGradient>
                          </defs>
                          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" />
                          <circle cx={dotX} cy={dotY} r="5" fill="#f59e0b" opacity="0.9" />
                          <circle cx={dotX} cy={dotY} r="8" fill="#f59e0b" opacity="0.2" />
                          {/* Time labels below arc baseline */}
                          <text x={cx - r} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="var(--font-sora)">6am</text>
                          <text x={cx + r} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="var(--font-sora)">9pm</text>
                        </svg>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sora)' }}>{row.value}</div>
                      </div>
                    </div>
                  )
                } else if (row.category === 'EST. TRIP COST') {
                  const dots = parseCost(row.value)
                  const costText = row.value.includes('—') ? row.value.split('—')[0].trim() : row.value
                  const costDesc = row.value.includes('—') ? row.value.split('—')[1].trim() : ''
                  inner = (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {labelEl}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', marginTop: '2px' }}>
                        {[0, 1, 2, 3].map(j => (
                          <span key={j} style={{
                            fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-sora)',
                            color: j < dots ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                            textShadow: j < dots ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                          }}>$</span>
                        ))}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sora)' }}>{costText}</div>
                      {costDesc && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sora)', marginTop: '2px' }}>{costDesc}</div>}
                    </div>
                  )
                } else if (type === 'D') {
                  inner = (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: '8px', padding: '10px 14px' }}>
                      <Calendar size={14} color={ICON_COLOR} style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.32)', fontFamily: 'var(--font-sora)', marginBottom: '2px' }}>Best time to visit</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-sora)' }}>{row.value}</div>
                      </div>
                    </div>
                  )
                } else if (type === 'B') {
                  inner = (
                    <div style={{ borderLeft: '2px solid rgba(245,158,11,0.15)', paddingLeft: '12px' }}>
                      {labelEl}
                      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sora)' }}>{row.value}</div>
                    </div>
                  )
                } else {
                  // type C — pill tags
                  inner = (
                    <div>
                      {labelEl}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {row.value.split(',').map((tag, j) => (
                          <span key={j} style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '9999px', padding: '3px 10px', fontSize: '12px', color: 'rgba(255,255,255,0.78)', fontFamily: 'var(--font-sora)' }}>
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                }
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: [0.3,0.8,1.3,1.8,2.3,2.8,3.3,3.8,4.3][i] ?? 0.3, duration: 0.35, ease: 'easeOut' }}
                  >
                    {inner}
                  </motion.div>
                )
              })}
            </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}

// ── Auth button ──────────────────────────────────────────────────────────────
function AuthButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center justify-center gap-3 rounded-lg"
      style={{
        width: '340px', padding: '16px 28px',
        backgroundColor: 'rgba(10,10,10,0.72)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderWidth: '1px', borderStyle: 'solid', borderColor: '#2a2a2a',
        color: '#ffffff',
        fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sora)',
      }}
      initial={{ borderColor: '#2a2a2a' }}
      whileHover={{
        borderColor: 'rgba(245,158,11,0.6)',
        boxShadow: 'inset 0 0 20px rgba(245,158,11,0.06), 0 0 0 1px rgba(245,158,11,0.1), 0 8px 32px rgba(245,158,11,0.12)',
        scale: 1.015,
      }}
      whileTap={{ scale: 0.975 }}
      transition={{ duration: 0.14 }}
    >
      {icon}{label}
    </motion.button>
  )
}

// ── Email magic-link section ──────────────────────────────────────────────────
function EmailSection() {
  const supabase = createClient()
  const [open,  setOpen]  = useState(false)
  const [email, setEmail] = useState('')
  const [sent,  setSent]  = useState(false)
  const [busy,  setBusy]  = useState(false)

  const send = async () => {
    if (!email.trim()) return
    setBusy(true)
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
    setBusy(false)
  }

  return (
    <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Toggle button */}
      <motion.button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex cursor-pointer items-center justify-center gap-3 rounded-lg"
        style={{
          width: '340px', padding: '16px 28px',
          backgroundColor: 'rgba(10,10,10,0.72)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderWidth: '1px', borderStyle: 'solid', borderColor: open ? 'rgba(245,158,11,0.5)' : '#2a2a2a',
          color: '#ffffff',
          fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-sora)',
        }}
        whileHover={{
          borderColor: 'rgba(245,158,11,0.6)',
          boxShadow: 'inset 0 0 20px rgba(245,158,11,0.06), 0 0 0 1px rgba(245,158,11,0.1), 0 8px 32px rgba(245,158,11,0.12)',
          scale: 1.015,
        }}
        whileTap={{ scale: 0.975 }}
        transition={{ duration: 0.14 }}
      >
        <Mail size={16} strokeWidth={2} />
        Continue with Email
      </motion.button>

      {/* Expandable email form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!sent ? (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="your@email.com"
                    autoFocus
                    style={{
                      width: '100%', padding: '13px 16px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff', fontSize: '15px', fontFamily: 'var(--font-sora)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <motion.button
                    type="button"
                    onClick={send}
                    disabled={busy}
                    style={{
                      width: '100%', padding: '13px 16px',
                      backgroundColor: busy ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: '8px',
                      color: busy ? 'rgba(255,255,255,0.5)' : '#f59e0b',
                      fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-sora)',
                      cursor: busy ? 'default' : 'pointer',
                    }}
                    whileHover={busy ? {} : { backgroundColor: 'rgba(245,158,11,0.25)', borderColor: 'rgba(245,158,11,0.7)' }}
                    whileTap={busy ? {} : { scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                  >
                    {busy ? 'Sending…' : 'Send magic link →'}
                  </motion.button>
                </>
              ) : (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '13px 16px',
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '8px',
                    color: '#f59e0b', fontSize: '14px', fontFamily: 'var(--font-sora)',
                    textAlign: 'center',
                  }}
                >
                  ✓ Check your inbox
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [arcIdx,    setArcIdx]    = useState(0)
  const [arcPhase,  setArcPhase]  = useState<ArcPhase>('idle')
  const [cardVisible, setCardVisible] = useState(false)

  // Redirect already-authenticated users straight to /plan
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/plan')
    })
  }, [supabase, router])

  // Reset card visibility whenever a new arc starts — queued via microtask to
  // avoid the cascading-render lint warning.
  useEffect(() => {
    const id = setTimeout(() => setCardVisible(false), 0)
    return () => clearTimeout(id)
  }, [arcIdx])

  const signIn = (provider: 'google' | 'github') => {
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>

      {/* Globe + overlays — fade in over 1 s */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <GlobeSection onArcChange={setArcIdx} onPhaseChange={setArcPhase} onCardVisible={() => setCardVisible(true)} />
      </motion.div>

      {/* Chat overlay — bottom-center over globe */}
      <ChatOverlay arcIdx={arcIdx} arcPhase={arcPhase} />

      {/* Destination panel — right side, desktop only */}
      <div className="absolute inset-0 z-[2]" style={{ pointerEvents: 'none' }}>
        <DestinationPanel arcIdx={arcIdx} arcPhase={arcPhase} cardVisible={cardVisible} />
      </div>

      {/* Gradient — darkens left panel for text legibility */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(100deg, rgba(10,10,10,0.94) 0%, rgba(10,10,10,0.88) 28%, rgba(10,10,10,0.55) 46%, rgba(10,10,10,0.12) 64%, transparent 80%)',
        }}
      />

      {/* Login content — vertically centered, left side */}
      <div className="relative z-10 flex min-h-screen items-center">
        <div className="w-full max-w-[520px] px-12 md:px-20">

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 font-bold leading-none text-white"
            style={{ fontFamily: 'var(--font-sora)', fontSize: '96px', letterSpacing: '-0.035em' }}
          >
            Roam
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
            style={{ fontFamily: 'var(--font-sora)', fontSize: '16px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.01em' }}
          >
            AI-powered travel planning
          </motion.p>

          {/* Label above buttons */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            style={{
              fontFamily: 'var(--font-sora)',
              fontSize: '11px', fontWeight: 500,
              color: 'rgba(245,158,11,0.55)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Sign in to start planning
          </motion.p>

          <div className="flex flex-col gap-3">
            {[
              { provider: 'google' as const, icon: <GoogleIcon />, label: 'Continue with Google' },
              { provider: 'github' as const, icon: <GitHubIcon />, label: 'Continue with GitHub' },
            ].map(({ provider, icon, label }, i) => (
              <motion.div
                key={provider}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <AuthButton onClick={() => signIn(provider)} icon={icon} label={label} />
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <EmailSection />
            </motion.div>
          </div>

        </div>
      </div>
    </main>
  )
}
