// make an object that can be used to deform a section of the mesh.
// The function will deform the vertex with index mainHandle, and
// vertices that are close enough it.
function makeHandlesObj(mainHandle) {

  var newHandlesObj = {
    handles: []
  }

  var visited = []
  for(var i = 0; i < bunny.positions.length; ++i) {
    visited[i] = false
  }

  var currentRing = [mainHandle]

  while(newHandlesObj.handles.length < 10) {

    var nextRing = []

    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      newHandlesObj.handles.push(e)
      visited[e] = true

      var adjs = adj[e]

      for(var j = 0; j < adjs.length; ++j) {
        nextRing.push(adjs[j])
      }
    }
    currentRing = nextRing
  }
  newHandlesObj.unconstrainedBegin = newHandlesObj.handles.length


  // 800
  while(newHandlesObj.handles.length < 100) {

    var nextRing = []

    for(var i = 0; i < currentRing.length; ++i) {
      var e = currentRing[i]

      if(visited[e])
        continue

      newHandlesObj.handles.push(e)
      visited[e] = true

      var adjs = adj[e]
      for(var j = 0; j < adjs.length; ++j) {
        nextRing.push(adjs[j])
      }
    }
    currentRing = nextRing
  }

  newHandlesObj.stationaryBegin = newHandlesObj.handles.length

  var staticVertices = []
  for(var i = 0; i < currentRing.length; ++i) {
    var e = currentRing[i]

    if(visited[e])
      continue

    staticVertices.push(e)
    newHandlesObj.handles.push(e)

    visited[e] = true
  }

  // // verify that it is an actual loop.
  // while(sv.length > 0) {
  //   var breakOuter = false
  //   var adjs = adj[e]
  //   for(var i = 0; i < adjs.length; ++i) {

  //     var p = adjs[i]

  //     for(var j = 0; j < sv.length; ++j) {
  //       if(p === sv[j]) {
  //         breakOuter = true
  //         sortedOrder.push(sv[j])
  //         e = sv[j]
  //         sv.splice(j, 1)
  //         break
  //       }
  //     }

  //     if(breakOuter)
  //       break
  //   }

  //   if(!breakOuter) {
  //     console.log("IS NOT PROPER LOOP)
  //      break
  //   }

  // conse.log("sorred order: ", sortedOrder)

  newHandlesObj.mainHandle = mainHandle
  newHandlesObj.doDeform = prepareDeform(bunny.cells, bunny.positions, newHandlesObj)

  return newHandlesObj

}
