//immutability helpers?  // auto initialize components?
var domrender = {}
if (typeof module != "undefined") {
    module.exports = domrender;
}
domrender.use = function (el, scope, options) {
    var options = options || {}
    var d = domrender.compile(el)
    d.scope = scope;
    d.render = function(callback) { 
        if (callback) {
          d.renderCallbacks.push(callback) 
        } 
        clearTimeout(d.renderTimeout) 
        d.renderTimeout = setTimeout(function() { // requestAnimationFrame?
            var now = (new Date()).getTime();
            domrender.render(d, scope);
            var duration = (new Date()).getTime() - now
            var theCallback
            while (theCallback = d.renderCallbacks.pop()) {
              theCallback({duration: duration}) 
            }
        }, 16)
    }
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
    for (var i=0; i<d.inputs.length;i++) {
      var input = d.inputs[i]  
      if (input.el.type == "text") {
        if (input.el.value != input.el.ieOldValue) { // ie8
          input.el.ieOldValue = input.el.value 
          input.el.ieHandleChange()
        } 
      }
    }  
    for (var i=0; i<d.childComponents.length;i++) {
      domrender.readAllInputs(d.childComponents[i].d)
    }
    for (var i=0; i<d.dynamicComponents.length;i++) {
      domrender.readAllInputs(d.dynamicComponents[i].d)
    }
    for (var i=0; i<d.forEaches.length;i++) {
      for (j=0; j<d.forEaches[i].compileds.length; j++) {
        domrender.readAllInputs(d.forEaches[i].compileds[j])
      }
    }
}
domrender.compile = function(el, parentD) {
    var d = {}
    if (parentD) {
        d.root = parentD.root
    } else {
        d.root = d
    }
    d.renderCallbacks = []
    el._domrender = d
    d.expressionsAndElements = []
    d.eventElements = []
    d.childComponents = []
    d.forEaches = []
    d.dynamicComponents = []
    d.inputs = []
    d.el = el
    domrender.saveExpressions(d, el)
    return d
}
domrender.getLastObjAndKey = function (me, expr) {
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
    return func.apply(null, args)
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
    var lastObjAndKey = domrender.getLastObjAndKey(me, expr)
    if (!lastObjAndKey || !lastObjAndKey[0]) {
        return null 
    }
    var me = lastObjAndKey[0][lastObjAndKey[1]]
    if ((typeof me) == "function") {
        return me(a, b, c)
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
    domrender.rootScope = d.root.scope;
    for (var i=0; i<d.expressionsAndElements.length; i++) {
        var todo = d.expressionsAndElements[i]
        if (loopScope) { // TODO: only call this once per el.
            todo.el._scope = loopScope
            todo.el._index = index
            todo.el._parentScope = scope
            todo.el[forEachItemName] = loopScope
            todo.el[forEachItemIndex] = index
        } else { // TODO: only call this once per el.
            todo.el._scope = scope
        }
        todo.el._root = d.root.scope //todo.el._rootEl = d.root
        var newProp = domrender.eval(scope, todo.expr, todo.el) // TODO: no binding on @access @bind and @e
        var oldProp = false
        todo.el._domrender = d // already done?
        if (todo.attr == "v" || todo.attr == "vraw") { // v is innerhtml
            oldProp = todo.el.lastInnerHTML
            if (oldProp != newProp) {
                if (todo.attr == "v") {
                    if (!todo.el.firstChild) {
                        var textNode = document.createTextNode(newProp)
                        todo.el.appendChild(textNode)
                    } else {
                        todo.el.firstChild.nodeValue = newProp
                    }
                } else if (todo.attr == "vraw") {
                    todo.el.innerHTML = newProp
                }
                todo.el.lastInnerHTML = newProp
            }
        } else if (todo.attr == "hidden" || todo.attr == "visible") { // so common it's build in (you could only do visible or hidden)
          var isHidden = todo.el.style.display == "none"
          var wantHidden = todo.attr == "hidden"
          var shouldBeHidden = wantHidden && newProp || !newProp
          if (isHidden && !shouldBeHidden) {
            todo.el.style.display = "" 
          }  else if (!isHidden && shouldBeHidden) {
            todo.el.style.display = "none" 
          }
          // TODO: prevent nested renders
        } else if (todo.attr.substr(0, 5) == "style" && todo.attr.length > 5) {
            var styleName = domrender.camelCase(todo.attr.substr(6))
            if (!todo.el.lastStyle) { // I don't know if it's faster to check previous style
                todo.el.lastStyle = {}
            }
            oldProp = todo.el.lastStyle[styleName]
            if (oldProp != newProp) {
                todo.el.style[styleName] = newProp
                todo.el.lastStyle[styleName] = newProp
            }
        } else if (todo.attr.substr(0, 5) == "class" && todo.attr.length > 5) {
            var className = todo.attr.substr(6)
            var classList = (todo.el.getAttribute("class") || "").split(" ") // should I use classList api?
            var classIndex = 0
            for (var classI = 0; classI < classList.length; classI++) {
                if (classList[classI] == className) {
                    oldProp = true 
                    classIndex = classI
                    break
                } 
            }
            if (oldProp && !newProp) {
                classList.splice(classIndex, 1) 
            } else if (!oldProp && newProp) {
                classList.push(className) 
            }
            todo.el.setAttribute("class", classList.join(" "))
        } else if (todo.attr.slice(0, 1) == "?") {
            var actualAttr = todo.attr.slice(1)
            var oldProp = todo.el.getAttribute(actualAttr) != null
            if (newProp && !oldProp) {
                todo.el.setAttribute(actualAttr, "true") 
            } else if (!newProp && oldProp) {
                todo.el.removeAttribute(actualAttr) 
            }
        } else if (todo.attr == "access") {
          domrender.set(scope, todo.expr, todo.el)
        } else {
            oldProp = todo.el.getAttribute(todo.attr)
            if (oldProp != newProp) {
                todo.el.setAttribute(todo.attr, newProp)
            }
        }
    }
    for (var i=0; i<d.childComponents.length; i++) {
        var childComponent = d.childComponents[i]
        var childD = childComponent.d
        var childScope = domrender.eval(scope, childComponent.scopeExpr)
        domrender.render(childD, childScope)
    }
    for (var i=0; i<d.dynamicComponents.length; i++) {
        var dynComp = d.dynamicComponents[i]
        var componentName = domrender.eval(scope, dynComp.componentExpr)
        if (dynComp.lastComponentName != componentName) { // compile it and save it to the dom
            dynComp.el.innerHTML = ""
            var componentNode = document.getElementById(componentName)
            if (componentNode) {
                var cloned = componentNode.cloneNode(true)
                cloned.removeAttribute("id") // 
                var childD = domrender.compile(cloned, d) // TODO: you could cache the compiled value
                dynComp.d = childD  
                dynComp.childEl = cloned
                dynComp.el.appendChild(cloned)
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
    for (var i=0; i<d.eventElements.length; i++) {
        var eventElInfo = d.eventElements[i]
        for (var x in scope) { // this is slower for huge lists, don't use @e in big loops
            eventElInfo.el[eventElInfo.prefix + x] = scope[x] 
        }
    }
    for (var i=0; i<d.forEaches.length; i++) {
        var forEacher = d.forEaches[i]
        var itemsToLoop = domrender.eval(scope, forEacher.scopeExpr)
        if (!itemsToLoop) {
            continue 
        }
        var existingElementLength = forEacher.el.children.length
        var needElementLength = itemsToLoop.length
        // remove extra ones
        for (var j=needElementLength; j<existingElementLength; j++) { 
            forEacher.el.removeChild(forEacher.compileds[j].el)
            // TODO: consider keeping it around for a while. have a pool of ones to reuse?
            forEacher.compileds[j] = null // TODO: you can slice it out before or afterwards, or keep in around in conjunction with the elToRemove
        }
        // add needed ones
        for (var j=existingElementLength; j<needElementLength; j++) {
            var cloned = forEacher.childEl.cloneNode(true)
            var newD = domrender.compile(cloned, d)
            forEacher.compileds[j] = newD
            forEacher.el.appendChild(cloned)
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
    for (var i=0; i<d.inputs.length; i++) {
        var inputter = d.inputs[i]
        var shouldValue = domrender.eval(scope, inputter.name) // doing it this way because could be in loop.
        if (loopScope && !inputter.el.nameUpdatedForLoop) { // you could add this when it adds the element for the loop?
            inputter.el.name = inputter.el.name + "__" + index
            inputter.el.nameUpdatedForLoop = true
        }
        if (inputter.el.type == "checkbox") {
          var currVal = inputter.el.form[inputter.el.name].checked
          if (currVal != shouldValue) {
              inputter.el.form[inputter.el.name].checked = shouldValue
          }
        } else {
          var currVal = inputter.el.form[inputter.el.name].value
          if (currVal != shouldValue) {
              if (window.attachEvent) { // IE8
                if (inputter.el.nodeName == "SELECT") {
                  var select = inputter.el.form[inputter.el.name]
                  for (var si=0; si<select.options.length; si++) {
                    if (select.options[si].value == shouldValue) {
                      select.selectedIndex = si
                      break 
                    } 
                  }
                } else if (inputter.el.type == "radio") {
                    var radios = inputter.el.form[inputter.el.name]
                    for (var ri=0; ri <radios.length; ri++) {
                      if (radios[ri].value == shouldValue) {
                        radios[ri].checked = true 
                        break 
                      } 
                    }
                } else {
                  inputter.el.form[inputter.el.name].value = shouldValue
                }
              } else {
                if (inputter.el.type == "radio") { // duplicated code for now, don't have to do this if the default value for radio is the same as the first option
                    var radios = inputter.el.form[inputter.el.name] 
                    for (var ri=0; ri <radios.length; ri++) {
                      if (radios[ri].value == shouldValue) {
                        radios[ri].checked = true 
                        break 
                      } 
                    }
                } else {
                  inputter.el.form[inputter.el.name].value = shouldValue
                }
              }
          }
        }
    }
}
domrender.specialAttrs = {component: 1, scope: 1, foreach: 1, foreachitemname: 1, foreachitemindex: 1, dynamiccomponent: 1, onmount: 1}
domrender.saveExpressions = function (d, el) {
    if (el.nodeName == "#comment") { // ie8
      return
    }
    if (el.nodeName == "INPUT" || el.nodeName == "TEXTAREA" || el.nodeName == "SELECT") {
        if (el.hasAttribute("@bind")) {
            var bindName = el.getAttribute("name")
            d.inputs.push({el: el, name: bindName})   
            // begin 2-way binding two-way two way. Multiselects are not supported, as of now
            var handleChange = function () {
                if (el._parentScope) { // if it's in a loop, then you are most likely binding to the foreachitemname
                    var usedBindName = bindName + "__" + el._index
                    var usedScope = el // yes the actaul element
                } else {
                    var usedBindName = bindName
                    var usedScope = el._scope
                }
                if (el.type == "checkbox") {
                    var value = el.form[usedBindName].checked
                } else if (window.attachEvent && el.type == "select-one") { // have to do this because of ie8
                  var value = el.form[usedBindName].options[el.form[usedBindName].selectedIndex].value
                } else if (el.type == "radio") { //chrome doesn't need this ie and safari do.
                    var value = el.value
                } else {
                  var value = el.form[usedBindName].value
                }
                domrender.set(usedScope, bindName, value)
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
              if (el.type == "checkbox" || el.type == "radio") {
                  el.addEventListener('change', handleChange) 
              } else {
                  el.addEventListener('input', handleChange)
              }
            }
        }
    }
    var componentAttr = el.getAttribute("@component")
    if (componentAttr) {
        var componentNode = document.getElementById(componentAttr)
        if (componentNode) {
            var cloned = componentNode.cloneNode(true)
            cloned.removeAttribute("id")
            el.appendChild(cloned)
            var childD = domrender.compile(cloned, d)
            d.childComponents.push({el: el, childEl: cloned, scopeExpr: el.getAttribute("@scope"), d: childD})
        }
        return
    }
    var dynamicComponentAttr = el.getAttribute("@dynamiccomponent")
    if (dynamicComponentAttr) {
        d.dynamicComponents.push({el: el, componentExpr: dynamicComponentAttr, scopeExpr: el.getAttribute("@scope")})
    }
    var attrs = el.attributes 
    for (var i = 0; i < attrs.length; i++) {
        var attr = attrs[i]
        if (attr.name[0] == "@") {
            var attrName = attr.name.slice(1)
            if (attr.name == "@e") { // TODO: consider not adding the @e to the expressionsAndElements
                d.eventElements.push({el: el, prefix: valueName || ""}) // TODO: you could see what is in the event handlers and only bind certain keys
            }
            if (domrender.specialAttrs[attrName]) {
                continue;
            }
            var valueName = attr.value
            d.expressionsAndElements.push({expr: valueName, el: el, attr: attrName})
        }
    }
    var forEachValue = el.getAttribute("@foreach")
    if (forEachValue) {
        var forEachItemName = el.getAttribute("@foreachitemname")
        var forEachItemIndex = el.getAttribute("@foreachitemindex")
        var childEl = el.firstElementChild || el.children[0] // children0 for ie8 (might be comment)
        childEl = childEl.cloneNode(true) // have to do this because of IE8, when you set innerHTML to "" it wipes the children if you don't clone it
        el.innerHTML = ""
        d.forEaches.push({scopeExpr: forEachValue, el: el, childEl: childEl, forEachItemName: forEachItemName, forEachItemIndex: forEachItemIndex, compileds: []})
    }
    for (var i = 0; i < el.children.length; i++) {
        domrender.saveExpressions(d, el.children[i])
    }   
}
