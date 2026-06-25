import * as THREE from 'three'

export type ColliderType = 'sphere' | 'plane' | 'capsule'

export interface SphereCollider {
  type:   'sphere'
  id:     string
  center: THREE.Vector3
  radius: number
}

export interface PlaneCollider {
  type:   'plane'
  id:     string
  normal: THREE.Vector3
  offset: number
}

export interface CapsuleCollider {
  type:   'capsule'
  id:     string
  a:      THREE.Vector3
  b:      THREE.Vector3
  radius: number
}

export type ColliderDesc = SphereCollider | PlaneCollider | CapsuleCollider
