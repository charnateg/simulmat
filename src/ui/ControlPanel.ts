import { MATERIAL_PRESETS, COLORS, PHYSICS_PRESETS } from '../materials/presets'
import type { SolverParams } from '../physics/types'
import type { LayoutName } from '../cloth/ClothMesh'
import type { ToolName } from '../cloth/Tools'

interface ColliderEntry { id: string; label: string }

export class ControlPanel {
  private root: HTMLElement
  private colliderEntries: ColliderEntry[] = []
  private currentColor = '#00e5ff'

  constructor(root: HTMLElement) {
    this.root = root
    this._mount()
    this._wire()
  }

  // ---------------------------------------------------------------- public API

  setStats(fps: number, particles: number): void {
    const f = this.root.querySelector('#st-fps')
    const p = this.root.querySelector('#st-parts')
    if (f) f.textContent = `FPS · ${fps}`
    if (p) p.textContent = `Particles · ${particles}`
  }

  updateColliderList(entries: ColliderEntry[]): void {
    this.colliderEntries = entries
    const list = this.root.querySelector('#collider-list')
    if (!list) return
    list.innerHTML = entries.length === 0
      ? '<div style="font-size:10px;color:var(--muted)">No colliders added yet</div>'
      : entries.map(e => `
          <div class="collider-item">
            <span>${e.label}</span>
            <button data-remove="${e.id}" title="Remove">×</button>
          </div>`).join('')
    list.querySelectorAll('button[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._emit('sm:collider-remove', { id: (btn as HTMLButtonElement).dataset.remove })
      })
    })
  }

  // ---------------------------------------------------------------- rendering

  private _mount(): void { this.root.innerHTML = this._html() }

  private _html(): string {
    const mats = Object.values(MATERIAL_PRESETS)
    const colors = COLORS.map((c, i) => `
      <div class="swatch${i===0?' active':''}" style="background:${c.hex}" title="${c.name}" data-color="${c.hex}"></div>`
    ).join('')

    return `
<div class="panel-head">
  <h1>SimulMat</h1>
  <div class="sub">Material simulator · Real-time</div>
</div>
<div class="panel-stats">
  <span id="st-fps">FPS ·</span>
  <span id="st-parts">Particles ·</span>
</div>

<div class="group">
  <h2>Layout</h2>
  <select id="sel-layout">
    <option value="curtain">Curtain</option>
    <option value="flag">Flag</option>
    <option value="cape">Cape</option>
    <option value="banner">Banner</option>
    <option value="tablecloth">Tablecloth</option>
    <option value="hammock">Hammock</option>
  </select>
</div>

<div class="group">
  <h2>Material</h2>
  <select id="sel-material">
    ${mats.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}
  </select>
  <div class="swatch-row">${colors}</div>
</div>

<div class="group primary">
  <h2>Physics</h2>
  ${this._sl('Gravity', 'gravity', -20, 0, 0.1, -9.8)}
  ${this._sl('Wind X', 'windX', -8, 8, 0.1, 0)}
  ${this._sl('Wind Z', 'windZ', -8, 8, 0.1, 0)}
  ${this._sl('Turbulence', 'turb', 0, 3, 0.05, 0.4)}
  ${this._sl('Damping', 'damp', 0, 0.2, 0.002, 0.02, v => v.toFixed(3))}
  ${this._sl('Iterations', 'iters', 1, 12, 1, 5, v => v.toFixed(0))}
  <div class="row">
    <label>Physics preset</label>
    <select id="sel-phys-preset">
      <option value="">— custom —</option>
      <option value="silk">Silk · ultra light</option>
      <option value="cotton">Cotton · medium</option>
      <option value="rubber">Rubber · elastic</option>
      <option value="chain">Chainmail · heavy</option>
      <option value="zerog">Zero-G · floaty</option>
      <option value="armor">Armor plate · rigid</option>
    </select>
  </div>
</div>

<div class="group primary">
  <h2>Material properties</h2>
  ${this._sl('Mass', 'mass', 0.05, 2, 0.01, 0.2)}
  ${this._sl('Stretch limit', 'stretch', 0.8, 2.0, 0.01, 1.0)}
  ${this._sl('Bend stiffness', 'bends', 0, 1, 0.01, 0.5)}
  ${this._sl('Tear threshold', 'tear', 1.1, 5, 0.05, 99, v => v >= 5 ? '∞' : v.toFixed(2))}
  ${this._sl('Burn rate', 'burn', 0.1, 5, 0.1, 1.0)}
</div>

<div class="group">
  <h2>Lighting</h2>
  ${this._sl('Ambient', 'amb', 0, 2, 0.05, 0.6)}
  ${this._sl('Key light', 'key', 0, 3, 0.05, 1.2)}
  ${this._sl('Rim light', 'rim', 0, 2, 0.05, 0.5)}
</div>

<div class="group">
  <h2>Colliders</h2>
  ${this._sl('Radius', 'col-r', 0.2, 4, 0.1, 1.5)}
  ${this._sl('Pos X', 'col-x', -5, 5, 0.1, 0)}
  ${this._sl('Pos Y', 'col-y', -2, 4, 0.1, 0)}
  ${this._sl('Pos Z', 'col-z', -5, 5, 0.1, 0)}
  <div class="btn-row">
    <button class="act" id="btn-add-sphere">+ Sphere</button>
    <button class="act" id="btn-clear-cols">Clear all</button>
  </div>
  <div class="collider-list" id="collider-list">
    <div style="font-size:10px;color:var(--muted)">No colliders added yet</div>
  </div>
</div>

<div class="group">
  <h2>Tool settings</h2>
  ${this._sl('Brush radius', 'brush-r', 0.1, 2, 0.05, 0.4)}
  ${this._sl('Push force', 'push-f', 0.5, 10, 0.25, 3.0)}
</div>

<div class="group">
  <h2>Actions</h2>
  <div class="btn-row">
    <button class="act" id="btn-reset">Reset</button>
    <button class="act" id="btn-release">Release pins</button>
  </div>
  <div class="btn-row">
    <button class="act" id="btn-gust">Wind gust</button>
    <button class="act" id="btn-wire">Wireframe</button>
  </div>
  <div class="btn-row">
    <button class="act full" id="btn-share">Share preset URL</button>
  </div>
</div>

<div class="footer-note"><span class="pulse"></span>System Online</div>`
  }

  private _sl(
    label: string, id: string,
    min: number, max: number, step: number, val: number,
    fmt: (v: number) => string = v => v.toFixed(2),
  ): string {
    return `
<div class="row">
  <label>${label} <span class="val" id="v-${id}">${fmt(val)}</span></label>
  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" />
</div>`
  }

  // ---------------------------------------------------------------- wiring

  private _wire(): void {
    const q = <T extends Element>(sel: string) => this.root.querySelector<T>(sel)!

    // Layout
    q<HTMLSelectElement>('#sel-layout').addEventListener('change', e => {
      this._emit('sm:layout-change', { layout: (e.target as HTMLSelectElement).value })
    })

    // Material
    q<HTMLSelectElement>('#sel-material').addEventListener('change', e => {
      const id = (e.target as HTMLSelectElement).value
      this._emit('sm:material-change', { materialId: id, color: this.currentColor })
    })

    // Color swatches
    this.root.querySelectorAll('.swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        this.root.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
        sw.classList.add('active')
        this.currentColor = (sw as HTMLElement).dataset.color!
        const id = q<HTMLSelectElement>('#sel-material').value
        this._emit('sm:material-change', { materialId: id, color: this.currentColor })
      })
    })

    // Physics sliders
    this._bind('gravity', v => this._emit('sm:params-change', { gravity: v }))
    this._bind('windX',   v => this._emit('sm:params-change', { windX: v }))
    this._bind('windZ',   v => this._emit('sm:params-change', { windZ: v }))
    this._bind('turb',    v => this._emit('sm:params-change', { turbulence: v }))
    this._bind('damp',    v => this._emit('sm:params-change', { damping: v }), v => v.toFixed(3))
    this._bind('iters',   v => this._emit('sm:params-change', { iterations: Math.round(v) }), v => v.toFixed(0))

    // Physics presets
    q<HTMLSelectElement>('#sel-phys-preset').addEventListener('change', e => {
      const key = (e.target as HTMLSelectElement).value
      if (!key) return
      const preset = PHYSICS_PRESETS[key]
      if (preset) this._emit('sm:params-change', preset)
      ;(e.target as HTMLSelectElement).value = ''
    })

    // Material props sliders
    this._bind('mass',    v => this._emit('sm:params-change', { mass: v }))
    this._bind('stretch', v => this._emit('sm:params-change', { stretchLimit: v }))
    this._bind('bends',   v => this._emit('sm:params-change', { bendStiffness: v }))
    this._bind('tear',    v => {
      const thresh = v >= 5 ? Infinity : v
      this._emit('sm:params-change', { tearThreshold: thresh })
    }, v => v >= 5 ? '∞' : v.toFixed(2))
    this._bind('burn',    v => this._emit('sm:params-change', { burnRate: v }))

    // Lighting
    this._bind('amb', v => this._emit('sm:lighting-change', { ambient: v }))
    this._bind('key', v => this._emit('sm:lighting-change', { key: v }))
    this._bind('rim', v => this._emit('sm:lighting-change', { rim: v }))

    // Collider form
    q<HTMLButtonElement>('#btn-add-sphere').addEventListener('click', () => {
      const r = parseFloat(q<HTMLInputElement>('#col-r').value)
      const x = parseFloat(q<HTMLInputElement>('#col-x').value)
      const y = parseFloat(q<HTMLInputElement>('#col-y').value)
      const z = parseFloat(q<HTMLInputElement>('#col-z').value)
      this._emit('sm:collider-add', { type: 'sphere', radius: r, x, y, z })
    })
    q<HTMLButtonElement>('#btn-clear-cols').addEventListener('click', () => {
      this._emit('sm:collider-clear', {})
    })

    // Tool settings
    this._bind('brush-r', v => this._emit('sm:tool-change', { brushRadius: v }))
    this._bind('push-f',  v => this._emit('sm:tool-change', { pushForce: v }))

    // Actions
    q<HTMLButtonElement>('#btn-reset').addEventListener('click',   () => this._emit('sm:reset', {}))
    q<HTMLButtonElement>('#btn-release').addEventListener('click', () => this._emit('sm:release-pins', {}))
    q<HTMLButtonElement>('#btn-gust').addEventListener('click',    () => this._emit('sm:wind-gust', {}))
    q<HTMLButtonElement>('#btn-wire').addEventListener('click',    () => this._emit('sm:wireframe', {}))
    q<HTMLButtonElement>('#btn-share').addEventListener('click',   () => this._emit('sm:share', {}))
  }

  private _bind(
    id: string,
    cb: (v: number) => void,
    fmt: (v: number) => string = v => v.toFixed(2),
  ): void {
    const el = this.root.querySelector<HTMLInputElement>(`#${id}`)!
    const vel = this.root.querySelector(`#v-${id}`)
    el.addEventListener('input', () => {
      const v = parseFloat(el.value)
      if (vel) vel.textContent = fmt(v)
      cb(v)
    })
  }

  private _emit<T>(type: string, detail: T): void {
    this.root.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
  }
}

// Toolbar builder (separate from panel, lives inside the canvas stage)
export function buildToolbar(
  container: HTMLElement,
  onTool: (t: ToolName) => void,
): (t: ToolName) => void {
  const tools: { name: ToolName; ico: string; label: string; cls?: string }[] = [
    { name: 'hand',   ico: '✋', label: 'HAND' },
    { name: 'knife',  ico: '✂️', label: 'KNIFE', cls: 'danger' },
    { name: 'fire',   ico: '🔥', label: 'FIRE',  cls: 'warn' },
    { name: 'push',   ico: '💨', label: 'PUSH' },
    { name: 'bullet', ico: '💥', label: 'BULLET', cls: 'danger' },
    { name: 'pin',    ico: '📌', label: 'PIN' },
  ]

  container.innerHTML = tools.map(t => `
    <button class="tool-btn${t.cls ? ' '+t.cls : ''}${t.name==='hand'?' active':''}"
            data-tool="${t.name}" title="${t.label}">
      <span class="ico">${t.ico}</span>
      <span class="lbl">${t.label}</span>
    </button>`
  ).join('')

  container.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      onTool(btn.dataset.tool as ToolName)
    })
  })

  return (t: ToolName) => {
    container.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
    const btn = container.querySelector(`[data-tool="${t}"]`)
    btn?.classList.add('active')
  }
}
