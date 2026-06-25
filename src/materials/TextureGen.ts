import * as THREE from 'three'
import type { TextureGenId } from './presets'

const SZ = 512

export function generateTextureCanvas(type: TextureGenId, hex: string): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SZ
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = hex
  ctx.fillRect(0, 0, SZ, SZ)

  switch (type) {
    case 'fabric':    _weave(ctx, hex, 4, 'plain');  break
    case 'silk':      _weave(ctx, hex, 3, 'twill');  break
    case 'velvet':    _weave(ctx, hex, 2, 'velvet'); break
    case 'leather':   _leather(ctx, hex);             break
    case 'rubber':    _rubber(ctx, hex);              break
    case 'gel':       _gel(ctx, hex);                 break
    case 'plate':     _metalPlate(ctx, hex);          break
    case 'chainmail': _chainmailPattern(ctx, hex);    break
    case 'scales':    _scalePattern(ctx, hex);        break
  }
  return cv
}

export function canvasToTex(cv: HTMLCanvasElement, repeat: [number, number], maxAniso: number): THREE.Texture {
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = maxAniso
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function normalFromCanvas(cv: HTMLCanvasElement, repeat: [number, number], maxAniso: number): THREE.Texture {
  const src = cv.getContext('2d')!.getImageData(0, 0, SZ, SZ)
  const dst = document.createElement('canvas')
  dst.width = dst.height = SZ
  const dctx = dst.getContext('2d')!
  const out = dctx.createImageData(SZ, SZ)
  const luma = (x: number, y: number) => {
    x = ((x % SZ) + SZ) % SZ; y = ((y % SZ) + SZ) % SZ
    const i = (y * SZ + x) * 4
    return (src.data[i] + src.data[i+1] + src.data[i+2]) / (3 * 255)
  }
  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const nx = -(luma(x+1,y) - luma(x-1,y)) * 6
      const ny = -(luma(x,y+1) - luma(x,y-1)) * 6
      const nz = 1
      const l = Math.sqrt(nx*nx + ny*ny + nz*nz)
      const o = (y * SZ + x) * 4
      out.data[o]   = ((nx/l) * 0.5 + 0.5) * 255
      out.data[o+1] = ((ny/l) * 0.5 + 0.5) * 255
      out.data[o+2] = ((nz/l) * 0.5 + 0.5) * 255
      out.data[o+3] = 255
    }
  }
  dctx.putImageData(out, 0, 0)
  const tex = new THREE.CanvasTexture(dst)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = maxAniso
  return tex
}

// --- Texture draw functions ---

function _weave(ctx: CanvasRenderingContext2D, _hex: string, threadPx: number, mode: 'plain' | 'twill' | 'velvet'): void {
  ctx.globalAlpha = 0.2
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 0.8
  for (let i = 0; i < SZ; i += threadPx) {
    ctx.beginPath()
    if (mode === 'twill') { ctx.moveTo(-SZ, i); ctx.lineTo(SZ, i + SZ) }
    else                  { ctx.moveTo(0, i); ctx.lineTo(SZ, i) }
    ctx.stroke()
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, SZ); ctx.stroke()
  }
  // Highlight warp threads
  ctx.globalAlpha = 0.07; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.4
  for (let i = 0; i < SZ; i += threadPx * 2) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, SZ); ctx.stroke()
  }
  // Fiber noise
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff'
  for (let k = 0; k < 2000; k++) ctx.fillRect(Math.random()*SZ, Math.random()*SZ, 1, 1)
  ctx.globalAlpha = 0.04; ctx.fillStyle = '#000'
  for (let k = 0; k < 1500; k++) ctx.fillRect(Math.random()*SZ, Math.random()*SZ, 1, 1)
  ctx.globalAlpha = 1
}

function _leather(ctx: CanvasRenderingContext2D, _hex: string): void {
  for (let k = 0; k < 7000; k++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.14})`
    ctx.beginPath()
    ctx.arc(Math.random()*SZ, Math.random()*SZ, 0.5 + Math.random()*2, 0, Math.PI*2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff'
  for (let k = 0; k < 2000; k++) ctx.fillRect(Math.random()*SZ, Math.random()*SZ, 2, 2)
  ctx.globalAlpha = 1
}

function _rubber(ctx: CanvasRenderingContext2D, _hex: string): void {
  for (let k = 0; k < 9000; k++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`
    ctx.fillRect(Math.random()*SZ, Math.random()*SZ, 1+Math.random(), 1+Math.random())
  }
  ctx.globalAlpha = 0.07; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.4
  for (let k = 0; k < 40; k++) {
    const x = Math.random()*SZ, y = Math.random()*SZ, a = Math.random()*Math.PI
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+Math.cos(a)*25, y+Math.sin(a)*8); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function _gel(ctx: CanvasRenderingContext2D, _hex: string): void {
  ctx.globalAlpha = 0.12
  for (let k = 0; k < 600; k++) {
    const x = Math.random()*SZ, y = Math.random()*SZ, r = 4 + Math.random()*40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

function _metalPlate(ctx: CanvasRenderingContext2D, _hex: string): void {
  ctx.globalAlpha = 0.07; ctx.lineWidth = 0.6
  for (let k = 0; k < 220; k++) {
    const y = Math.random()*SZ
    ctx.strokeStyle = Math.random() > 0.5 ? '#fff' : '#000'
    ctx.lineWidth = 0.4 + Math.random() * 1.6
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SZ, y + (Math.random()-0.5)*5); ctx.stroke()
  }
  ctx.globalAlpha = 0.03; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.3
  for (let k = 0; k < 35; k++) {
    const x1 = Math.random()*SZ, y1 = Math.random()*SZ
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1+(Math.random()-0.5)*100, y1+(Math.random()-0.5)*20); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function _chainmailPattern(ctx: CanvasRenderingContext2D, _hex: string): void {
  ctx.globalAlpha = 0.9
  const R = 10, rx = R * 0.55, ry = R * 0.85
  for (let r = -1; r < SZ / (ry*1.8)+1; r++) {
    for (let c = -1; c < SZ / (rx*1.8)+1; c++) {
      const xOff = (r % 2) * rx * 0.9
      const x = c * rx * 1.8 + xOff + R
      const y = r * ry * 1.8 + R
      ctx.strokeStyle = '#888'; ctx.lineWidth = 3.5
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); ctx.stroke()
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(x, y, rx*0.65, ry*0.65, 0, 0, Math.PI*2); ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function _scalePattern(ctx: CanvasRenderingContext2D, _hex: string): void {
  const SW = 22, SH = 18
  for (let r = -1; r < SZ / (SH*0.7)+2; r++) {
    for (let c = -1; c < SZ / SW+2; c++) {
      const x = c * SW + (r%2) * SW * 0.5
      const y = r * SH * 0.7
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.moveTo(x + SW*0.5, y + SH)
      ctx.bezierCurveTo(x, y + SH*0.5, x, y, x + SW*0.5, y)
      ctx.bezierCurveTo(x + SW, y, x + SW, y + SH*0.5, x + SW*0.5, y + SH)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }
}
