// domrender.beta.js just removes the deprecated @bind feature, replaced with @b

// TODO: consider multiple children with foreach with document fragment
// TODO: get repeater working?
// TODO: rething the ~ and ^ special characters. Maybe replace with _window and _scope (also see 'helpers')
// TODO: potentially make @flatten the default
var domrender = {}
if (typeof module != "undefined") {
    module.exports = domrender;
}
domrender.use = function (el, scope, options) {
    var options = options || {}
    var d = domrender.compile(el)
    d.scope = scope;
    var _render = function (callback) {
        d.allInputs = [] // clear out the existing allinputs
        if (options.preventAsyncRender && callback) {
          d.renderCallbacks.push(callback) 
        } 
        var now = (new Date()).getTime();
        domrender.render(d, scope);
        var duration = (new Date()).getTime() - now
        var theCallback
        while (theCallback = d.renderCallbacks.shift()) {
          theCallback({duration: duration}) 
        }
    }
    var render = _render
    if (!options.preventAsyncRender) {
        render = function (callback) {
          if (!options.preventAsyncRender && callback) {
            d.renderCallbacks.push(callback) 
          } 
          clearTimeout(d.renderTimeout) 
          d.renderTimeout = setTimeout(function() { // requestAnimationFrame?
            _render(callback)
          }, 16)
        } 
    }
    d.render = render
    if (!options.preventInitialRender) {
      d.render()
    }
    if (window.attachEvent) { //ie and 9?
      d.ie8InputInterval = setInterval(function() {
        domrender.readAllInputs(d)
      }, 1000) 
    }
    d.destroy = function () {
      clearTimeout(d.ie8InputInterval)  //ie8
    }
    return d
}
domrender.readAllInputs=function(d) {
    if (!d) {
      return 
    }
    for (var i=0; i<d.allInputs.length;i++) {
      var el = d.allInputs[i]
      if (el.value != el.ieOldValue) { // ie8
        el.ieOldValue = el.value 
        el.ieHandleChange()
      } 
    }
}
domrender.create = function (Type, obj) {
  var ret = new Type()
  for (key in obj) {
    ret[key] = obj[key] 
  }
  return ret
}
domrender.ForEacher = function() {}
domrender.Switcher = function() {}
domrender.Repeater = function() {}
domrender.DynamicComponent = function() {}
domrender.BoundInputAlt = function() {} // that doesn't require
domrender.Component = function() {}
domrender.BoundAttribute = function () {}
domrender.EventElement = function () {}
domrender.BoundText = function () {}
domrender.BoundHTML = function () {}
domrender.BoundStyle = function () {}
domrender.BoundClass = function () {}
domrender.BoundExistsAttribute = function () {}
domrender.BoundVisible = function () {}
domrender.BoundAccess = function () {}
domrender.BoundElementGeneral = function () {}
domrender.BoundDebug = function () {}
domrender.BoundText.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var newText = domrender.eval(scope, todo.expr, todo.el)
    var oldText = todo.el.lastInnerHTML
    if (oldText != newText) {
        if (!todo.el.firstChild) {
            var textNode = document.createTextNode(newText)
            todo.el.appendChild(textNode)
        } else {
            todo.el.firstChild.nodeValue = newText
        }
        todo.el.lastInnerHTML = newText
    }
}
domrender.BoundHTML.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var newHTML = domrender.eval(scope, todo.expr, todo.el)
    var oldHTML = todo.el.lastInnerHTML
    if (oldHTML != newHTML) {
        todo.el.innerHTML = newHTML
        todo.el.lastInnerHTML = newHTML
    }
}
domrender.BoundVisible.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var shouldBeHidden = !domrender.eval(scope, todo.expr, todo.el)
    var isHidden = todo.el.style.display == "none"
    if (isHidden && !shouldBeHidden) {
      todo.el.style.display = "" 
    }  else if (!isHidden && shouldBeHidden) {
      todo.el.style.display = "none" 
    }
    // TODO: prevent nested renders for hidden things
}
domrender.BoundStyle.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var newStyle = domrender.eval(scope, todo.expr, todo.el)
    if (!todo.el.lastStyle) { // I don't know if it's faster to check previous style
        todo.el.lastStyle = {}
    }
    var oldStyle = todo.el.lastStyle[todo.styleName]
    if (oldStyle != newStyle) {
        todo.el.style[todo.styleName] = newStyle
        todo.el.lastStyle[todo.styleName] = newStyle
    }
}
domrender.BoundClass.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var classExists = domrender.eval(scope, todo.expr, todo.el)
    var classList = (todo.el.getAttribute("class") || "").split(" ") // should I use classList api?
    var classIndex = 0
    var classExisted = false
    for (var classI = 0; classI < classList.length; classI++) {
        if (classList[classI] == todo.className) {
            classExisted = true 
            classIndex = classI
            break
        } 
    }
    if (classExisted && !classExists) {
        classList.splice(classIndex, 1) 
    } else if (!classExisted && classExists) {
        classList.push(todo.className) 
    }
    todo.el.setAttribute("class", classList.join(" "))
}
domrender.BoundExistsAttribute.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var attrExists = domrender.eval(scope, todo.expr, todo.el)
    var attrExisted = todo.el.getAttribute(todo.attr) != null
    if (attrExists && !attrExisted) {
        todo.el.setAttribute(todo.attr, "true") 
    } else if (!attrExists && attrExisted) {
        todo.el.removeAttribute(todo.attr) 
    }
}
domrender.BoundAccess.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
  domrender.set(scope, this.expr, this.el)
}
domrender.BoundAttribute.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var todo = this
    var attrValue = domrender.eval(scope, todo.expr, todo.el)
    oldAttrValue = todo.el.getAttribute(todo.attr)
    if (oldAttrValue != attrValue) {
        todo.el.setAttribute(todo.attr, attrValue)
    }
}
domrender.BoundDebug.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
  debugger
}
domrender.BoundElementGeneral.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
  var todo = this
  if (loopScope) {
      todo.el._scope = loopScope
      todo.el._index = index
      todo.el._parentScope = scope
      todo.el[forEachItemName] = loopScope
      todo.el[forEachItemIndex] = index
  } else {
      todo.el._scope = scope
  }
  todo.el._root = d.root.scope //todo.el._rootEl = d.root
  todo.el._domrender = d 
}
domrender.Component.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    domrender.render(this.d, domrender.eval(scope, this.scopeExpr)) // no passing in loop scope?
}
domrender.DynamicComponent.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    var dynComp = this
    var componentName = domrender.eval(scope, dynComp.componentExpr)
    if (dynComp.lastComponentName != componentName) { // compile it and save it to the dom
        dynComp.el.innerHTML = "" // best way to clear it out?
        var componentNode = document.getElementById(componentName)
        if (componentNode) {
            var cloned = componentNode.cloneNode(true)
            // TODO: work on flattening
            if (dynComp.el.getAttribute("@flatten")) {
                var frag = document.createDocumentFragment()
                var child
                while (child = cloned.firstChild) {
                    cloned.removeChild(child)
                    frag.appendChild(child)
                }
                dynComp.el.appendChild(frag)
                dynComp.el.removeAttribute("@dynamiccomponent")
                dynComp.el.setAttribute("data-beta-dynamiccomponent", dynComp.componentExpr)
                dynComp.el.setAttribute("data-beta-used-dynamiccomponent", componentName)
                var childD = domrender.compile(dynComp.el, d)
                dynComp.childEl = dynComp.el
            } else {
                cloned.removeAttribute("id") // 
                dynComp.el.appendChild(cloned)
                var childD = domrender.compile(cloned, d) // TODO: you could cache the compiled value
                dynComp.childEl = cloned
            }
            
            dynComp.d = childD  
        } else {
            dynComp.d = null
        }
        dynComp.lastComponentName = componentName
    }
    if (dynComp.d) {
        var componentScope = domrender.eval(scope, dynComp.scopeExpr) // TODO: cache component scope, but it could be a function
        domrender.render(dynComp.d, componentScope)
    }
}
domrender.EventElement.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) { // put this on the boundelementgeneral?
    for (var x in scope) { // this is slower for huge lists, don't use @e in big loops
        this.el[this.prefix + x] = scope[x] 
    }
}
domrender.ForEacher.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) { // put this on the boundelementgeneral?
    // key optimization?
    var forEacher = this
    if (forEacher.forEachImmutable && forEacher.processed) {
        return 
    }
    this.processed = true;
    var itemsToLoop = domrender.eval(scope, forEacher.scopeExpr)
    if (!itemsToLoop) {
      return
    }
    var existingElementLength = forEacher.el.children.length
    var needElementLength = itemsToLoop.length
    // remove extra ones
    for (var j=needElementLength; j<existingElementLength; j++) { 
        forEacher.el.removeChild(forEacher.compileds[j].el)
        // TODO: consider keeping it around for a while. have a pool of ones to reuse?
        forEacher.compileds[j] = null // TODO: you can slice it out before or afterwards, or keep in around in conjunction with the elToRemove
    }

    //var loopLength = itemsToLoop.length 
    //if (existingElementLength < needElementLength) {
    //  var frag = document.createDocumentFragment() 
    //  for (var j=existingElementLength; j<needElementLength; j++) {
    //      var item = itemsToLoop[j]
    //      scope[forEacher.forEachItemName] = item
    //      scope[forEacher.forEachItemIndex] = j
    //      domrender.render(forEacher.exampleCompiled, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)
    //      var cloned = forEacher.childEl.cloneNode(true)
    //      var newD = domrender.compile(cloned, d)
    //      //domrender.render(newD, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)
    //      forEacher.compileds[j] = newD
    //      frag.appendChild(cloned)
    //      //forEacher.el.appendChild(cloned)
    //  }
    //  forEacher.el.appendChild(frag)
    //  loopLength = existingElementLength 
    //}
    //// render

    //for (var j=0; j<loopLength; j++) {
    //    var item = itemsToLoop[j]
    //    var eachD = forEacher.compileds[j]
    //    scope[forEacher.forEachItemName] = item
    //    scope[forEacher.forEachItemIndex] = j
    //    domrender.render(eachD, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)    
    //}

    if (existingElementLength < needElementLength) {
      var frag = document.createDocumentFragment() 
      for (var j=existingElementLength; j<needElementLength; j++) {
          var cloned = forEacher.childEl.cloneNode(true)
          var newD = domrender.compile(cloned, d)
          forEacher.compileds[j] = newD
          frag.appendChild(cloned)
          //forEacher.el.appendChild(cloned)
      }
      forEacher.el.appendChild(frag)
    }
    // render
    for (var j=0; j<itemsToLoop.length; j++) {
        var item = itemsToLoop[j]
        var eachD = forEacher.compileds[j]
        scope[forEacher.forEachItemName] = item
        scope[forEacher.forEachItemIndex] = j
        domrender.render(eachD, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)    
    }
}
domrender.Switcher.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) { // put this on the boundelementgeneral?
    var matchingCase = false
    for (var i=0; i<this.cases.length;i++) {
      var theCase = this.cases[i] 
      var match = domrender.eval(scope, theCase["case"])
      if (match) {
        matchingCase = theCase
        break;
      }
    }
    if (!matchingCase) {
      matchingCase = this["default"]
    }
    if (!matchingCase) {
      if (this.lastEl) {
        this.lastEl.style.display = "none" 
      }
      return 
    }
    if (!matchingCase.d) {
        matchingCase.d = domrender.compile(matchingCase.el, d)
    }
    
    if (this.lastEl && this.lastEl != matchingCase.el) {
      this.lastEl.style.display = "none" 
    }
    this.lastEl = matchingCase.el 
    domrender.render(matchingCase.d, scope)
    matchingCase.el.style.display = ""
}
domrender.Repeater.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) { // put this on the boundelementgeneral?
    // THIS DOES NOT YET WORK
    var forEacher = this
    var itemsToLoop = domrender.eval(scope, forEacher.scopeExpr)
    if (!itemsToLoop) {
      return
    }
    var existingElementLength = forEacher.existingLength
    var needElementLength = itemsToLoop.length
    // remove extra ones
    for (var j=needElementLength; j<existingElementLength; j++) { 
        forEacher.parentNode.removeChild(forEacher.compileds[j].el)
        // TODO: consider keeping it around for a while. have a pool of ones to reuse?
        forEacher.compileds[j] = null // TODO: you can slice it out before or afterwards, or keep in around in conjunction with the elToRemove
    }

    if (existingElementLength < needElementLength) {
      var frag = document.createDocumentFragment() 
      for (var j=existingElementLength; j<needElementLength; j++) {
          var cloned = forEacher.childEl.cloneNode(true)
          var newD = domrender.compile(cloned, d)
          forEacher.compileds[j] = newD
          frag.appendChild(cloned)
          //forEacher.el.appendChild(cloned)
      }
      forEacher.parentNode.appendChild(frag)
    }
    // render
    for (var j=0; j<itemsToLoop.length; j++) {
        var item = itemsToLoop[j]
        var eachD = forEacher.compileds[j]
        scope[forEacher.forEachItemName] = item
        scope[forEacher.forEachItemIndex] = j
        domrender.render(eachD, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)    
    }
    forEacher.existingLength = itemsToLoop
}
domrender.BoundInputAlt.prototype.process = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) { // put this on the boundelementgeneral?
    var inputter = this
    d.root.allInputs.push(inputter.el) // for ie8
    var shouldValue = domrender.eval(scope, inputter.name) // doing it this way because could be in loop.
    if (inputter.el.type == "checkbox") {
      var currVal = inputter.el.checked
      if (currVal != shouldValue) {
          inputter.el.checked = shouldValue
      }
    } else if (inputter.el.type == "radio") {
        // you could break out of all other radios of the same name or something
        if (inputter.el.value == shouldValue) {
          inputter.el.checked = true
        }
    } else {
      var currVal = inputter.el.value // TODO: currVal could be wrong here!, have to get more advanced
      if (currVal != shouldValue) {
        if (inputter.el.nodeName == "SELECT") {
          var select = inputter.el
          for (var si=0; si<select.options.length; si++) {
            if (select.options[si].value == shouldValue) {
              select.selectedIndex = si
              break 
            } 
          }
        } else {
          inputter.el.value = shouldValue
        }
      }
    }
}
domrender.compile = function(el, parentD) {
    var d = {
      renderCallbacks: [], 
      boundThings: [], // TODO IE8 input fix
      el: el
    }
    el._domrender = d
    if (parentD) {
        d.root = parentD.root
    } else {
        d.root = d
    }
    domrender.saveExpressions(d, el)
    return d
}
domrender.getLastObjAndKey = function (me, expr) {
    var firstChar = expr.charAt(0)
    if (firstChar == "~") {
        me = domrender.rootScope
        expr = expr.slice(1) 
    } else if (firstChar == "^") {
        me = window
        expr = expr.slice(1) 
    }

    var dotParts = expr.split(".")
    if (dotParts[0] === "helpers") {
        me = domrender.rootScope; // this is ok because it changes every time you call render
    }
    for (var i = 0; i < dotParts.length - 1; i++) {
        var name = dotParts[i]
        me = me[name]   
        if (me === null) {
            return null
        }
    }
    var lastPart = dotParts[dotParts.length - 1]
    return [me, lastPart]
}
domrender.evalFunc = function(me, expressions, a, b, c) {
    var lastObjAndKey = domrender.getLastObjAndKey(me, expressions[0])
    var func =  lastObjAndKey[0][lastObjAndKey[1]]
    var args = []
    for (var i = 1; i < expressions.length; i++) {
        args.push(domrender.eval2(me, expressions[i], a, b, c))
    }
    if (!func) {
        return false;
    }
    return func.apply(lastObjAndKey[0], args)
}
domrender.eval = function (me, expr, a, b, c) {
    var opposite = (expr.substr(0, 1) == "!")
    if (opposite) {
      expr = expr.substr(1) 
    }
    var expressions = expr.split(" ")
    if (expressions.length == 1)  {
        var ret = domrender.eval2(me, expr, a, b, c)
    } else {
      var ret = domrender.evalFunc(me, expressions, a, b, c)
    }
    if (opposite) {
      return !ret  
    }
    return ret
}
domrender.eval2 = function(me, expr, a, b, c) {
    if (expr == "this") {
        return me 
    }
    var lastObjAndKey = domrender.getLastObjAndKey(me, expr)
    if (!lastObjAndKey || !lastObjAndKey[0]) {
        return null 
    }
    var me = lastObjAndKey[0][lastObjAndKey[1]]
    if ((typeof me) == "function") {
        return me.call(lastObjAndKey[0], a, b, c)
        //return me(a, b, c)
    }
    return me
}
domrender.set = function (me, expr, value) {
    var lastObjAndKey = domrender.getLastObjAndKey(me, expr)
    var obj = lastObjAndKey[0]
    var key = lastObjAndKey[1]
    var oldValue = obj[key]
    obj[key] = value
    if (obj._onInputChangeExperimental) { // only for changes via inputs, etc not normal rendering change detections, because you could just call a function
      obj._onInputChangeExperimental(obj, key, value, oldValue)
    }
    return obj;
}
domrender.camelCase = function (val) {
    var parts = val.split("-")
    var ret = [parts[0]]
    for (var i=1; i<parts.length; i++) {
        ret.push(parts[i][0].toUpperCase() + parts[i].slice(1)) 
    }
    return ret.join("")
}
domrender.render = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    // if scope is immutable and hasn't changed, skip the render
    domrender.rootScope = d.root.scope;
    for (var i=0; i<d.boundThings.length; i++) {
      d.boundThings[i].process(d, scope, loopScope, index, forEachItemName, forEachItemIndex) 
    }
}
domrender.specialAttrs = {"@scope": 1, "@foreachitemname": 1, "@foreachitemindex": 1, "@default": 1, "@case": 1, "@flatten": 1, "@foreachimmutable": 1}
domrender.saveExpressions = function (d, el) {
    if (el.nodeName == "#comment") { // ie8
      return
    }
    var attrs = el.attributes 
    var markedElement = false
    var shouldCompileChildren = true
    if (attrs) {
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i]
            if (attr.name[0] == "@") {
                if (!markedElement) {
                  var boundThing = domrender.create(domrender.BoundElementGeneral, {el: el})
                  d.boundThings.push(boundThing) // for bookkeeping things
                  markedElement = true
                }
                if (domrender.specialAttrs[attr.name]) {
                    continue;
                }
                var boundThing = domrender.createBoundThingFromAttribute(attr.name, attr.value, el, d)
                if (boundThing == domrender.stop)  {
                    return boundThing
                }
                if (boundThing) {
                    if (boundThing.preventChildCompile) {
                        shouldCompileChildren = false 
                    }
                  d.boundThings.push(boundThing)
                }
            }
        }
    
    } else {
    }
    if (shouldCompileChildren) {
        for (var i = 0; i < el.children.length; i++) {
            var ret = domrender.saveExpressions(d, el.children[i])
            if (ret == domrender.stop) {
                break 
            }
        }   
    }
}
domrender.attributeBoundThingMap = {
  "@e": function (name, value, el) {
    return domrender.create(domrender.EventElement, {el: el, prefix: value || ""}) 
  },
  "@v": function (name, value, el) {
    return domrender.create(domrender.BoundText, {expr: value, el: el})
  },
  "@vraw": function (name, value, el) {
    return domrender.create(domrender.BoundHTML, {expr: value, el: el})
  },
  "@visible": function (name, value, el) {
    return domrender.create(domrender.BoundVisible, {expr: value, el: el}) 
  },
  "@style": function (name, value, el, name2) {
    return domrender.create(domrender.BoundStyle, {expr: value, styleName: domrender.camelCase(name2), el: el})
  },
  "@class": function (name, value, el, name2) {
    return domrender.create(domrender.BoundClass, {expr: value, className: name2, el: el})
  },
  "@access": function (name, value, el) {
    return domrender.create(domrender.BoundAccess, {name: value, el: el})
  },
  "@debug": function (name, value, el) {
    return domrender.create(domrender.BoundDebug, {name: value, el: el})
  },
  "@b": function (name, value, el, name2, d) {
        var bindName = value
        // begin 2-way binding two-way two way. Multiselects are not supported, as of now
        var handleChange = function () {
            if (el._parentScope) { // if it's in a loop, then you are most likely binding to the foreachitemname
                var usedScope = el // yes the actaul element
            } else {
                var usedScope = el._scope
            }
            if (el.type == "checkbox") {
                var value = el.checked
            } else if (window.attachEvent && el.type == "select-one") { // have to do this because of ie
              var value = el.options[el.selectedIndex].value
            } else if (el.type == "radio") { //chrome doesn't need this ie and safari do.
                var value = el.value
            } else {
              var value = el.value
            }
            domrender.set(usedScope, bindName, value)
            if (el._onreceiveExpr) {
              domrender.eval(usedScope, el._onreceiveExpr, el._scope, el, value)
            }
            d.root.render() // render the lot
            return true;
        }
        if (el.attachEvent) { // ie8
          if (el.type == "checkbox" || el.type == "radio") {
              el.attachEvent('onchange', handleChange) 
              el.attachEvent('onclick', function () {
                this.focus()
                this.blur()
              }) 
          } else {
              el.attachEvent('onchange', handleChange)
          }
          el.ieHandleChange = handleChange
          el.ieOldValue = el.value 
        } else {
          if (el.type == "checkbox" || el.type == "radio" || el.type == "select-one") {
              el.addEventListener('change', handleChange) 
          } else {
              el.addEventListener('input', handleChange)
          }
        }
        return domrender.create(domrender.BoundInputAlt, {el: el, name: bindName})
  },
  "@component": function (name, value, el, name2, d) {
      var componentNode = document.getElementById(value)
      if (!componentNode) {
        return  null
      }
      var cloned = componentNode.cloneNode(true)
      // TODO: consider making flatten the default
      if (el.getAttribute("@flatten")) {
        var frag = document.createDocumentFragment() 
        var child
        while (child = cloned.firstChild) {
            cloned.removeChild(child)
            frag.appendChild(child)
        }
        el.appendChild(frag)
        var childEl = el // not frag 
        el.removeAttribute("@component")
        el.setAttribute("data-beta-usedcomponent", value) // interesting that I can't set attributes with @, at least in chrome
      } else {
          cloned.removeAttribute("id")
          el.appendChild(cloned)
          var childEl = cloned
      }
      var childD = domrender.compile(childEl, d)
      return domrender.create(domrender.Component, {el: el, childEl: childEl, scopeExpr: el.getAttribute("@scope") || "this", d: childD, preventChildCompile: true})
  },
  "@dynamiccomponent": function (name, value, el) {
    return domrender.create(domrender.DynamicComponent, {el: el, componentExpr: value, scopeExpr: el.getAttribute("@scope") || "this"})
  },
  "@foreach": function (name, value, el, name2, d) {
      var forEachItemName = el.getAttribute("@foreachitemname")
      var forEachItemIndex = el.getAttribute("@foreachitemindex")
      var childEl = el.firstElementChild || el.children[0] // children0 for ie8 (might be comment)
      childEl = childEl.cloneNode(true) // have to do this because of IE8, when you set innerHTML to "" it wipes the children if you don't clone it
      //var exampleCompiled = domrender.compile(childEl, d)
      el.innerHTML = "" // maybe remove the first node?
      var forEachImmutable = el.getAttribute("@foreachimmutable")
      return domrender.create(domrender.ForEacher,{forEachImmutable: forEachImmutable, scopeExpr: value, el: el, childEl: childEl, forEachItemName: forEachItemName, forEachItemIndex: forEachItemIndex, compileds: []/*, exampleCompiled: exampleCompiled*/})
  },
  "@repeat": function (name, value, el, name2, d) {
      // REPEAT does not yet work
      var forEachItemName = el.getAttribute("@repeateritemname")
      var forEachItemIndex = el.getAttribute("@repeateritemindex")
      var childEl = el
      var parentNode = el.parentNode()
      childEl = childEl.cloneNode(true) // have to do this because of IE8, when you set innerHTML to "" it wipes the children if you don't clone it
      //var exampleCompiled = domrender.compile(childEl, d)
      el.innerHTML = "" // maybe remove the first node?
      return domrender.create(domrender.Repeater,{els: [], parentNode: parentNode, existingLength: 0, scopeExpr: value, el: el, childEl: childEl, forEachItemName: forEachItemName, forEachItemIndex: forEachItemIndex, compileds: []/*, exampleCompiled: exampleCompiled*/})
  },
  "@onreceive": function (name, value, el) {
    el._onreceiveExpr = value
    // not returning anything
  },
  "@switch": function (name, value, el, name2, d) {
      var children = el.children   
      var cases = []
      var theDefault
      for (var i=0; i<children.length; i++) {
        var el = children[i]
        el.style.display = "none" // hide it
        var theCase = {
          d: null,//domrender.compile(el, d), // you could compile only when it
          el: el,
          "case": el.getAttribute("@case")
        }
        if (!theDefault && el.getAttribute("@default") === "") { // ie?
          theDefault = theCase 
        } else {
          cases.push(theCase)
        }
      }
      return domrender.create(domrender.Switcher, {el: el, cases: cases, "default": theDefault, preventChildCompile: true})
  }
}
domrender.stop = {}
domrender.createBoundThingFromAttribute = function (name, value, el, d) {
  if (name.charAt(1) == "?") {
    return domrender.create(domrender.BoundExistsAttribute, {expr: value, attr: name.slice(2), el: el})
  }
  var nameParts = name.split(".")
  var name1 = nameParts[0]
  var name2 = nameParts[1] // only can have a.b style for now.
  var func = domrender.attributeBoundThingMap[name1]
  // regular old attrubutes
  if (!func || name == "@style" || name == "@class") { // full name is @style or @class
    return domrender.create(domrender.BoundAttribute, {expr: value, attr: name.slice(1), el: el})
  }
  return func(name1, value, el, name2, d)
}
