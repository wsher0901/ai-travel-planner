'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Mail, Thermometer, Users, Camera, Sun, TrendingUp, Compass, Clock, CreditCard, Calendar, Plane } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ── City coordinates [lat, lng] ─────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  nyc:          [ 40.71,  -74.01],
  lisbon:       [ 38.71,   -9.14],
  tokyo:        [ 35.68,  139.69],
  sydney:       [-33.87,  151.21],
  london:       [ 51.51,   -0.13],
  capeTown:     [-33.93,   18.42],
  singapore:    [  1.35,  103.82],
  paris:        [ 48.86,    2.35],
  dubai:        [ 25.20,   55.27],
  reykjavik:    [ 64.13,  -21.89],
  buenosAires:  [-34.60,  -58.38],
  bangkok:      [ 13.75,  100.52],
  hawaii:       [ 21.31, -157.86],
  chicago:      [ 41.88,  -87.63],
  miami:        [ 25.76,  -80.19],
  sanFrancisco: [ 37.77, -122.42],
  denver:       [ 39.74, -104.99],
  seattle:      [ 47.61, -122.33],
}

const ARC_PAIRS: [string, string][] = [
  ['nyc',          'lisbon'      ],  // 0
  ['tokyo',        'sydney'      ],  // 1
  ['london',       'capeTown'    ],  // 2
  ['nyc',          'hawaii'      ],  // 3
  ['dubai',        'reykjavik'   ],  // 4
  ['nyc',          'tokyo'       ],  // 5
  ['chicago',      'miami'       ],  // 6
  ['sanFrancisco', 'buenosAires' ],  // 7
  ['nyc',          'paris'       ],  // 8
  ['denver',       'seattle'     ],  // 9
]

// Arc phase type shared between GlobeSection and DestinationPanel
type ArcPhase = 'idle' | 'chatting' | 'drawing' | 'holding' | 'fading' | 'pause'

// Per-route label info for globe overlay
type RouteInfo = {
  fromLabel: string; fromEmoji: string
  toLabel:   string; toEmoji:   string
}

const ROUTE_INFO: RouteInfo[] = [
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Lisbon',       toEmoji: '🌊' },
  { fromLabel: 'Tokyo',         fromEmoji: '🗼', toLabel: 'Sydney',       toEmoji: '🦘' },
  { fromLabel: 'London',        fromEmoji: '🎡', toLabel: 'Cape Town',    toEmoji: '🏔️' },
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Hawaii',       toEmoji: '🌺' },
  { fromLabel: 'Dubai',         fromEmoji: '🏙️', toLabel: 'Reykjavik',   toEmoji: '🌌' },
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Tokyo',        toEmoji: '🗼' },
  { fromLabel: 'Chicago',       fromEmoji: '🌬️', toLabel: 'Miami',       toEmoji: '🌴' },
  { fromLabel: 'San Francisco', fromEmoji: '🌉', toLabel: 'Buenos Aires', toEmoji: '💃' },
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Paris',        toEmoji: '🗼' },
  { fromLabel: 'Denver',        fromEmoji: '🏔️', toLabel: 'Seattle',     toEmoji: '☕' },
]

// City label data for globe overlay — city name + region shown at arc endpoints
const CITY_LABELS: Record<string, { name: string; region: string }> = {
  nyc:          { name: 'New York',      region: 'United States'  },
  lisbon:       { name: 'Lisbon',        region: 'Portugal'       },
  tokyo:        { name: 'Tokyo',         region: 'Japan'          },
  sydney:       { name: 'Sydney',        region: 'Australia'      },
  london:       { name: 'London',        region: 'United Kingdom' },
  capeTown:     { name: 'Cape Town',     region: 'South Africa'   },
  singapore:    { name: 'Singapore',     region: 'Southeast Asia' },
  paris:        { name: 'Paris',         region: 'France'         },
  dubai:        { name: 'Dubai',         region: 'UAE'            },
  reykjavik:    { name: 'Reykjavik',     region: 'Iceland'        },
  buenosAires:  { name: 'Buenos Aires',  region: 'Argentina'      },
  bangkok:      { name: 'Bangkok',       region: 'Thailand'       },
  hawaii:       { name: 'Honolulu',      region: 'Hawaii, USA'    },
  chicago:      { name: 'Chicago',       region: 'United States'  },
  miami:        { name: 'Miami',         region: 'United States'  },
  sanFrancisco: { name: 'San Francisco', region: 'United States'  },
  denver:       { name: 'Denver',        region: 'United States'  },
  seattle:      { name: 'Seattle',       region: 'United States'  },
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function latLngToVec3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

function buildArcPoints(a: THREE.Vector3, b: THREE.Vector3, segs = 80, lift = 0.32): THREE.Vector3[] {
  const au = a.clone().normalize()
  const bu = b.clone().normalize()
  return Array.from({ length: segs + 1 }, (_, i) => {
    const t = i / segs
    return au.clone().lerp(bu, t).normalize().multiplyScalar(1 + lift * Math.sin(t * Math.PI))
  })
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

// ── Chat bubbles — two-bubble chat interface above the destination card ────────
function ChatInputBubble({ arcIdx }: { arcIdx: number }) {
  const query    = CHAT_PROMPTS[arcIdx]
  const response = SYSTEM_RESPONSES[arcIdx]

  const [displayed,           setDisplayed]           = useState('')
  const [typingDone,          setTypingDone]          = useState(false)
  const [systemBubbleShown,   setSystemBubbleShown]   = useState(false)
  const [line1Shown,          setLine1Shown]          = useState(false)
  const [line2IndicatorShown, setLine2IndicatorShown] = useState(false)
  const [line2Shown,          setLine2Shown]          = useState(false)

  // Type character by character at 35ms/char
  useEffect(() => {
    if (typingDone) return
    if (displayed.length < query.length) {
      const id = setTimeout(() => setDisplayed(query.slice(0, displayed.length + 1)), 35)
      return () => clearTimeout(id)
    }
    setTypingDone(true)
  }, [displayed, typingDone, query])

  // System bubble slides in 300ms after typing finishes — shows first typing indicator
  useEffect(() => {
    if (!typingDone) return
    const id = setTimeout(() => setSystemBubbleShown(true), 300)
    return () => clearTimeout(id)
  }, [typingDone])

  // Line 1 text appears 800ms after system bubble (replaces dots)
  useEffect(() => {
    if (!systemBubbleShown) return
    const id = setTimeout(() => setLine1Shown(true), 800)
    return () => clearTimeout(id)
  }, [systemBubbleShown])

  // Second typing indicator appears 1s after line 1
  useEffect(() => {
    if (!line1Shown) return
    const id = setTimeout(() => setLine2IndicatorShown(true), 1000)
    return () => clearTimeout(id)
  }, [line1Shown])

  // Line 2 text appears 800ms after second indicator
  useEffect(() => {
    if (!line2IndicatorShown) return
    const id = setTimeout(() => setLine2Shown(true), 800)
    return () => clearTimeout(id)
  }, [line2IndicatorShown])

  return (
    <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── User bubble (left-aligned, amber tint) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.28)',
          fontFamily: 'var(--font-sora)', marginBottom: '4px', letterSpacing: '0.04em',
        }}>You</span>
        <div style={{
          maxWidth: '85%',
          backgroundColor: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '16px 16px 16px 4px',
          padding: '12px 16px',
          fontSize: '14px', color: '#ffffff',
          fontFamily: 'var(--font-sora)', lineHeight: 1.55,
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

      {/* ── System bubble (slides in after typing, shows two lines sequentially) ── */}
      <AnimatePresence>
        {systemBubbleShown && (
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
          >
            {/* Roam label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Compass size={12} color="rgba(245,158,11,0.65)" />
              <span style={{
                fontSize: '10px', color: 'rgba(245,158,11,0.65)',
                fontFamily: 'var(--font-sora)', fontWeight: 500, letterSpacing: '0.04em',
              }}>Roam</span>
            </div>

            <div style={{
              maxWidth: '85%',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '4px 16px 16px 16px',
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              {/* Slot 1: typing dots → line 1 */}
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
                    style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-sora)', lineHeight: 1.5 }}
                  >
                    {response.line1}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Slot 2: typing dots → line 2 (only after line 1 is visible) */}
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
                    style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(245,158,11,0.85)', fontFamily: 'var(--font-sora)', lineHeight: 1.5 }}
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

// ── Globe + HTML overlay (merged for direct DOM access) ──────────────────────
function GlobeSection({ onReady, onArcChange, onPhaseChange, onCardVisible }: {
  onReady?: () => void
  onArcChange?: (idx: number) => void
  onPhaseChange?: (phase: ArcPhase) => void
  onCardVisible?: () => void
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fromLabelRef = useRef<HTMLDivElement>(null)
  const toLabelRef   = useRef<HTMLDivElement>(null)
  const airplaneRef  = useRef<HTMLDivElement>(null)
  const onArcChangeRef    = useRef(onArcChange)
  const onPhaseChangeRef2 = useRef(onPhaseChange)
  const onCardVisibleRef  = useRef(onCardVisible)
  onArcChangeRef.current    = onArcChange
  onPhaseChangeRef2.current = onPhaseChange
  onCardVisibleRef.current  = onCardVisible
  const [arcIdx, setArcIdx] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W    = window.innerWidth
    const H    = window.innerHeight
    const SEGS = 80

    // DOM element handles (stable after first render)
    const fromEl     = fromLabelRef.current
    const toEl       = toLabelRef.current
    const airplaneEl = airplaneRef.current

    // ── Scene / Camera / Renderer ──────────────────────────────────────────
    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    camera.position.z = 2.8

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    // ── Globe group ────────────────────────────────────────────────────────
    const globe = new THREE.Group()
    globe.position.set(0.05, 0, 0)
    globe.scale.setScalar(0.82)
    scene.add(globe)

    const loader = new THREE.TextureLoader()

    // Blue-marble texture — vivid continents, real oceans
    const earthTex = loader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      () => { onReady?.() },
    )
    earthTex.colorSpace = THREE.SRGBColorSpace

    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      // Neutral specular — avoids colour-casting on the ocean
      new THREE.MeshPhongMaterial({ map: earthTex, shininess: 18, specular: new THREE.Color(0x0a1520) }),
    ))

    // Cloud layer — rotates slightly faster than the earth in the render loop
    const cloudTex = loader.load('https://unpkg.com/three-globe/example/img/earth-clouds.png')
    cloudTex.colorSpace = THREE.SRGBColorSpace
    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 64),
      new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.38, depthWrite: false }),
    )
    globe.add(cloudMesh)

    // Whisper-thin atmospheric halo — barely visible, clean edge
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 32, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#1a3a5c'),
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      }),
    ))

    // ── Lights ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const sun = new THREE.DirectionalLight(0xfffae0, 2.4)
    sun.position.set(3, 1.5, 2.5)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x4488cc, 0.45)
    fill.position.set(-3, -1, -2)
    scene.add(fill)

    // ── City positions & layered dots ─────────────────────────────────────
    const cityVec: Record<string, THREE.Vector3> = {}
    for (const [name, [lat, lng]] of Object.entries(CITY_COORDS)) {
      cityVec[name] = latLngToVec3(lat, lng, 1.012)
    }

    // Per-city point lights for glow effect
    const cityLights: Record<string, THREE.PointLight> = {}

    for (const city of new Set<string>(ARC_PAIRS.flat())) {
      const p = cityVec[city]; if (!p) continue

      // Small amber dot
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
      )
      dot.position.copy(p); globe.add(dot)

      // Point light for glow
      const light = new THREE.PointLight(0xf59e0b, 0.3, 0.15)
      light.position.copy(p); globe.add(light)

      cityLights[city] = light
    }

    // ── Arc geometry (reusable single buffer) ──────────────────────────────
    const arcBufs: Float32Array[] = ARC_PAIRS.map(([a, b]) => {
      const pts = buildArcPoints(cityVec[a], cityVec[b], SEGS)
      const arr = new Float32Array((SEGS + 1) * 3)
      pts.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z })
      return arr
    })

    const arcPosArr = new Float32Array((SEGS + 1) * 3)
    arcPosArr.set(arcBufs[0])
    const arcAttr = new THREE.BufferAttribute(arcPosArr, 3)
    const arcGeom = new THREE.BufferGeometry()
    arcGeom.setAttribute('position', arcAttr)
    arcGeom.setDrawRange(0, 0)

    const matGlow = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0 })
    const matLine = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0 })
    globe.add(new THREE.Line(arcGeom, matGlow))
    globe.add(new THREE.Line(arcGeom, matLine))

    // ── Projection helpers ─────────────────────────────────────────────────
    // Pre-allocated to avoid per-frame allocations
    const _wp        = new THREE.Vector3()
    const _localNorm = new THREE.Vector3()
    const _camLocal  = new THREE.Vector3()

    function updateCamLocal() {
      _camLocal.copy(camera.position)
      globe.worldToLocal(_camLocal)
      _camLocal.normalize()
    }

    function project(lx: number, ly: number, lz: number): { x: number; y: number; vis: boolean } {
      _localNorm.set(lx, ly, lz).normalize()
      const vis = _localNorm.dot(_camLocal) > 0.05
      _wp.set(lx, ly, lz)
      globe.localToWorld(_wp)
      _wp.project(camera)
      return { x: (_wp.x + 1) / 2 * W, y: (-_wp.y + 1) / 2 * H, vis }
    }

    function setPos(el: HTMLDivElement | null, x: number, y: number, ty = '-100%') {
      if (!el) return
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${ty})`
    }
    function setOp(el: HTMLDivElement | null, op: number) {
      if (!el) return
      el.style.opacity = op.toFixed(3)
    }
    function hideAll() {
      setOp(fromEl, 0); setOp(toEl, 0)
      if (airplaneEl) airplaneEl.style.opacity = '0'
    }

    // ── Arc state machine ──────────────────────────────────────────────────
    let curArcIdx = 0
    let phase: ArcPhase = 'idle'
    let lastPhase: ArcPhase = 'idle'
    let tPhase = 0

    const INIT_DELAY = 0.5
    const DRAW_DUR   = 4.0
    const HOLD_DUR   = 6.0
    const FADE_DUR   = 1.0
    const PAUSE_DUR  = 0.8

    // ── Globe rotation — three modes: free / easing / slow ──────────────
    const ROT_NORMAL  = Math.PI * 2 / 75   // one full rotation per 75 s (between arcs)
    const ROT_SLOW    = Math.PI * 2 / 180  // one full rotation per 180 s (~40%, during arc)
    const EASING_DUR  = 1.5                // seconds for eased turn toward arc midpoint
    type RotMode = 'free' | 'easing' | 'slow'
    let rotMode: RotMode = 'free'
    let rotY         = 0
    let prevT        = 0
    let easingStartY = 0
    let easingTargetY= 0
    let easingStartT = 0

    function startEaseToArc(idx: number, t: number) {
      const [a, b] = ARC_PAIRS[idx]
      const va = cityVec[a], vb = cityVec[b]
      if (!va || !vb) return
      const mid    = va.clone().add(vb).normalize()
      const target = Math.atan2(-mid.x, mid.z)
      // Shortest-path rotation direction from current rotY
      const norm = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      let   diff = (target - norm) % (Math.PI * 2)
      if (diff >  Math.PI) diff -= Math.PI * 2
      if (diff < -Math.PI) diff += Math.PI * 2
      easingStartY  = rotY
      easingTargetY = rotY + diff
      easingStartT  = t
      rotMode = 'easing'
    }

    // Duration of the chatting phase:
    //   typing (35ms/char) + 0.3s bubble delay + 0.8s dots1 + 1.0s gap + 0.8s dots2 + 0.5s buffer
    function chatDur(idx: number): number {
      return CHAT_PROMPTS[idx].length * 0.035 + 3.4
    }

    let cardTriggered = false

    function loadArc(idx: number) {
      arcGeom.setDrawRange(0, 0)
      arcPosArr.set(arcBufs[idx])
      arcAttr.needsUpdate = true
      arcGeom.computeBoundingSphere()
      cardTriggered = false
      hideAll()
    }

    // ── Render loop ────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let raf: number

    function tick() {
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      const delta = Math.min(t - prevT, 0.05)
      prevT = t

      // ── Phase state machine ────────────────────────────────────────────
      if (phase === 'idle') {
        if (t >= INIT_DELAY) {
          phase = 'chatting'; tPhase = t
          loadArc(0)
          setArcIdx(0); onArcChangeRef.current?.(0)
        }
      } else {
        const dt = t - tPhase

        if (phase === 'chatting') {
          if (dt >= chatDur(curArcIdx)) {
            startEaseToArc(curArcIdx, t)
            phase = 'drawing'; tPhase = t
          }

        } else if (phase === 'drawing') {
          const p   = Math.min(dt / DRAW_DUR, 1)
          const cnt = Math.floor(p * (SEGS + 1))
          arcGeom.setDrawRange(0, cnt)
          const op = Math.min(p * 4, 1)
          matLine.opacity = op; matGlow.opacity = op * 0.15

          // Fire card-visible callback once arc reaches 30% drawn
          if (p >= 0.3 && !cardTriggered) {
            cardTriggered = true
            onCardVisibleRef.current?.()
          }

          // ── Airplane HTML overlay ──────────────────────────────────────
          if (airplaneEl && cnt > 0) {
            const leadIdx = cnt - 1
            const lx = arcPosArr[leadIdx * 3], ly = arcPosArr[leadIdx * 3 + 1], lz = arcPosArr[leadIdx * 3 + 2]
            const sp = project(lx, ly, lz)
            let angle = 0
            if (leadIdx > 0) {
              const px = arcPosArr[(leadIdx - 1) * 3], py = arcPosArr[(leadIdx - 1) * 3 + 1], pz = arcPosArr[(leadIdx - 1) * 3 + 2]
              const pp = project(px, py, pz)
              angle = Math.atan2(sp.y - pp.y, sp.x - pp.x) * (180 / Math.PI)
            }
            if (sp.vis) {
              airplaneEl.style.opacity = op.toFixed(3)
              airplaneEl.style.transform = `translate(${sp.x.toFixed(1)}px,${sp.y.toFixed(1)}px) translate(-50%,-50%) rotate(${(angle + 45).toFixed(1)}deg)`
            } else {
              airplaneEl.style.opacity = '0'
            }
          }

          if (p >= 1) { if (airplaneEl) airplaneEl.style.opacity = '0'; phase = 'holding'; tPhase = t }

        } else if (phase === 'holding') {
          if (dt >= HOLD_DUR) { phase = 'fading'; tPhase = t }

        } else if (phase === 'fading') {
          const p = Math.min(dt / FADE_DUR, 1)
          matLine.opacity = 1 - p; matGlow.opacity = (1 - p) * 0.15
          if (p >= 1) { phase = 'pause'; tPhase = t; hideAll(); rotMode = 'free' }

        } else if (phase === 'pause') {
          if (dt >= PAUSE_DUR) {
            curArcIdx = (curArcIdx + 1) % ARC_PAIRS.length
            loadArc(curArcIdx)
            setArcIdx(curArcIdx); onArcChangeRef.current?.(curArcIdx)
            phase = 'chatting'; tPhase = t
          }
        }
      }

      // Fire phase-change callback when phase transitions
      if (phase !== lastPhase) {
        lastPhase = phase
        onPhaseChangeRef2.current?.(phase)
      }

      // ── Globe rotation ────────────────────────────────────────────────
      if (rotMode === 'easing') {
        const ep   = Math.min((t - easingStartT) / EASING_DUR, 1)
        const ease = ep < 0.5 ? 2 * ep * ep : 1 - Math.pow(-2 * ep + 2, 2) / 2
        rotY = easingStartY + (easingTargetY - easingStartY) * ease
        if (ep >= 1) { rotY = easingTargetY; rotMode = 'slow' }
      } else {
        rotY += delta * (rotMode === 'slow' ? ROT_SLOW : ROT_NORMAL)
      }
      globe.rotation.y = rotY
      cloudMesh.rotation.y = t * ROT_NORMAL * 0.25   // cloud drift on absolute time

      // ── Overlay DOM updates (labels + ring pulse) ─────────────────────
      updateCamLocal()
      const labelsActive = phase === 'drawing' || phase === 'holding' || phase === 'fading'
      const [arcFrom, arcTo] = ARC_PAIRS[curArcIdx]

      // ── City light intensity ─────────────────────────────────────────────
      const lightActive = phase === 'drawing' || phase === 'holding'
      for (const [city, light] of Object.entries(cityLights)) {
        const isEndpoint = lightActive && (city === arcFrom || city === arcTo)
        light.intensity = isEndpoint ? 0.8 : 0.3
        light.distance  = isEndpoint ? 0.25 : 0.15
      }

      if (labelsActive) {
        const dt = t - tPhase
        const labelOp = phase === 'fading'
          ? Math.max(1 - Math.min(dt / FADE_DUR, 1), 0)
          : matLine.opacity

        const fv = cityVec[arcFrom]
        if (fv) {
          const sp = project(fv.x, fv.y, fv.z)
          setPos(fromEl, sp.x, sp.y, 'calc(-100% - 10px)')
          setOp(fromEl, sp.vis ? labelOp : 0)
        }
        const tv = cityVec[arcTo]
        if (tv) {
          const sp = project(tv.x, tv.y, tv.z)
          setPos(toEl, sp.x, sp.y, 'calc(-100% - 10px)')
          setOp(toEl, sp.vis ? labelOp : 0)
        }
      }

      renderer.render(scene, camera)
    }
    tick()

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else (obj.material as THREE.Material).dispose()
        }
      })
      renderer.dispose()
    }
  }, [onReady])

  const [fromKey, toKey] = ARC_PAIRS[arcIdx]
  const fromInfo = CITY_LABELS[fromKey]
  const toInfo   = CITY_LABELS[toKey]

  // Base style for floating label container — no background/border, positioned by JS each frame
  const labelBase: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0,
    opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
    display: 'inline-flex', alignItems: 'stretch', gap: '8px',
    whiteSpace: 'nowrap',
  }
  const cityLabelContent = (info: { name: string; region: string } | undefined) => !info ? null : (
    <>
      {/* Amber vertical accent bar */}
      <div style={{ width: '2px', backgroundColor: '#f59e0b', borderRadius: '1px', minHeight: '30px', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-sora)', letterSpacing: '0.02em', lineHeight: 1.25, textShadow: '0 2px 12px rgba(0,0,0,0.85)' }}>
          {info.name}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-sora)', marginTop: '1px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
          {info.region}
        </div>
      </div>
    </>
  )

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} />

      {/* City endpoint labels — floating clean text with amber accent */}
      <div ref={fromLabelRef} style={labelBase}>{cityLabelContent(fromInfo)}</div>
      <div ref={toLabelRef}   style={labelBase}>{cityLabelContent(toInfo)}</div>

      {/* Airplane icon — position updated each frame via JS transform */}
      <div
        ref={airplaneRef}
        style={{
          position: 'absolute', left: 0, top: 0,
          opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
          filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.85))',
        }}
      >
        <Plane size={18} color="#f59e0b" />
      </div>
    </div>
  )
}

// ── Story Scroll helpers ──────────────────────────────────────────────────────
function parseTemp(v: string) { const m = v.match(/(-?\d+)°C/); return m ? parseInt(m[1], 10) : 20 }
function parseGoldenHourPos(v: string) {
  const m = v.match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return 0.8
  let h = parseInt(m[1], 10); const min = parseInt(m[2], 10); const pm = m[3].toUpperCase() === 'PM'
  if (pm && h !== 12) h += 12; if (!pm && h === 12) h = 0
  return Math.max(0, Math.min(1, (h * 60 + min - 360) / 900))  // 360=6am, 900=15h span
}
function parseCostLevel(v: string) {
  const m = v.match(/\$(\d[\d,]*)/); if (!m) return 2
  const a = parseInt(m[1].replace(/,/g, ''), 10)
  return a <= 650 ? 1 : a <= 1500 ? 2 : a <= 2200 ? 3 : 4
}
function parseCrowdLevel(v: string) {
  const l = v.toLowerCase(); return l.includes('high') ? 4 : l.includes('moderate') ? 3 : 2
}

// ── Weather SVG icon ──────────────────────────────────────────────────────────
function WeatherIcon({ temp }: { temp: number }) {
  const op: React.CSSProperties = { opacity: 0.5 }
  if (temp <= 5) return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <line x1="18" y1="3"  x2="18" y2="33" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="3"  y1="18" x2="33" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="7"  y1="7"  x2="29" y2="29" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="29" y1="7"  x2="7"  y2="29" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {[{cx:18,cy:3},{cx:18,cy:33},{cx:3,cy:18},{cx:33,cy:18},{cx:7,cy:7},{cx:29,cy:29},{cx:29,cy:7},{cx:7,cy:29}].map((p,i)=>(
        <circle key={i} cx={p.cx} cy={p.cy} r="2.2" fill="white"/>
      ))}
    </svg>
  )
  if (temp <= 12) return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <path d="M4 11 Q10 7 20 11 Q26 14 28 11 Q28 9 25 9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 18 Q12 14 22 18 Q28 21 30 18 Q30 15 27 15" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M4 25 Q10 21 18 25 Q24 28 26 25 Q26 22 23 22" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
  if (temp <= 18) return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <circle cx="26" cy="13" r="5" stroke="white" strokeWidth="1.8"/>
      {[0,60,120,180,240,300].map(d => { const r=d*Math.PI/180; return (
        <line key={d} x1={26+8*Math.cos(r)} y1={13+8*Math.sin(r)} x2={26+11*Math.cos(r)} y2={13+11*Math.sin(r)} stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      )})}
      <path d="M8 26 Q6 26 5 24 Q4 19 10 18 Q10 13 16 13 Q22 13 22 18 Q25 17 25 21 Q25 24 22 25 Q20 26 18 26 Z" stroke="white" strokeWidth="1.6"/>
    </svg>
  )
  if (temp <= 25) return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <circle cx="18" cy="18" r="5.5" fill="white"/>
      {[0,45,90,135,180,225,270,315].map(d => { const r=d*Math.PI/180; return (
        <motion.line key={d}
          x1={18+9*Math.cos(r)}  y1={18+9*Math.sin(r)}
          x2={18+13*Math.cos(r)} y2={18+13*Math.sin(r)}
          stroke="white" strokeWidth="2" strokeLinecap="round"
          animate={{ opacity:[0.45,1,0.45] }}
          transition={{ duration:1.8, repeat:Infinity, delay:d/450, ease:'easeInOut' }}
        />
      )})}
    </svg>
  )
  if (temp <= 30) return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <circle cx="18" cy="18" r="7" fill="white"/>
      {[0,45,90,135,180,225,270,315].map(d => { const r=d*Math.PI/180; return (
        <line key={d} x1={18+11*Math.cos(r)} y1={18+11*Math.sin(r)} x2={18+15.5*Math.cos(r)} y2={18+15.5*Math.sin(r)} stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      )})}
    </svg>
  )
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={op}>
      <circle cx="18" cy="12" r="5.5" fill="white"/>
      {[0,45,90,135,180,225,270,315].map(d => { const r=d*Math.PI/180; return (
        <line key={d} x1={18+9*Math.cos(r)} y1={12+9*Math.sin(r)} x2={18+13*Math.cos(r)} y2={12+13*Math.sin(r)} stroke="white" strokeWidth="2" strokeLinecap="round"/>
      )})}
      <path d="M10 27 Q12 24 14 27 Q16 30 18 27" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M18 27 Q20 24 22 27 Q24 30 26 27" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M13 32 Q15 29 17 32 Q19 35 21 32 Q23 29 25 32" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// ── Specialized row content ───────────────────────────────────────────────────
function TempRowContent({ value }: { value: string }) {
  const temp = parseTemp(value)
  const pos  = Math.max(0, Math.min(1, temp / 35))
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:'54px' }}>
      <div>
        <div style={{ fontSize:'15px', fontWeight:600, color:'rgba(255,255,255,0.92)', fontFamily:'var(--font-sora)', marginBottom:'8px' }}>{value}</div>
        <div style={{ position:'relative', width:'120px', height:'6px' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:'9999px', background:'linear-gradient(to right,#60a5fa,#34d399,#fbbf24,#f87171)' }}/>
          <div style={{ position:'absolute', top:'50%', left:`${pos*100}%`, transform:'translate(-50%,-50%)', width:'10px', height:'10px', borderRadius:'50%', backgroundColor:'#fff', boxShadow:'0 0 6px rgba(0,0,0,0.6)' }}/>
        </div>
      </div>
      <WeatherIcon temp={temp}/>
    </div>
  )
}

function CrowdRowContent({ value }: { value: string }) {
  const filled = parseCrowdLevel(value)
  return (
    <div>
      <div style={{ display:'flex', gap:'5px', marginBottom:'5px', alignItems:'center' }}>
        {Array.from({length:5}).map((_,i) => (
          <div key={i} style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor: i<filled ? '#ffffff' : 'rgba(255,255,255,0.15)' }}/>
        ))}
      </div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.75)', fontFamily:'var(--font-sora)' }}>{value}</div>
    </div>
  )
}

function GoldenHourRowContent({ value, uid }: { value: string; uid: string }) {
  const pos   = parseGoldenHourPos(value)
  const theta = Math.PI * (1 - pos)
  const dotX  = +(50 + 45 * Math.cos(theta)).toFixed(2)
  const dotY  = +(45 - 45 * Math.sin(theta)).toFixed(2)
  const gId   = `gh-${uid}`
  return (
    <div>
      <div style={{ position:'relative', width:'100px', height:'52px', marginBottom:'4px' }}>
        <svg width="100" height="50" viewBox="0 0 100 50" style={{ overflow:'visible' }}>
          <defs>
            <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#fef08a"/>
              <stop offset="50%"  stopColor="#93c5fd"/>
              <stop offset="100%" stopColor="#fb923c"/>
            </linearGradient>
          </defs>
          <path d="M 5 45 A 45 45 0 0 1 95 45" fill="none" stroke={`url(#${gId})`} strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
          <circle cx={dotX} cy={dotY} r="5"  fill="#f59e0b"/>
          <circle cx={dotX} cy={dotY} r="9"  fill="#f59e0b" fillOpacity="0.22"/>
        </svg>
        <span style={{ position:'absolute', bottom:'0', left:'3px',  fontSize:'9px', color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-sora)' }}>6am</span>
        <span style={{ position:'absolute', bottom:'0', right:'3px', fontSize:'9px', color:'rgba(255,255,255,0.3)', fontFamily:'var(--font-sora)' }}>9pm</span>
      </div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.75)', fontFamily:'var(--font-sora)' }}>{value}</div>
    </div>
  )
}

function CostRowContent({ value }: { value: string }) {
  const level = parseCostLevel(value)
  return (
    <div>
      <div style={{ display:'flex', gap:'3px', marginBottom:'5px', alignItems:'baseline' }}>
        {Array.from({length:4}).map((_,i) => (
          <span key={i} style={{ fontSize:'16px', fontWeight:700, color: i<level ? '#f59e0b' : 'rgba(255,255,255,0.1)', fontFamily:'var(--font-sora)', lineHeight:1 }}>$</span>
        ))}
      </div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.75)', fontFamily:'var(--font-sora)' }}>{value}</div>
    </div>
  )
}

// ── Row content dispatcher ────────────────────────────────────────────────────
function renderStoryRow(row: DestRow, isActive: boolean, uid: string): React.ReactNode {
  const type = ROW_TYPE[row.category] ?? 'B'
  const labelEl = (
    <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'4px' }}>
      {ROW_ICONS[row.category]}
      <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.32)', textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:'var(--font-sora)' }}>
        {row.category}
      </span>
    </div>
  )
  if (row.category === 'TEMPERATURE') return (
    <div style={{ backgroundColor:'rgba(255,255,255,0.03)', borderRadius:'10px', padding:'10px 14px' }}>
      {labelEl}<TempRowContent value={row.value}/>
    </div>
  )
  if (row.category === 'CROWD LEVEL') return (
    <div>{labelEl}<CrowdRowContent value={row.value}/></div>
  )
  if (row.category === 'GOLDEN HOUR') return (
    <div>{labelEl}<GoldenHourRowContent value={row.value} uid={uid}/></div>
  )
  if (row.category === 'EST. TRIP COST') return (
    <div style={{ backgroundColor:'rgba(245,158,11,0.05)', borderRadius:'10px', padding:'10px 14px' }}>
      {labelEl}<CostRowContent value={row.value}/>
    </div>
  )
  if (type === 'D') return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', backgroundColor:'rgba(245,158,11,0.08)', borderRadius:'8px', padding:'10px 14px' }}>
      <Calendar size={14} color={ICON_COLOR} style={{ flexShrink:0 }}/>
      <div>
        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.32)', fontFamily:'var(--font-sora)', marginBottom:'2px' }}>Best time to visit</div>
        <div style={{ fontSize: isActive ? '16px' : '14px', fontWeight:600, color:'#fff', fontFamily:'var(--font-sora)' }}>{row.value}</div>
      </div>
    </div>
  )
  if (type === 'C') return (
    <div>
      {labelEl}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
        {row.value.split(',').map((tag,j) => (
          <span key={j} style={{ backgroundColor:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:'9999px', padding:'3px 10px', fontSize:'12px', color:'rgba(255,255,255,0.78)', fontFamily:'var(--font-sora)' }}>
            {tag.trim()}
          </span>
        ))}
      </div>
    </div>
  )
  return (
    <div style={{ borderLeft:'2px solid rgba(245,158,11,0.15)', paddingLeft:'12px' }}>
      {labelEl}
      <div style={{ fontSize: isActive ? '15px' : '13px', color:'rgba(255,255,255,0.85)', fontFamily:'var(--font-sora)' }}>{row.value}</div>
    </div>
  )
}

// ── Story Scroll Card ─────────────────────────────────────────────────────────
function StoryScrollCard({ dest, arcIdx }: { dest: DestData; arcIdx: number }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [heroShrunk,   setHeroShrunk]   = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(0)
    setHeroShrunk(false)
    const timers: ReturnType<typeof setTimeout>[] = []
    dest.rows.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleCount(i + 1)
        if (i === 0) setHeroShrunk(true)
      }, 300 + i * 500))
    })
    return () => timers.forEach(clearTimeout)
  }, [arcIdx])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scrollRef.current || visibleCount === 0) return
    const el = scrollRef.current
    const id = setTimeout(() => { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }, 80)
    return () => clearTimeout(id)
  }, [visibleCount])

  return (
    <div style={{
      width: '380px',
      maxHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(10,10,10,0.75)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Hero — explicit initial:300 so Framer Motion doesn't start from 0 */}
      <motion.div
        initial={{ height: 300 }}
        animate={{ height: heroShrunk ? 140 : 300 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', width: '100%', overflow: 'hidden', flexShrink: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dest.photo} alt={dest.city}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '90px', background: 'linear-gradient(to bottom,transparent,rgba(10,10,10,0.97))', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: '12px', left: '18px', right: '18px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sora)', lineHeight: 1.1 }}>{dest.city}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sora)', marginTop: '3px' }}>{dest.country}</div>
        </div>
      </motion.div>

      {/* Rows — flex:1 + minHeight:0 is the correct pattern for a scrollable flex child */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        <div style={{ padding: '10px 18px 20px' }}>
          {dest.rows.slice(0, visibleCount).map((row, i) => {
            const isActive = i === visibleCount - 1
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{ marginBottom: '10px' }}
              >
                {renderStoryRow(row, isActive, String(arcIdx))}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Destination panel ─────────────────────────────────────────────────────────
function DestinationPanel({ arcIdx, arcPhase, cardVisible }: {
  arcIdx: number; arcPhase: ArcPhase; cardVisible: boolean
}) {
  const dest = DESTINATION_DATA[arcIdx]
  const chatVisible = arcPhase === 'chatting' || arcPhase === 'drawing' || arcPhase === 'holding'
  const showCard = cardVisible && (arcPhase === 'drawing' || arcPhase === 'holding')

  return (
    <div
      className="absolute top-0 bottom-0 hidden lg:flex items-center"
      style={{ right:'5%', pointerEvents:'none' }}
    >
      <div style={{ display:'flex', flexDirection:'column', gap:'16px', width:'380px' }}>

        {/* Chat bubble — unchanged */}
        <AnimatePresence mode="wait">
          {chatVisible && (
            <motion.div
              key={`chat-${arcIdx}`}
              initial={{ opacity:0, y:16 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-10 }}
              transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
            >
              <ChatInputBubble arcIdx={arcIdx}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Story scroll card */}
        <AnimatePresence mode="wait">
          {showCard && (
            <motion.div
              key={`card-${arcIdx}`}
              initial={{ opacity:0, y:30 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-20 }}
              transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
            >
              <StoryScrollCard dest={dest} arcIdx={arcIdx}/>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

// ── Auth button ──────────────────────────────────────────────────────────────
function AuthButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const supabase = createClient()
  const [arcIdx,    setArcIdx]    = useState(0)
  const [arcPhase,  setArcPhase]  = useState<ArcPhase>('idle')
  const [cardVisible, setCardVisible] = useState(false)

  // Reset card visibility whenever a new arc starts
  useEffect(() => { setCardVisible(false) }, [arcIdx])

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
