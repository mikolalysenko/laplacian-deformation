var mouseChange = require('mouse-change')
var mouseWheel = require('mouse-wheel')
var identity = require('gl-mat4/identity')
var perspective = require('gl-mat4/perspective')
var lookAt = require('gl-mat4/lookAt')

module.exports = createCamera

var isBrowser = typeof window !== 'undefined'

function createCamera (regl, props_) {
  var props = props_ || {}

  // Preserve backward-compatibilty while renaming preventDefault -> noScroll
  if (typeof props.noScroll === 'undefined') {
    props.noScroll = props.preventDefault;
  }

  var cameraState = {
    view: identity(new Float32Array(16)),
    projection: identity(new Float32Array(16)),
    center: new Float32Array(props.center || 3),
    theta: props.theta || 0,
    phi: props.phi || 0,
    distance: Math.log(props.distance || 10.0),
    eye: new Float32Array(3),
    up: new Float32Array(props.up || [0, 1, 0]),
    fovy: props.fovy || Math.PI / 4.0,
    near: typeof props.near !== 'undefined' ? props.near : 0.01,
    far: typeof props.far !== 'undefined' ? props.far : 1000.0,
    noScroll: typeof props.noScroll !== 'undefined' ? props.noScroll : false,
    flipY: !!props.flipY,
    dtheta: 0,
    dphi: 0,
    rotationSpeed: typeof props.rotationSpeed !== 'undefined' ? props.rotationSpeed : 1,
    zoomSpeed: typeof props.zoomSpeed !== 'undefined' ? props.zoomSpeed : 1,
    renderOnDirty: typeof props.renderOnDirty !== undefined ? !!props.renderOnDirty : false
  }

  var element = props.element
  var damping = typeof props.damping !== 'undefined' ? props.damping : 0.9

  var right = new Float32Array([1, 0, 0])
  var front = new Float32Array([0, 0, 1])

  var minDistance = Math.log('minDistance' in props ? props.minDistance : 0.1)
  var maxDistance = Math.log('maxDistance' in props ? props.maxDistance : 1000)

  var ddistance = 0

  var prevX = 0
  var prevY = 0

  if (isBrowser && props.mouse !== false) {
    var source = element || regl._gl.canvas

    function getWidth () {
      return element ? element.offsetWidth : window.innerWidth
    }

    function getHeight () {
      return element ? element.offsetHeight : window.innerHeight
    }
    mouseChange(source, function (buttons, x, y) {
      if (buttons & 4) {
        var dx = (x - prevX) / getWidth()
        var dy = (y - prevY) / getHeight()

        cameraState.dtheta += cameraState.rotationSpeed * 4.0 * dx
        cameraState.dphi += cameraState.rotationSpeed * 4.0 * dy
        cameraState.dirty = true;
      }
      prevX = x
      prevY = y
    })

    mouseWheel(source, function (dx, dy) {
      ddistance += dy / getHeight() * cameraState.zoomSpeed
      cameraState.dirty = true;
    }, props.noScroll)
  }

  function damp (x) {
    var xd = x * damping
    if (Math.abs(xd) < 0.1) {
      return 0
    }
    cameraState.dirty = true;
    return xd
  }

  function clamp (x, lo, hi) {
    return Math.min(Math.max(x, lo), hi)
  }

  function updateCamera (props) {
    Object.keys(props).forEach(function (prop) {
      cameraState[prop] = props[prop]
    })

    var center = cameraState.center
    var eye = cameraState.eye
    var up = cameraState.up
    var dtheta = cameraState.dtheta
    var dphi = cameraState.dphi

    cameraState.theta += dtheta
    cameraState.phi = clamp(
      cameraState.phi + dphi,
      -Math.PI / 2.0,
      Math.PI / 2.0)
    cameraState.distance = clamp(
      cameraState.distance + ddistance,
      minDistance,
      maxDistance)

    cameraState.dtheta = damp(dtheta)
    cameraState.dphi = damp(dphi)
    ddistance = damp(ddistance)

    var theta = cameraState.theta
    var phi = cameraState.phi
    var r = Math.exp(cameraState.distance)

    var vf = r * Math.sin(theta) * Math.cos(phi)
    var vr = r * Math.cos(theta) * Math.cos(phi)
    var vu = r * Math.sin(phi)

    for (var i = 0; i < 3; ++i) {
      eye[i] = center[i] + vf * front[i] + vr * right[i] + vu * up[i]
    }

    lookAt(cameraState.view, eye, center, up)
  }

  cameraState.dirty = true;

  var injectContext = regl({
    context: Object.assign({}, cameraState, {
      dirty: function () {
        return cameraState.dirty;
      },
      projection: function (context) {
        perspective(cameraState.projection,
          cameraState.fovy,
          context.viewportWidth / context.viewportHeight,
          cameraState.near,
          cameraState.far)
        if (cameraState.flipY) { cameraState.projection[5] *= -1 }
        return cameraState.projection
      }
    }),
    uniforms: Object.keys(cameraState).reduce(function (uniforms, name) {
      uniforms[name] = regl.context(name)
      return uniforms
    }, {})
  })

  function setupCamera (props, block) {
    if (typeof setupCamera.dirty !== 'undefined') {
      cameraState.dirty = setupCamera.dirty || cameraState.dirty
      setupCamera.dirty = undefined;
    }

    if (props && block) {
      cameraState.dirty = true;
    }

    if (cameraState.renderOnDirty && !cameraState.dirty) return;

    if (!block) {
      block = props
      props = {}
    }

    updateCamera(props)
    injectContext(block)
    cameraState.dirty = false;
  }

  Object.keys(cameraState).forEach(function (name) {
    setupCamera[name] = cameraState[name]
  })

  return setupCamera
  //return null
}
