'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ── City coordinates [lat, lng] ─────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  nyc:         [ 40.71, -74.01],
  lisbon:      [ 38.71,  -9.14],
  tokyo:       [ 35.68, 139.69],
  sydney:      [-33.87, 151.21],
  london:      [ 51.51,  -0.13],
  capeTown:    [-33.93,  18.42],
  singapore:   [  1.35, 103.82],
  paris:       [ 48.86,   2.35],
  dubai:       [ 25.20,  55.27],
  reykjavik:   [ 64.13, -21.89],
  buenosAires: [-34.60, -58.38],
  bangkok:     [ 13.75, 100.52],
}

const ARC_PAIRS: [string, string][] = [
  ['nyc',         'lisbon'   ],
  ['tokyo',       'sydney'   ],
  ['london',      'capeTown' ],
  ['singapore',   'paris'    ],
  ['dubai',       'reykjavik'],
  ['nyc',         'tokyo'    ],
  ['buenosAires', 'london'   ],
  ['bangkok',     'lisbon'   ],
]

const DESTINATIONS = [
  'Free in mid-May? You should be in Lisbon.',
  'A week in July from NYC? Head to the Azores.',
  'Long weekend in October? Kyoto is calling.',
  'Two weeks in January? Try Cape Town.',
  'Spring break with family? Costa Rica awaits.',
  'Free in late September? Buenos Aires is perfect.',
]

// Per-route info cards — shown progressively during arc draw
type CardInfo = { category: string; icon: string; text: string }
type RouteInfo = {
  fromLabel: string; fromEmoji: string
  toLabel:   string; toEmoji:   string
  cards:     [CardInfo, CardInfo, CardInfo, CardInfo]
}

const ROUTE_INFO: RouteInfo[] = [
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Lisbon',     toEmoji: '🌊',
    cards: [{ category: 'WEATHER', icon: '🌡️', text: '24°C and sunny' }, { category: 'TIMING', icon: '🌅', text: 'Golden hour: 8:47pm' }, { category: 'CROWDS', icon: '👥', text: 'Low crowds in May' }, { category: 'FLIGHT', icon: '✈️', text: 'Direct: ~7 hrs' }] },
  { fromLabel: 'Tokyo',         fromEmoji: '🗼', toLabel: 'Sydney',     toEmoji: '🦘',
    cards: [{ category: 'WEATHER', icon: '🥾', text: 'Perfect hiking weather' }, { category: 'TIMING', icon: '🌅', text: 'Bondi sunset: 5:12pm' }, { category: 'FLIGHT', icon: '✈️', text: 'Flight: ~9.5 hrs' }, { category: 'COST', icon: '💰', text: 'AUD 180/night avg' }] },
  { fromLabel: 'London',        fromEmoji: '🎡', toLabel: 'Cape Town',  toEmoji: '🏔️',
    cards: [{ category: 'WEATHER', icon: '🌡️', text: '28°C, beach season' }, { category: 'TIMING', icon: '📸', text: 'Table Mtn: before 10am' }, { category: 'WILDLIFE', icon: '🦁', text: 'Safari peak season' }, { category: 'FLIGHT', icon: '✈️', text: 'Flight: ~11 hrs' }] },
  { fromLabel: 'Singapore',     fromEmoji: '🦁', toLabel: 'Paris',      toEmoji: '🗼',
    cards: [{ category: 'NATURE', icon: '🌸', text: 'Gardens in full bloom' }, { category: 'WEATHER', icon: '🌡️', text: '22°C in Paris' }, { category: 'FLIGHT', icon: '✈️', text: 'Direct flight: 13 hrs' }, { category: 'CULTURE', icon: '🎨', text: 'Louvre — skip the line' }] },
  { fromLabel: 'Dubai',         fromEmoji: '🏙️', toLabel: 'Reykjavik',  toEmoji: '🌌',
    cards: [{ category: 'NATURE', icon: '🌌', text: 'Northern lights season' }, { category: 'WEATHER', icon: '🌡️', text: '4°C — pack layers' }, { category: 'ACTIVITY', icon: '💧', text: 'Geothermal hot springs' }, { category: 'FLIGHT', icon: '✈️', text: 'Via Helsinki: ~7 hrs' }] },
  { fromLabel: 'New York',      fromEmoji: '🗽', toLabel: 'Tokyo',      toEmoji: '🗼',
    cards: [{ category: 'NATURE', icon: '🌸', text: 'Cherry blossom peak' }, { category: 'TIMING', icon: '📸', text: '6am at Fushimi Inari' }, { category: 'CROWDS', icon: '👥', text: 'Temple crowds: moderate' }, { category: 'FLIGHT', icon: '✈️', text: 'Non-stop: ~14 hrs' }] },
  { fromLabel: 'Buenos Aires',  fromEmoji: '💃', toLabel: 'London',     toEmoji: '🎡',
    cards: [{ category: 'CULTURE', icon: '🎭', text: 'Tango festival in March' }, { category: 'WEATHER', icon: '🌡️', text: 'Late summer warmth' }, { category: 'FLIGHT', icon: '✈️', text: 'Flight: ~14 hrs' }, { category: 'COST', icon: '💷', text: '£120/night avg' }] },
  { fromLabel: 'Bangkok',       fromEmoji: '🛕', toLabel: 'Lisbon',     toEmoji: '🌊',
    cards: [{ category: 'WEATHER', icon: '🌡️', text: '28°C — bring sunscreen' }, { category: 'NATURE', icon: '🌸', text: 'Jacaranda trees in bloom' }, { category: 'FLIGHT', icon: '✈️', text: 'Stopover in Doha' }, { category: 'FOOD', icon: '🍷', text: 'Pastel de nata season' }] },
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

// ── City photo data ──────────────────────────────────────────────────────────
const PHOTO_CITY_DATA = [
  { key: 'nyc',      label: 'New York',  src: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f04?w=200&q=80' },
  { key: 'london',   label: 'London',    src: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=200&q=80' },
  { key: 'tokyo',    label: 'Tokyo',     src: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200&q=80' },
  { key: 'lisbon',   label: 'Lisbon',    src: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=200&q=80' },
  { key: 'sydney',   label: 'Sydney',    src: 'https://images.unsplash.com/photo-1524293581917-878a6d017c71?w=200&q=80' },
  { key: 'capeTown', label: 'Cape Town', src: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=200&q=80' },
] as const

// ── Typewriter ───────────────────────────────────────────────────────────────
function TypewriterText({ active }: { active: boolean }) {
  const [destIdx,   setDestIdx]   = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [phase,     setPhase]     = useState<'idle' | 'typing' | 'holding' | 'erasing'>('idle')

  useEffect(() => {
    if (active && phase === 'idle') setPhase('typing')
  }, [active, phase])

  useEffect(() => {
    if (phase === 'idle') return
    const full = DESTINATIONS[destIdx]
    if (phase === 'typing') {
      if (displayed.length < full.length) {
        const id = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), 40)
        return () => clearTimeout(id)
      }
      const id = setTimeout(() => setPhase('holding'), 1000)
      return () => clearTimeout(id)
    }
    if (phase === 'holding') {
      const id = setTimeout(() => setPhase('erasing'), 1000)
      return () => clearTimeout(id)
    }
    if (phase === 'erasing') {
      if (displayed.length > 0) {
        const id = setTimeout(() => setDisplayed(d => d.slice(0, -1)), 22)
        return () => clearTimeout(id)
      }
      setDestIdx(i => (i + 1) % DESTINATIONS.length)
      setPhase('typing')
    }
  }, [phase, displayed, destIdx])

  return (
    <span style={{ fontFamily: 'var(--font-sora)', color: 'rgba(255,255,255,0.65)', fontSize: '20px', fontWeight: 300 }}>
      {displayed}
      {phase !== 'idle' && (
        <motion.span
          className="ml-[3px] inline-block h-[17px] w-[2px] align-middle"
          style={{ backgroundColor: '#f59e0b' }}
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        />
      )}
    </span>
  )
}

// ── Globe + HTML overlay (merged for direct DOM access) ──────────────────────
function GlobeSection({ onReady }: { onReady?: () => void }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fromLabelRef = useRef<HTMLDivElement>(null)
  const toLabelRef   = useRef<HTMLDivElement>(null)
  const card0Ref     = useRef<HTMLDivElement>(null)
  const card1Ref     = useRef<HTMLDivElement>(null)
  const card2Ref     = useRef<HTMLDivElement>(null)
  const card3Ref     = useRef<HTMLDivElement>(null)
  // Photo circle refs — outer (positioning) and inner (sizing) per city
  const photoOuterRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const photoInnerRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [arcIdx, setArcIdx] = useState(0)

  // Preload all city photos so they're cached before arcs start
  useEffect(() => {
    for (const { src } of PHOTO_CITY_DATA) {
      const img = new window.Image()
      img.src = src
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W    = window.innerWidth
    const H    = window.innerHeight
    const SEGS = 80
    // Arc t-values for the 4 info cards: 20%, 40%, 60%, 75%
    const CARD_OFFS = [0.20, 0.40, 0.60, 0.75].map(t => Math.floor(t * SEGS) * 3)

    // DOM element handles (stable after first render)
    const fromEl     = fromLabelRef.current
    const toEl       = toLabelRef.current
    const cardEls    = [card0Ref.current, card1Ref.current, card2Ref.current, card3Ref.current]
    const photoOuters = photoOuterRefs.current
    const photoInners = photoInnerRefs.current

    const isMobile    = W < 768
    const SZ_INACTIVE = isMobile ? '40px' : '52px'
    const SZ_ACTIVE   = isMobile ? '52px' : '68px'

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
    globe.position.set(0.55, 0, 0)
    globe.scale.setScalar(0.87)   // ~13% smaller
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

    // ── City positions & dots ──────────────────────────────────────────────
    const cityVec: Record<string, THREE.Vector3> = {}
    for (const [name, [lat, lng]] of Object.entries(CITY_COORDS)) {
      cityVec[name] = latLngToVec3(lat, lng, 1.012)
    }
    const photoCityKeys = new Set<string>(PHOTO_CITY_DATA.map(d => d.key))
    for (const city of new Set(ARC_PAIRS.flat())) {
      const p = cityVec[city]; if (!p) continue
      // Photo cities get an HTML circle overlay instead of a 3D dot
      if (photoCityKeys.has(city)) continue
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }))
      core.position.copy(p); globe.add(core)
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.18 }))
      halo.position.copy(p); globe.add(halo)
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

    const leadArr  = new Float32Array(3)
    const leadAttr = new THREE.BufferAttribute(leadArr, 3)
    const leadGeom = new THREE.BufferGeometry()
    leadGeom.setAttribute('position', leadAttr)
    const matLead = new THREE.PointsMaterial({ color: 0xffffff, size: 0.038, transparent: true, opacity: 0, sizeAttenuation: true })
    globe.add(new THREE.Points(leadGeom, matLead))

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
    // Apply position + opacity + scale + float offset to a card element
    function setCardTransform(el: HTMLDivElement | null, x: number, y: number, op: number, scale: number, dy: number) {
      if (!el) return
      el.style.opacity = op.toFixed(3)
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px) translate(-50%, calc(-100% - 8px)) scale(${scale.toFixed(3)})`
    }

    function hideAll() {
      setOp(fromEl, 0); setOp(toEl, 0)
      cardEls.forEach(el => setOp(el, 0))
    }

    // ── Arc state machine ──────────────────────────────────────────────────
    let curArcIdx = 0
    let phase: 'idle' | 'drawing' | 'holding' | 'fading' | 'pause' = 'idle'
    let tPhase = 0

    const INIT_DELAY = 0.5
    const DRAW_DUR   = 4.0
    const HOLD_DUR   = 2.5
    const FADE_DUR   = 1.0
    const PAUSE_DUR  = 0.8

    // Track when each card became visible (absolute elapsed time), null = not yet shown
    let cardAppearTimes: (number | null)[] = [null, null, null, null]

    function loadArc(idx: number) {
      arcGeom.setDrawRange(0, 0)
      arcPosArr.set(arcBufs[idx])
      arcAttr.needsUpdate = true
      arcGeom.computeBoundingSphere()
      cardAppearTimes = [null, null, null, null]
      hideAll()
    }

    // ── Render loop ────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let raf: number

    function tick() {
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()

      globe.rotation.y = t * (Math.PI * 2 / 60)
      // Clouds rotate ~25% faster than the earth (differential on top of globe rotation)
      cloudMesh.rotation.y = t * (Math.PI * 2 / 60) * 0.25

      // ── Phase state machine ────────────────────────────────────────────
      if (phase === 'idle') {
        if (t >= INIT_DELAY) {
          phase = 'drawing'; tPhase = t
          loadArc(0); setArcIdx(0)
        }
      } else {
        const dt = t - tPhase

        if (phase === 'drawing') {
          const p   = Math.min(dt / DRAW_DUR, 1)
          const cnt = Math.floor(p * (SEGS + 1))
          arcGeom.setDrawRange(0, cnt)
          const op = Math.min(p * 4, 1)
          matLine.opacity = op; matGlow.opacity = op * 0.22; matLead.opacity = op * 0.95
          if (cnt > 0) {
            const off = (cnt - 1) * 3
            leadArr[0] = arcPosArr[off]; leadArr[1] = arcPosArr[off + 1]; leadArr[2] = arcPosArr[off + 2]
            leadAttr.needsUpdate = true
          }
          // Record the first time each card's threshold vertex is passed
          for (let ci = 0; ci < 4; ci++) {
            if (cardAppearTimes[ci] === null && cnt * 3 > CARD_OFFS[ci]) {
              cardAppearTimes[ci] = t
            }
          }
          if (p >= 1) { matLead.opacity = 0; phase = 'holding'; tPhase = t }

        } else if (phase === 'holding') {
          if (dt >= HOLD_DUR) { phase = 'fading'; tPhase = t }

        } else if (phase === 'fading') {
          const p = Math.min(dt / FADE_DUR, 1)
          matLine.opacity = 1 - p; matGlow.opacity = (1 - p) * 0.22
          if (p >= 1) { phase = 'pause'; tPhase = t; hideAll() }

        } else if (phase === 'pause') {
          if (dt >= PAUSE_DUR) {
            curArcIdx = (curArcIdx + 1) % ARC_PAIRS.length
            loadArc(curArcIdx)
            setArcIdx(curArcIdx)
            phase = 'drawing'; tPhase = t
          }
        }
      }

      // ── Overlay DOM updates (per-frame, zero allocations) ──────────────
      // updateCamLocal needed every frame — photo circles are always visible
      updateCamLocal()
      const arcPhase = phase === 'drawing' || phase === 'holding' || phase === 'fading'
      const [arcFrom, arcTo] = ARC_PAIRS[curArcIdx]

      // ── Photo circles — position + active state every frame ────────────
      for (const { key } of PHOTO_CITY_DATA) {
        const outerEl = photoOuters[key]; if (!outerEl) continue
        const pos = cityVec[key];         if (!pos)    continue
        const sp  = project(pos.x, pos.y, pos.z)
        outerEl.style.transform = `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px) translate(-50%, -50%)`
        if (!sp.vis) { outerEl.style.opacity = '0'; continue }
        const active = arcPhase && (key === arcFrom || key === arcTo)
        outerEl.style.opacity = active ? '1' : '0.5'
        const innerEl = photoInners[key]
        if (innerEl) {
          innerEl.style.width     = active ? SZ_ACTIVE   : SZ_INACTIVE
          innerEl.style.height    = active ? SZ_ACTIVE   : SZ_INACTIVE
          innerEl.style.border    = active
            ? '2.5px solid rgba(245,158,11,0.9)'
            : '2px solid rgba(245,158,11,0.3)'
          innerEl.style.boxShadow = active
            ? '0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(245,158,11,0.1), 0 2px 8px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.5)'
        }
      }

      if (arcPhase) {
        const dt = t - tPhase
        const [fromKey, toKey] = [arcFrom, arcTo]

        // Label opacity follows arc line opacity
        const labelOp = phase === 'fading'
          ? Math.max(1 - Math.min(dt / FADE_DUR, 1), 0)
          : matLine.opacity

        // City labels — position + opacity
        const fv = cityVec[fromKey]
        if (fv) {
          const sp = project(fv.x, fv.y, fv.z)
          setPos(fromEl, sp.x, sp.y, 'calc(-100% - 10px)')
          setOp(fromEl, sp.vis ? labelOp : 0)
        }
        const tv = cityVec[toKey]
        if (tv) {
          const sp = project(tv.x, tv.y, tv.z)
          setPos(toEl, sp.x, sp.y, 'calc(-100% - 10px)')
          setOp(toEl, sp.vis ? labelOp : 0)
        }

        // Info cards — progressive appearance during draw, float + fade
        const ENTRY_DUR = 0.35
        const fadeFp = phase === 'fading' ? Math.min(dt / FADE_DUR, 1) : 0
        CARD_OFFS.forEach((off, ci) => {
          const el = cardEls[ci]; if (!el) return
          const sp = project(arcPosArr[off], arcPosArr[off + 1], arcPosArr[off + 2])
          const appearT = cardAppearTimes[ci]
          if (!sp.vis || appearT === null) { setOp(el, 0); return }
          const sinceAppear = t - appearT
          const entryP = Math.min(sinceAppear / ENTRY_DUR, 1)
          const op = entryP * (1 - fadeFp)
          const scale = 0.85 + 0.15 * entryP
          const dy = entryP >= 1 ? Math.sin(t * 2) * 3 * (1 - fadeFp) : 0
          setCardTransform(el, sp.x, sp.y, op, scale, dy)
        })
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

  const ri = ROUTE_INFO[arcIdx]

  // Shared overlay base styles
  const labelBase: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0,
    opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    backgroundColor: 'rgba(8,8,8,0.82)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(245,158,11,0.4)',
    borderRadius: '9999px',
    padding: '4px 10px 4px 7px',
    fontSize: '12px', fontWeight: 600,
    color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sora)',
    whiteSpace: 'nowrap',
  }
  const cardBase: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0,
    opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
    width: '170px',
    backgroundColor: 'rgba(8,8,8,0.88)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    borderLeft: '2px solid rgba(245,158,11,0.85)',
    borderRight: '1px solid rgba(245,158,11,0.12)',
    borderTop: '1px solid rgba(245,158,11,0.12)',
    borderBottom: '1px solid rgba(245,158,11,0.12)',
    borderRadius: '4px 8px 8px 4px',
    padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: '3px',
    fontFamily: 'var(--font-sora)',
  }

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} />

      {/* ── City photo circles ── */}
      {PHOTO_CITY_DATA.map(({ key, label, src }) => (
        <div
          key={key}
          ref={el => { photoOuterRefs.current[key] = el }}
          style={{
            position: 'absolute', left: 0, top: 0,
            opacity: 0, pointerEvents: 'none',
            willChange: 'transform, opacity',
            transition: 'opacity 0.2s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          }}
        >
          {/* Photo circle */}
          <div
            ref={el => { photoInnerRefs.current[key] = el }}
            style={{
              width: '52px', height: '52px', flexShrink: 0,
              borderRadius: '50%', overflow: 'hidden', position: 'relative',
              border: '2px solid rgba(245,158,11,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              backgroundColor: 'rgba(30,30,30,0.9)',
              transition: 'width 0.4s ease, height 0.4s ease, border 0.4s ease, box-shadow 0.4s ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              style={{
                display: 'block',
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
              }}
            />
            {/* Depth vignette */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1, borderRadius: '50%',
              background: 'radial-gradient(circle, transparent 38%, rgba(0,0,0,0.22) 100%)',
              pointerEvents: 'none',
            }} />
          </div>
        </div>
      ))}

      {/* City labels */}
      <div ref={fromLabelRef} style={labelBase}>
        <span>{ri.fromEmoji}</span><span>{ri.fromLabel}</span>
      </div>
      <div ref={toLabelRef} style={labelBase}>
        <span>{ri.toEmoji}</span><span>{ri.toLabel}</span>
      </div>

      {/* Info cards — revealed progressively as arc draws */}
      {([card0Ref, card1Ref, card2Ref, card3Ref] as React.RefObject<HTMLDivElement>[]).map((ref, ci) => (
        <div key={ci} ref={ref} style={cardBase}>
          <span style={{ fontSize: '10px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {ri.cards[ci].category}
          </span>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ri.cards[ci].icon} {ri.cards[ci].text}
          </span>
        </div>
      ))}
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
  const [typingActive, setTypingActive] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setTypingActive(true), 1800)
    return () => clearTimeout(id)
  }, [])

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
        <GlobeSection />
      </motion.div>

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
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3"
            style={{ fontFamily: 'var(--font-sora)', fontSize: '20px', color: '#5c5c5c', letterSpacing: '0.005em' }}
          >
            Where should you go next?
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="mb-12 h-[32px]"
          >
            <TypewriterText active={typingActive} />
          </motion.div>

          {/* Label above buttons */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.9, duration: 0.6 }}
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
                transition={{ delay: 2.0 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <AuthButton onClick={() => signIn(provider)} icon={icon} label={label} />
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <EmailSection />
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 1 }}
            className="mt-10"
            style={{ fontFamily: 'var(--font-sora)', fontSize: '11px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.03em' }}
          >
            AI-powered travel planning. Personalized to you.
          </motion.p>
        </div>
      </div>
    </main>
  )
}
