import './style.css'
import { App } from './app/App'
import { decodeSnapshot } from './utils/UrlPreset'

const canvas  = document.getElementById('canvas')  as HTMLCanvasElement
const panelEl = document.getElementById('panel')   as HTMLElement

const app = new App(canvas, panelEl)

// Restore from URL hash if present
const hash = location.hash.slice(1)
if (hash) {
  const snap = decodeSnapshot(hash)
  if (snap) {
    // Dispatch events the panel normally would, but directly on the panel element
    const dispatch = (type: string, detail: unknown) =>
      panelEl.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
    dispatch('sm:layout-change',   { layout: snap.layout })
    dispatch('sm:material-change', { materialId: snap.materialId, color: snap.color })
    dispatch('sm:params-change', {
      gravity: snap.gravity, windX: snap.windX, windZ: snap.windZ,
      turbulence: snap.turbulence, damping: snap.damping, mass: snap.mass,
      iterations: snap.iterations, bendStiffness: snap.bendStiffness,
      stretchLimit: snap.stretchLimit, tearThreshold: snap.tearThreshold,
    })
    dispatch('sm:lighting-change', { ambient: snap.ambientInt, key: snap.keyInt })
  }
}

app.start()
