import * as THREE from 'three'
import type { ClothMesh } from './ClothMesh'
import { COLS, ROWS, idx } from './ClothMesh'
import type { LayoutName } from './ClothMesh'

export type ToolName = 'hand' | 'knife' | 'fire' | 'push' | 'bullet' | 'pin'

export class ToolHandler {
  currentTool: ToolName = 'hand'
  brushRadius = 0.4
  pushForce = 3.0

  private cloth: ClothMesh
  private camera: THREE.Camera
  private canvas: HTMLElement

  private dragging: number | null = null
  private pointerDown = false
  private dragPlane = new THREE.Plane()
  private dragWorld = new THREE.Vector3()
  private ndc = new THREE.Vector2()
  private rc = new THREE.Raycaster()

  constructor(cloth: ClothMesh, camera: THREE.Camera, canvas: HTMLElement) {
    this.cloth = cloth
    this.camera = camera
    this.canvas = canvas
  }

  private getNdc(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.x = ((e.clientX - r.left) / r.width)  * 2 - 1
    this.ndc.y = -((e.clientY - r.top)  / r.height) * 2 + 1
  }

  private pickPoint(e: PointerEvent, mesh: THREE.Mesh): THREE.Vector3 | null {
    this.getNdc(e)
    this.rc.setFromCamera(this.ndc, this.camera)
    const hits = this.rc.intersectObject(mesh, false)
    return hits.length ? hits[0].point.clone() : null
  }

  private nearest(p: THREE.Vector3): number {
    const { pos, alive } = this.cloth.buf
    let best = -1, bd = Infinity
    for (let i = 0; i < this.cloth.buf.n; i++) {
      if (!alive[i]) continue
      const dx = pos[i*3]-p.x, dy = pos[i*3+1]-p.y, dz = pos[i*3+2]-p.z
      const d = dx*dx + dy*dy + dz*dz
      if (d < bd) { bd = d; best = i }
    }
    return best
  }

  // Returns true if the tool consumed the pointer (disable orbit)
  onPointerDown(e: PointerEvent, pickMesh: THREE.Mesh): boolean {
    if (e.button !== 0) return false
    this.pointerDown = true
    const p = this.pickPoint(e, pickMesh)
    if (!p) return false

    if (this.currentTool === 'hand') {
      const i = this.nearest(p)
      if (i < 0) return false
      this.dragging = i
      this.cloth.buf.pinned[i] = 1
      const dir = new THREE.Vector3()
      this.camera.getWorldDirection(dir)
      this.dragPlane.setFromNormalAndCoplanarPoint(dir, p)
      return true
    }

    this._applyTool(p)
    return true
  }

  onPointerMove(e: PointerEvent, pickMesh: THREE.Mesh): void {
    if (!this.pointerDown) return

    if (this.currentTool === 'hand' && this.dragging !== null) {
      this.getNdc(e)
      this.rc.setFromCamera(this.ndc, this.camera)
      if (this.rc.ray.intersectPlane(this.dragPlane, this.dragWorld)) {
        const i3 = this.dragging * 3
        const { pos, prev } = this.cloth.buf
        pos[i3]   = prev[i3]   = this.dragWorld.x
        pos[i3+1] = prev[i3+1] = this.dragWorld.y
        pos[i3+2] = prev[i3+2] = this.dragWorld.z
      }
      return
    }

    const p = this.pickPoint(e, pickMesh)
    if (p) this._applyTool(p)
  }

  onPointerUp(layout: LayoutName): void {
    this.pointerDown = false
    if (this.dragging !== null) {
      if (!this._isLayoutPin(this.dragging, layout))
        this.cloth.buf.pinned[this.dragging] = 0
      this.dragging = null
    }
  }

  windGust(): void {
    const { prev, pinned, alive } = this.cloth.buf
    const sx = (Math.random() - 0.5) * 8
    const sz = Math.random() * 8 + 2
    for (let i = 0; i < this.cloth.buf.n; i++) {
      if (pinned[i] || !alive[i]) continue
      prev[i*3]   -= sx * 0.05
      prev[i*3+2] -= sz * 0.05
    }
  }

  private _applyTool(p: THREE.Vector3): void {
    switch (this.currentTool) {
      case 'knife':  this.cloth.cutAt(p, this.brushRadius);    break
      case 'fire':   this.cloth.igniteAt(p, this.brushRadius); break
      case 'push':   this._push(p, false);                     break
      case 'bullet': this._push(p, true);                      break
      case 'pin':    this._togglePin(p);                       break
    }
  }

  private _push(p: THREE.Vector3, cut: boolean): void {
    const { pos, prev, pinned, alive } = this.cloth.buf
    const r2 = (this.brushRadius * 2) ** 2
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    const f = this.pushForce * 0.025

    for (let i = 0; i < this.cloth.buf.n; i++) {
      if (pinned[i] || !alive[i]) continue
      const dx = pos[i*3]-p.x, dy = pos[i*3+1]-p.y, dz = pos[i*3+2]-p.z
      const d2 = dx*dx + dy*dy + dz*dz
      if (d2 < r2) {
        const k = (1 - Math.sqrt(d2/r2)) * f
        prev[i*3]   -= dir.x * k
        prev[i*3+1] -= dir.y * k
        prev[i*3+2] -= dir.z * k
      }
    }
    if (cut) this.cloth.cutAt(p, this.brushRadius * 0.45)
  }

  private _togglePin(p: THREE.Vector3): void {
    const i = this.nearest(p)
    if (i >= 0) this.cloth.buf.pinned[i] ^= 1
  }

  private _isLayoutPin(i: number, layout: LayoutName): boolean {
    const c = i % COLS, r = Math.floor(i / COLS)
    switch (layout) {
      case 'curtain': return r === 0
      case 'flag':    return c === 0
      case 'cape':    return r === 0
      case 'banner':  return r === 0 && (c === Math.floor(COLS/2) || c === Math.floor(COLS/4) || c === Math.floor(3*COLS/4))
      case 'tablecloth': return (r===0||r===ROWS-1) && (c===0||c===COLS-1)
      case 'hammock': return c === 0 || c === COLS-1
    }
  }
}
