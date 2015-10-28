// instead of having separate arrays for foreaches, epsressionsandelements, etc etc, just have a big array with a type // that way things are done in same order as defined, so you can hack stateful things
// immutability helpers?
var domrender4 = {}
if (typeof module != "undefined") {
    module.exports = domrender4;
}
domrender4.use = function (el, scope) {
    var d = domrender4.compile(el)
    d.scope = scope;
    d.render = function(callback) { 
        if (callback) {
          d.renderCallbacks.push(callback) 
        } 
        clearTimeout(d.renderTimeout) 
        d.renderTimeout = setTimeout(function() {
            var now = Date.now(); domrender4.render(d, scope); var duration = Date.now() - now
            var theCallback
            while (theCallback = d.renderCallbacks.pop()) {
              theCallback() 
            }
            //console.log("it took " + duration + " millis to render.")
        }, 16)
    }
    d.render()
    return d
}
domrender4.compile = function(el, parentD) {
    var d = {}
    if (parentD) {
        d.root = parentD.root
    } else {
        d.root = d
    }
    d.renderCallbacks = []
    el._domrender4 = d
    d.expressionsAndElements = []
    d.eventElements = []
    d.childComponents = []
    d.forEaches = []
    d.dynamicComponents = []
    d.inputs = []
    d.el = el
    domrender4.saveExpressions(d, el)
    return d
}
domrender4.getLastObjAndKey = function (me, expr) {
    var dotParts = expr.split(".")
    if (dotParts[0] === "helpers") {
        me = domrender4.rootScope; // this is ok because it changes every time you call render
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
domrender4.evalFunc = function(me, expressions, a, b, c) {
    var lastObjAndKey = domrender4.getLastObjAndKey(me, expressions[0])
    var func =  lastObjAndKey[0][lastObjAndKey[1]]
    var args = []
    for (var i = 1; i < expressions.length; i++) {
        args.push(domrender4.eval2(me, expressions[i], a, b, c))
    }
    if (!func) {
        console.error("DOMRENDER:", "attempted to evaluate '" + expressions[0] + "' but could not find it!");
        return false;
    }
    return func.apply(null, args)
}
domrender4.eval = function (me, expr, a, b, c) {
    var expressions = expr.split(" ")
    if (expressions.length == 1)  {
        return domrender4.eval2(me, expr, a, b, c)
    }
    return domrender4.evalFunc(me, expressions, a, b, c)
}
domrender4.eval2 = function(me, expr, a, b, c) {
    var lastObjAndKey = domrender4.getLastObjAndKey(me, expr)
    if (!lastObjAndKey || !lastObjAndKey[0]) {
        return null 
    }
    var me = lastObjAndKey[0][lastObjAndKey[1]]
    if ((typeof me) == "function") {
        return me(a, b, c)
    }
    return me
}
domrender4.set = function (me, expr, value) {
    var lastObjAndKey = domrender4.getLastObjAndKey(me, expr)
    lastObjAndKey[0][lastObjAndKey[1]] = value
    return lastObjAndKey[0];
}
domrender4.camelCase = function (val) {
    var parts = val.split("-")
    var ret = [parts[0]]
    for (var i=1; i<parts.length; i++) {
        ret.push(parts[i][0].toUpperCase() + parts[i].slice(1)) 
    }
    return ret.join("")
}
domrender4.render = function (d, scope, loopScope, index, forEachItemName, forEachItemIndex) {
    domrender4.rootScope = d.root.scope;
    for (var i=0; i<d.childComponents.length; i++) {
        var childComponent = d.childComponents[i]
        var childD = childComponent.d
        var childScope = domrender4.eval(scope, childComponent.scopeExpr)
        if (childScope) {
            domrender4.render(childD, childScope)
        }
    }
    for (var i=0; i<d.dynamicComponents.length; i++) {
        var dynComp = d.dynamicComponents[i]
        var componentName = domrender4.eval(scope, dynComp.componentExpr)
        if (dynComp.lastComponentName != componentName) { // compile it and save it to the dom
            dynComp.el.innerHTML = ""
            var componentNode = document.getElementById(componentName)
            if (componentNode) {
                var cloned = componentNode.cloneNode(true)
                cloned.removeAttribute("id") // 
                var childD = domrender4.compile(cloned, d) // TODO: you could cache the compiled value
                dynComp.d = childD  
                dynComp.childEl = cloned
                dynComp.el.appendChild(cloned)
            } else {
                dynComp.d = null
            }
            dynComp.lastComponentName = componentName
        }
        if (dynComp.d) {
            var componentScope = domrender4.eval(scope, dynComp.scopeExpr) // TODO: cache component scope, but it could be a function
            domrender4.render(dynComp.d, componentScope)
        }
    }
    for (var i=0; i<d.expressionsAndElements.length; i++) {
        var todo = d.expressionsAndElements[i]
        // consider ignoring this in place of the eventElements
        // TODO: does this get called more than once per el. I think so
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
        var newProp = domrender4.eval(scope, todo.expr, todo.el) // TODO: no binding on @access @bind and @e
        var oldProp = false
        todo.el._domrender4 = d // already done?
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
        } else if (todo.attr.substr(0, 5) == "style" && todo.attr.length > 5) {
            var styleName = domrender4.camelCase(todo.attr.substr(6))
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
            // TODO: use classList
            var classList = (todo.el.getAttribute("class") || "").split(" ")
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
          domrender4.set(scope, todo.expr, todo.el)
        } else {
            oldProp = todo.el.getAttribute(todo.attr)
            if (oldProp != newProp) {
                todo.el.setAttribute(todo.attr, newProp)
            }
        }
    }
    for (var i=0; i<d.eventElements.length; i++) {
        var eventElInfo = d.eventElements[i]
        for (var x in scope) { // is this cray slow?
            eventElInfo.el[eventElInfo.prefix + x] = scope[x] 
        }
    }
    for (var i=0; i<d.forEaches.length; i++) {
        var forEacher = d.forEaches[i]
        var itemsToLoop = domrender4.eval(scope, forEacher.scopeExpr)
        if (!itemsToLoop) {
            continue 
        }
        var existingElementLength = forEacher.el.children.length
        // TODO: Handle uninitialized items.
        var needElementLength = itemsToLoop.length
        // remove extra ones
        for (var j=needElementLength; j<existingElementLength; j++) { 
            forEacher.el.removeChild(forEacher.compileds[j].el)
            // TODO: consider keeping it around for a while. have a pool of ones to reuse?
            forEacher.compileds[j] = null // TODO: you can slice it out before or afterwards, or keep in around ini conjunction with the elToRemove
        }
        // add needed ones
        for (var j=existingElementLength; j<needElementLength; j++) {
            var cloned = forEacher.childEl.cloneNode(true)
            var newD = domrender4.compile(cloned, d)
            forEacher.compileds[j] = newD
            forEacher.el.appendChild(cloned)
        }
        // render
        for (var j=0; j<itemsToLoop.length; j++) {
            var item = itemsToLoop[j]
            var eachD = forEacher.compileds[j]
            scope[forEacher.forEachItemName] = item
            scope[forEacher.forEachItemIndex] = j
            domrender4.render(eachD, scope, item, j, forEacher.forEachItemName, forEacher.forEachItemIndex)    
        }
    }
    for (var i=0; i<d.inputs.length; i++) {
        var inputter = d.inputs[i]
        var shouldValue = domrender4.eval(scope, inputter.name) // doing it this way because could be in loop..
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
              inputter.el.form[inputter.el.name].value = shouldValue
          }
        }
    }
}
domrender4.specialAttrs = {component: 1, scope: 1, foreach: 1, foreachitemname: 1, foreachitemindex: 1, dynamiccomponent: 1, onmount: 1}
domrender4.saveExpressions = function (d, el) {
    if (el.nodeName == "INPUT" || el.nodeName == "TEXTAREA" || el.nodeName == "SELECT") {
        if (el.hasAttribute("@bind")) {
            var bindName = el.getAttribute("name")
            d.inputs.push({el: el, name: bindName})   
            // begin 2-way binding two-way two way. Multiselects are not supported, as of now
            // TODO: only set if the value is different?!
            var handleChange = function () {
                if (el._parentScope) { // if it's in a loop, then you are most likely binding to the foreachitemname
                    if (el.type == "checkbox") {
                      var value = el.form[bindName + "__" + el._index].checked
                    } else {
                      var value = el.form[bindName + "__" + el._index].value
                    }
                    domrender4.set(el, bindName, value)
                } else {
                    if (el.type == "checkbox") {
                      var value = el.form[bindName].value // for selects and radio, could do el.value for some elements
                    } else {
                      var value = el.form[bindName].value
                    }
                    domrender4.set(el._scope, bindName, value)
                }
                d.root.render() // render the lot
            }
            if (el.type == "checkbox" || el.type == "radio") {
                el.addEventListener('change', handleChange) 
            } else {
                el.addEventListener('input', handleChange) // TODO: older IE (use timer?)
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
            var childD = domrender4.compile(cloned, d)
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
            if (domrender4.specialAttrs[attrName]) {
                continue;
            }
            var valueName = attr.value
            d.expressionsAndElements.push({expr: valueName, el: el, attr: attrName})
        }
    }
    var forEachValue = el.getAttribute("@foreach")
    if (forEachValue) {
        var forEachItemName = el.getAttribute("@forEachItemName")
        var forEachItemIndex = el.getAttribute("@foreachitemindex")
        var childEl = el.firstElementChild
        el.innerHTML = ""
        d.forEaches.push({scopeExpr: forEachValue, el: el, childEl: childEl, forEachItemName: forEachItemName, forEachItemIndex: forEachItemIndex, compileds: []})
    }
    for (var i = 0; i < el.children.length; i++) {
        domrender4.saveExpressions(d, el.children[i])
    }   
}
