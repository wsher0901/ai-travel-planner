'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Plane } from 'lucide-react'

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
  ['nyc',          'lisbon'      ],
  ['tokyo',        'sydney'      ],
  ['london',       'capeTown'    ],
  ['nyc',          'hawaii'      ],
  ['dubai',        'reykjavik'   ],
  ['nyc',          'tokyo'       ],
  ['chicago',      'miami'       ],
  ['sanFrancisco', 'buenosAires' ],
  ['nyc',          'paris'       ],
  ['denver',       'seattle'     ],
]

export type ArcPhase = 'idle' | 'chatting' | 'drawing' | 'holding' | 'fading' | 'pause'

// City label data for globe overlay
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

function chatDur(idx: number): number {
  return CHAT_PROMPTS[idx].length * 0.035 + 3.4
}

export default function GlobeSection({ onReady, onArcChange, onPhaseChange, onCardVisible }: {
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
  useEffect(() => {
    onArcChangeRef.current    = onArcChange
    onPhaseChangeRef2.current = onPhaseChange
    onCardVisibleRef.current  = onCardVisible
  })
  const [arcIdx, setArcIdx] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W    = window.innerWidth
    const H    = window.innerHeight
    const SEGS = 80

    const fromEl     = fromLabelRef.current
    const toEl       = toLabelRef.current
    const airplaneEl = airplaneRef.current

    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    camera.position.z = 2.8

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    const globe = new THREE.Group()
    globe.position.set(0.05, 0, 0)
    globe.scale.setScalar(0.82)
    scene.add(globe)

    const loader = new THREE.TextureLoader()

    const earthTex = loader.load(
      '/textures/earth-blue-marble.jpg',
      () => { onReady?.() },
    )
    earthTex.colorSpace = THREE.SRGBColorSpace

    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ map: earthTex, shininess: 18, specular: new THREE.Color(0x0a1520) }),
    ))

    const cloudTex = loader.load('/textures/earth-clouds.png')
    cloudTex.colorSpace = THREE.SRGBColorSpace
    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 64),
      new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.38, depthWrite: false }),
    )
    globe.add(cloudMesh)

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

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const sun = new THREE.DirectionalLight(0xfffae0, 2.4)
    sun.position.set(3, 1.5, 2.5)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x4488cc, 0.45)
    fill.position.set(-3, -1, -2)
    scene.add(fill)

    const cityVec: Record<string, THREE.Vector3> = {}
    for (const [name, [lat, lng]] of Object.entries(CITY_COORDS)) {
      cityVec[name] = latLngToVec3(lat, lng, 1.012)
    }

    const cityLights: Record<string, THREE.PointLight> = {}

    for (const city of new Set<string>(ARC_PAIRS.flat())) {
      const p = cityVec[city]; if (!p) continue
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
      )
      dot.position.copy(p); globe.add(dot)
      const light = new THREE.PointLight(0xf59e0b, 0.3, 0.15)
      light.position.copy(p); globe.add(light)
      cityLights[city] = light
    }

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

    let curArcIdx = 0
    let phase: ArcPhase = 'idle'
    let lastPhase: ArcPhase = 'idle'
    let tPhase = 0

    const INIT_DELAY = 0.5
    const DRAW_DUR   = 4.0
    const HOLD_DUR   = 6.0
    const FADE_DUR   = 1.0
    const PAUSE_DUR  = 0.8

    const ROT_NORMAL  = Math.PI * 2 / 75
    const ROT_SLOW    = Math.PI * 2 / 180
    const EASING_DUR  = 1.5
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
      const norm = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      let   diff = (target - norm) % (Math.PI * 2)
      if (diff >  Math.PI) diff -= Math.PI * 2
      if (diff < -Math.PI) diff += Math.PI * 2
      easingStartY  = rotY
      easingTargetY = rotY + diff
      easingStartT  = t
      rotMode = 'easing'
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

    const clock = new THREE.Clock()
    let raf: number

    function tick() {
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      const delta = Math.min(t - prevT, 0.05)
      prevT = t

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

          if (p >= 0.3 && !cardTriggered) {
            cardTriggered = true
            onCardVisibleRef.current?.()
          }

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

      if (phase !== lastPhase) {
        lastPhase = phase
        onPhaseChangeRef2.current?.(phase)
      }

      if (rotMode === 'easing') {
        const ep   = Math.min((t - easingStartT) / EASING_DUR, 1)
        const ease = ep < 0.5 ? 2 * ep * ep : 1 - Math.pow(-2 * ep + 2, 2) / 2
        rotY = easingStartY + (easingTargetY - easingStartY) * ease
        if (ep >= 1) { rotY = easingTargetY; rotMode = 'slow' }
      } else {
        rotY += delta * (rotMode === 'slow' ? ROT_SLOW : ROT_NORMAL)
      }
      globe.rotation.y = rotY
      cloudMesh.rotation.y = t * ROT_NORMAL * 0.25

      updateCamLocal()
      const labelsActive = phase === 'drawing' || phase === 'holding' || phase === 'fading'
      const [arcFrom, arcTo] = ARC_PAIRS[curArcIdx]

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

  const labelBase: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0,
    opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
    display: 'inline-flex', alignItems: 'stretch', gap: '8px',
    whiteSpace: 'nowrap',
  }
  const cityLabelContent = (info: { name: string; region: string } | undefined) => !info ? null : (
    <>
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
        aria-label="Animated globe background"
        role="img"
      />
      <div ref={fromLabelRef} style={labelBase}>{cityLabelContent(fromInfo)}</div>
      <div ref={toLabelRef}   style={labelBase}>{cityLabelContent(toInfo)}</div>
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
