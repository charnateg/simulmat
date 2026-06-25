import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CpuSolver } from '../physics/Solver'
import { DEFAULT_PARAMS } from '../physics/types'
import type { SolverParams } from '../physics/types'
import { ClothMesh, CLOTH_N, COLS, ROWS, REST, idx } from '../cloth/ClothMesh'
import type { LayoutName } from '../cloth/ClothMesh'
import { ClothGeometry } from '../cloth/ClothGeometry'
import { ToolHandler } from '../cloth/Tools'
import type { ToolName } from '../cloth/Tools'
import type { ColliderDesc, SphereCollider } from '../colliders/ColliderTypes'
import { MATERIAL_PRESETS } from '../materials/presets'
import { MaterialBuilder } from '../materials/ThreeMaterials'
import { ControlPanel, buildToolbar } from '../ui/ControlPanel'
import { copyShareUrl } from '../utils/UrlPreset'
import type { SimSnapshot } from '../utils/UrlPreset'

export class App {
  // Three
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls

  // Lights
  private ambLight!: THREE.AmbientLight
  private keyLight!: THREE.DirectionalLight
  private rimLight!: THREE.DirectionalLight

  // Simulation
  private solver = new CpuSolver()
  private cloth: ClothMesh
  private clothGeo: ClothGeometry
  private clothMesh: THREE.Mesh
  private pickMesh: THREE.Mesh
  private matBuilder: MaterialBuilder

  // Instanced overlay (chainmail / scales)
  private overlay: THREE.InstancedMesh | null = null
  private overlayDummy = new THREE.Object3D()
  private overlayNormal = new THREE.Vector3()

  // Colliders
  private staticColliders: ColliderDesc[] = []   // floor + rod, always present
  private userColliders:   ColliderDesc[] = []   // panel-added
  private colliderViz = new Map<string, THREE.Mesh>()
  private rodMesh: THREE.Mesh | null = null

  // Tools + UI
  private tools: ToolHandler
  private panel: ControlPanel
  private setActiveTool!: (t: ToolName) => void

  // State
  private params: SolverParams = { ...DEFAULT_PARAMS }
  private currentLayout: LayoutName = 'curtain'
  private currentMaterialId = 'fabric'
  private currentColor = '#00e5ff'
  private wireframe = false

  // Loop
  private lastT = 0
  private accumTime = 0
  private readonly FIXED_DT = 1 / 60
  private fpsAcc = 0
  private fpsT = 0

  constructor(canvas: HTMLCanvasElement, panelEl: HTMLElement) {
    // ---- Renderer ----
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    // ---- Scene ----
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x05070d)
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.028)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    // ---- Camera ----
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200)
    this.camera.position.set(0, 4, 14)

    // ---- Controls ----
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.target.set(0, 2, 0)
    // Left button used by tools; right for orbit
    this.controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }

    // ---- Lights ----
    this._setupLights()

    // ---- Grid ----
    const grid = new THREE.GridHelper(40, 40, 0x00e5ff, 0x1c2740)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.18
    grid.position.y = -3
    this.scene.add(grid)

    // ---- Static colliders ----
    this.staticColliders.push({
      type: 'plane', id: 'floor',
      normal: new THREE.Vector3(0, 1, 0), offset: -3,
    })

    // ---- Cloth ----
    this.cloth = new ClothMesh()
    this.cloth.build(this.currentLayout)
    this.clothGeo = new ClothGeometry(this.cloth)

    this.matBuilder = new MaterialBuilder(this.renderer)
    const mat = this.matBuilder.build(MATERIAL_PRESETS[this.currentMaterialId], this.currentColor)
    this.clothMesh = new THREE.Mesh(this.clothGeo.geo, mat)
    this.clothMesh.castShadow = true
    this.clothMesh.receiveShadow = true
    this.scene.add(this.clothMesh)

    // Invisible pick mesh (same geo positions, no material)
    const pickGeo = new THREE.BufferGeometry()
    pickGeo.setIndex(this.cloth.indices)
    pickGeo.setAttribute('position', new THREE.BufferAttribute(this.cloth.buf.pos, 3))
    this.pickMesh = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }))
    this.scene.add(this.pickMesh)

    // ---- Tools ----
    this.tools = new ToolHandler(this.cloth, this.camera, canvas)

    // ---- Rod for curtain ----
    this._setRod(this.currentLayout)

    // ---- UI ----
    this.panel = new ControlPanel(panelEl)

    const toolbar = document.getElementById('toolbar')!
    this.setActiveTool = buildToolbar(toolbar, t => {
      this.tools.currentTool = t
      const hudTool = document.getElementById('hud-tool')
      if (hudTool) hudTool.textContent = `Tool: ${t.toUpperCase()}`
    })

    this._connectPanel(panelEl)
    this._connectPointer(canvas)

    // ---- Resize ----
    const stage = canvas.parentElement!
    const ro = new ResizeObserver(() => this._resize(stage))
    ro.observe(stage)
    this._resize(stage)
  }

  start(): void {
    const loop = (now: number) => {
      requestAnimationFrame(loop)
      this._animate(now)
    }
    requestAnimationFrame(t => { this.lastT = t; loop(t) })
  }

  // ---------------------------------------------------------------- loop

  private _animate(now: number): void {
    const dt = Math.min(0.05, (now - this.lastT) / 1000)
    this.lastT = now

    this.accumTime += dt
    while (this.accumTime >= this.FIXED_DT) {
      this.cloth.spreadFire(this.FIXED_DT, this.params.burnRate)
      this.solver.step(
        this.cloth.buf, this.cloth.constraints,
        [...this.staticColliders, ...this.userColliders],
        this.params, this.FIXED_DT,
      )
      this.accumTime -= this.FIXED_DT
    }

    this.clothGeo.update(this.cloth.buf)
    ;(this.pickMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true

    this._updateOverlay()
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    this.fpsAcc++
    this.fpsT += dt
    if (this.fpsT >= 0.5) {
      const fps = Math.round(this.fpsAcc / this.fpsT)
      this.fpsAcc = 0; this.fpsT = 0
      this.panel.setStats(fps, this.cloth.buf.n)
      const fpsEl  = document.getElementById('hud-fps')
      const partEl = document.getElementById('hud-particles')
      if (fpsEl)  fpsEl.textContent  = `FPS · ${fps}`
      if (partEl) partEl.textContent = `Particles · ${this.cloth.buf.n}`
    }
  }

  // ---------------------------------------------------------------- instanced overlay

  private _updateOverlay(): void {
    if (!this.overlay) return
    const { pos } = this.cloth.buf
    const norms = this.clothGeo.geo.attributes.normal as THREE.BufferAttribute
    const UP = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i < CLOTH_N; i++) {
      if (!this.cloth.buf.alive[i]) {
        this.overlayDummy.scale.set(0, 0, 0)
        this.overlayDummy.updateMatrix()
        this.overlay.setMatrixAt(i, this.overlayDummy.matrix)
        continue
      }
      this.overlayDummy.scale.set(1, 1, 1)
      this.overlayDummy.position.set(pos[i*3], pos[i*3+1], pos[i*3+2])
      this.overlayNormal.set(norms.getX(i), norms.getY(i), norms.getZ(i)).normalize()
      this.overlayDummy.quaternion.setFromUnitVectors(UP, this.overlayNormal)
      this.overlayDummy.updateMatrix()
      this.overlay.setMatrixAt(i, this.overlayDummy.matrix)
    }
    this.overlay.instanceMatrix.needsUpdate = true
  }

  private _buildOverlay(type: 'chainmail' | 'scales'): void {
    if (this.overlay) { this.scene.remove(this.overlay); this.overlay.dispose(); this.overlay = null }
    if (!type) return

    let geo: THREE.BufferGeometry
    let mat: THREE.MeshPhysicalMaterial

    if (type === 'chainmail') {
      geo = new THREE.TorusGeometry(REST * 0.44, REST * 0.13, 6, 8)
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xaaaaaa, metalness: 0.97, roughness: 0.22,
        side: THREE.DoubleSide,
      })
    } else {
      geo = new THREE.SphereGeometry(REST * 0.52, 5, 4)
      geo.scale(1, 0.22, 0.62)
      mat = new THREE.MeshPhysicalMaterial({
        color: 0xaaaaaa, metalness: 0.9, roughness: 0.28,
        iridescence: 0.35, iridescenceIOR: 1.6,
        side: THREE.DoubleSide,
      })
    }

    this.overlay = new THREE.InstancedMesh(geo, mat, CLOTH_N)
    this.overlay.castShadow = true
    this.scene.add(this.overlay)
  }

  // ---------------------------------------------------------------- scene setup

  private _setupLights(): void {
    this.ambLight = new THREE.AmbientLight(0x4455aa, 0.6)
    this.scene.add(this.ambLight)

    this.keyLight = new THREE.DirectionalLight(0x00e5ff, 1.2)
    this.keyLight.position.set(5, 10, 6)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.setScalar(1024)
    this.keyLight.shadow.camera.near = 0.5
    this.keyLight.shadow.camera.far  = 40
    this.keyLight.shadow.camera.left = this.keyLight.shadow.camera.bottom = -8
    this.keyLight.shadow.camera.right = this.keyLight.shadow.camera.top   =  8
    this.scene.add(this.keyLight)

    this.rimLight = new THREE.DirectionalLight(0x7c5cff, 0.5)
    this.rimLight.position.set(-6, 4, -8)
    this.scene.add(this.rimLight)

    const fill = new THREE.PointLight(0xff3ec8, 0.35, 20)
    fill.position.set(3, -1, 5)
    this.scene.add(fill)
  }

  private _setRod(layout: LayoutName): void {
    // Remove previous rod
    if (this.rodMesh) { this.scene.remove(this.rodMesh); this.rodMesh = null }
    this.staticColliders = this.staticColliders.filter(c => c.id !== 'rod')

    if (['curtain', 'cape', 'flag', 'banner'].includes(layout)) {
      const W = (COLS - 1) * REST
      const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, W + 0.6, 12)
      const rodMat = new THREE.MeshPhysicalMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 })
      this.rodMesh = new THREE.Mesh(rodGeo, rodMat)
      this.rodMesh.rotation.z = Math.PI / 2
      this.rodMesh.position.set(0, 4.05, 0)
      this.rodMesh.castShadow = true
      this.scene.add(this.rodMesh)

      this.staticColliders.push({
        type: 'capsule', id: 'rod',
        a: new THREE.Vector3(-W/2, 4, 0),
        b: new THREE.Vector3( W/2, 4, 0),
        radius: 0.06,
      })
    }
  }

  // ---------------------------------------------------------------- material

  private _setMaterial(id: string, color: string): void {
    const preset = MATERIAL_PRESETS[id]
    if (!preset) return
    this.currentMaterialId = id
    this.currentColor = color

    const old = this.clothMesh.material as THREE.Material
    old.dispose()

    const mat = this.matBuilder.build(preset, color)
    if (this.wireframe) mat.wireframe = true
    this.clothMesh.material = mat

    // Overlay
    if (preset.overlay) this._buildOverlay(preset.overlay)
    else { if (this.overlay) { this.scene.remove(this.overlay); this.overlay.dispose(); this.overlay = null } }

    // Apply physics params from preset
    const p = this.params
    p.mass          = preset.mass
    p.damping       = preset.damping
    p.iterations    = preset.iterations
    p.stretchLimit  = preset.stretchLimit
    p.bendStiffness = preset.bendStiffness
    p.tearThreshold = preset.tearThreshold
    p.plasticThreshold = preset.plasticThreshold
  }

  // ---------------------------------------------------------------- colliders

  private _addUserSphere(radius: number, x: number, y: number, z: number): void {
    const id = `sphere-${Date.now()}`
    const center = new THREE.Vector3(x, y, z)
    const col: SphereCollider = { type: 'sphere', id, center, radius }
    this.userColliders.push(col)

    // Visualization
    const geo = new THREE.SphereGeometry(radius, 20, 14)
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff, metalness: 0.6, roughness: 0.3,
      wireframe: true, transparent: true, opacity: 0.35,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    this.scene.add(mesh)
    this.colliderViz.set(id, mesh)

    this._refreshColliderList()
  }

  private _clearUserColliders(): void {
    for (const [, mesh] of this.colliderViz) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
    }
    this.colliderViz.clear()
    this.userColliders = []
    this._refreshColliderList()
  }

  private _removeUserCollider(id: string): void {
    this.userColliders = this.userColliders.filter(c => c.id !== id)
    const mesh = this.colliderViz.get(id)
    if (mesh) { this.scene.remove(mesh); mesh.geometry.dispose(); this.colliderViz.delete(id) }
    this._refreshColliderList()
  }

  private _refreshColliderList(): void {
    this.panel.updateColliderList(
      this.userColliders.map(c => ({
        id: c.id,
        label: c.type === 'sphere'
          ? `Sphere r=${(c as SphereCollider).radius.toFixed(1)} @ (${(c as SphereCollider).center.x.toFixed(1)},${(c as SphereCollider).center.y.toFixed(1)},${(c as SphereCollider).center.z.toFixed(1)})`
          : c.id,
      }))
    )
  }

  // ---------------------------------------------------------------- events

  private _connectPanel(panelEl: HTMLElement): void {
    const on = (type: string, cb: (d: Record<string, unknown>) => void) =>
      panelEl.addEventListener(type, e => cb((e as CustomEvent).detail))

    on('sm:layout-change', d => {
      this.currentLayout = d.layout as LayoutName
      this.cloth.reset(this.currentLayout)
      this._setRod(this.currentLayout)
    })

    on('sm:material-change', d => {
      this._setMaterial(d.materialId as string, d.color as string)
    })

    on('sm:params-change', d => {
      Object.assign(this.params, d)
    })

    on('sm:lighting-change', d => {
      if (d.ambient !== undefined) this.ambLight.intensity = d.ambient as number
      if (d.key    !== undefined) this.keyLight.intensity  = d.key    as number
      if (d.rim    !== undefined) this.rimLight.intensity  = d.rim    as number
    })

    on('sm:tool-change', d => {
      if (d.brushRadius !== undefined) this.tools.brushRadius = d.brushRadius as number
      if (d.pushForce   !== undefined) this.tools.pushForce   = d.pushForce   as number
    })

    on('sm:reset', () => {
      this.cloth.reset(this.currentLayout)
    })

    on('sm:release-pins', () => {
      this.cloth.releasePins()
    })

    on('sm:wind-gust', () => {
      this.tools.windGust()
    })

    on('sm:wireframe', () => {
      this.wireframe = !this.wireframe
      const mat = this.clothMesh.material as THREE.MeshPhysicalMaterial
      mat.wireframe = this.wireframe
    })

    on('sm:collider-add', d => {
      const { radius, x, y, z } = d as { radius: number; x: number; y: number; z: number }
      this._addUserSphere(radius, x, y, z)
    })

    on('sm:collider-clear', () => { this._clearUserColliders() })

    on('sm:collider-remove', d => { this._removeUserCollider(d.id as string) })

    on('sm:share', () => {
      const snap = this._captureSnapshot()
      copyShareUrl(snap)
      // Brief visual feedback
      const btn = panelEl.querySelector('#btn-share') as HTMLButtonElement | null
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share preset URL' }, 1400) }
    })
  }

  private _connectPointer(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      const blocked = this.tools.onPointerDown(e, this.pickMesh)
      if (blocked) this.controls.enabled = false
    })
    canvas.addEventListener('pointermove', e => {
      this.tools.onPointerMove(e, this.pickMesh)
    })
    canvas.addEventListener('pointerup', () => {
      this.tools.onPointerUp(this.currentLayout)
      this.controls.enabled = true
    })
    canvas.addEventListener('pointerleave', () => {
      this.tools.onPointerUp(this.currentLayout)
      this.controls.enabled = true
    })
  }

  private _resize(stage: HTMLElement): void {
    const w = stage.clientWidth, h = stage.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private _captureSnapshot(): SimSnapshot {
    return {
      layout:       this.currentLayout,
      materialId:   this.currentMaterialId,
      color:        this.currentColor,
      gravity:      this.params.gravity,
      windX:        this.params.windX,
      windZ:        this.params.windZ,
      turbulence:   this.params.turbulence,
      damping:      this.params.damping,
      mass:         this.params.mass,
      iterations:   this.params.iterations,
      bendStiffness: this.params.bendStiffness,
      stretchLimit: this.params.stretchLimit,
      tearThreshold: this.params.tearThreshold,
      ambientInt:   this.ambLight.intensity,
      keyInt:       this.keyLight.intensity,
    }
  }
}
