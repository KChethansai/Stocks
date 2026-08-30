import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function PortfolioAllocation3D({
  segments = [0.45, 0.25, 0.18, 0.12],
  colors = [0x3B82F6, 0x22C55E, 0x9CA3AF, 0x667085],
  className = ''
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const width = container.clientWidth || 300
    const height = container.clientHeight || 260

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
    camera.position.z = 5.2

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)
    } catch {
      return
    }

    const ringGroup = new THREE.Group()

    let startAngle = 0
    segments.forEach((val, i) => {
      const arcLength = val * Math.PI * 2
      const geometry = new THREE.TorusGeometry(1.9, 0.36, 16, 80, arcLength)
      const material = new THREE.MeshPhongMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.25,
        shininess: 40
      })
      const segment = new THREE.Mesh(geometry, material)
      segment.rotation.z = startAngle
      ringGroup.add(segment)
      startAngle += arcLength
    })

    ringGroup.rotation.x = Math.PI / 3.2
    scene.add(ringGroup)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 0.9)
    pointLight.position.set(5, 5, 5)
    scene.add(pointLight)

    let animationId
    function animate() {
      if (!prefersReducedMotion) {
        ringGroup.rotation.z += 0.006
      }
      renderer.render(scene, camera)
      if (!prefersReducedMotion) {
        animationId = requestAnimationFrame(animate)
      }
    }

    animate()

    function handleResize() {
      if (!container || !renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      if (prefersReducedMotion) renderer.render(scene, camera)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      if (container && renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      renderer.dispose()
    }
  }, [segments, colors])

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${className}`}
      style={{ minHeight: '200px' }}
    />
  )
}
