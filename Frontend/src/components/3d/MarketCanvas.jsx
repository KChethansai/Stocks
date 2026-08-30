import { useEffect, useRef } from 'react'

export default function MarketCanvas({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function syncSize() {
      if (!canvas) return
      const w = canvas.clientWidth || 1280
      const h = canvas.clientHeight || 720
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize)
      resizeObserver.observe(canvas)
    }
    syncSize()

    let gl
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    } catch {
      return
    }
    if (!gl) return

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `
    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        float noise = sin(uv.x * 10.0 + u_time) * cos(uv.y * 10.0 + u_time * 0.5);
        vec3 color = mix(vec3(0.035, 0.039, 0.047), vec3(0.231, 0.509, 0.964), noise * 0.08 + 0.04);
        
        // Add subtle grid effect
        float grid = step(0.985, fract(uv.x * 24.0)) + step(0.985, fract(uv.y * 24.0));
        color += grid * 0.018;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `

    function createShader(glCtx, type, src) {
      const s = glCtx.createShader(type)
      glCtx.shaderSource(s, src)
      glCtx.compileShader(s)
      return s
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs)
    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes = gl.getUniformLocation(prog, 'u_resolution')

    let animationId
    let startTime = performance.now()

    function render() {
      if (!canvas || !gl) return
      syncSize()
      gl.viewport(0, 0, canvas.width, canvas.height)
      const elapsed = (performance.now() - startTime) * 0.001
      if (uTime) gl.uniform1f(uTime, prefersReducedMotion ? 0 : elapsed)
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!prefersReducedMotion) {
        animationId = requestAnimationFrame(render)
      }
    }

    render()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (resizeObserver) resizeObserver.disconnect()
      if (gl) {
        gl.deleteBuffer(buf)
        gl.deleteProgram(prog)
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
