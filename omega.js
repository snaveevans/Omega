
// alpha    α   alt 224 -- data
// beta      ß   alt 225 -- components
// gamma Γ    alt 226 -- window queue
// omega Ω   alt 234 -- re-render function
// delta    δ    alt 235 -- dirty object

// generate node from blueprint
// wrapping prop's setters & getters in data object in element
// detect when changes occur
// update virtual dom & dom

// look into wrapping some functions to try and not "bind" every where

// attributes to automatically "subscribe"
// yes -- className, style, value, $text, href, src,  
// maybe -- action, method, type, name

var Omega = Ω = function ($root, $node) {
    var autoSubscribeProps = [ 'className', 'style', 'value', '$text', 'href', 'src', '$forceUpdate' ];

    var registeredTemplates = {};

    function registerTemplate($type, node) {
        registeredTemplates[$type] = node;
    }

    function getTemplate($type) {
        return registeredTemplates[$type];
    }

    function hasTemplate($type) {
        return getTemplate($type) !== undefined;
    }

    function mergeNodeWithTemplate($type, node) {
        var template = getTemplate($type);

        node.$type = template.$type;

        Object.keys(template).forEach(function(name) {
            var templateValue = template[name];
            var nodeValue = node[name];
            if(nodeValue !== undefined)
                return;
            
            if(typeof templateValue === 'function') {
                node[name] = templateValue.bind(node);
            } else {
                node[name] = JSON.parse(JSON.stringify(templateValue));
            }
        });

            return node;
    }

    function mergeNodeIfTemplate(node) {
        var $type = node.$type;
        if (isTemplateType($type) && hasTemplate($type)) {
            mergeNodeWithTemplate($type, node);
        }
        return node;
    }

    function createElement(node) {
        if (typeof node === 'string')
            return document.createTextNode(node);


        node.Ω = {
            props: {},
            components: [],
            dirty: {}
        }
        node.α = {}; // data
        node.ß = []; // components
        node.δ = {}; // dirty props

        var $type = node.$type;
        
        node = mergeNodeIfTemplate(node);

        var element = document.createElement(node.$type);

        node.Γ = function () {
            updateNode(this.element, this.node);
        }.bind({ node, element });

        setProps(element, node);
        addEventListeners(element, node);
        addPropListeners(node);

        var components = getComponents(node);

        components
            .map(createElement)
            .forEach(element.appendChild.bind(element));

        return element;
    }

    function executeInit(node) {
        var $init = node.$init;
        if (!$init || typeof $init !== 'function')
            return

        return $init.apply(node);
    }

    function getComponents(node) {
        var components = [];
        var $getComponents = node.$getComponents;
        var $text = node.$text;

        if ($getComponents === undefined || typeof $getComponents !== 'function') {
            if ($text !== undefined)
                components = [$text];
        } else {
            components = $getComponents.apply(node);
            if (Object.prototype.toString.call(components) !== "[object Array]")
                components = [components];
            components = components.map(mergeNodeIfTemplate);
        }

        node.ß = components;
        return components;
    }

    function getStoredComponents(node) {
        return node.ß;
    }

    function updateElement(parent, newNode, oldNode, refresh, index) {
        if (!refresh)
            refresh = false;
        if (!index)
            index = 0;
        if (oldNode === undefined) {
            parent.appendChild(
                createElement(newNode)
            );
            executeInit(newNode);
        } else if (newNode === undefined) {
            parent.removeChild(
                parent.childNodes[index]
            );
        } else if (hasChanged(newNode, oldNode)) {
            parent.replaceChild(
                createElement(newNode),
                parent.childNodes[index]
            );
            executeInit(newNode);
        } else if (newNode.$type) {
            reRender(parent.childNodes[index], refresh, newNode, oldNode, index);
        }
    }

    function updateNode(element, node) {
        var oldProps = node.δ;

        updateProps(element,
            node,
            oldProps
        );

        var previous = getStoredComponents(node) || [];
        var current = getComponents(node);

        var currentLength = current.length;
        var previousLength = previous.length;
        for (var i = 0; i < currentLength || i < previousLength; i++) {
            updateElement(
                element,
                current[i],
                previous[i],
                true,
                i
            );
        }
    }

    function reRender(element, refresh, newNode, oldNode, index) {
        updateProps(
            element,
            newNode,
            oldNode
        );

        var previous = getStoredComponents(oldNode) || [];
        var current = refresh === true ?
            getComponents(newNode) :
            getStoredComponents(newNode) || getComponents(newNode);

        var currentLength = current.length;
        var previousLength = previous.length;
        for (var i = 0; i < currentLength || i < previousLength; i++) {
            updateElement(
                element,
                current[i],
                previous[i],
                refresh,
                i
            );
        }
    }

    function hasChanged(node1, node2) {
        return typeof node1 !== typeof node2 ||
            typeof node1 === 'string' && node1 !== node2 ||
            node1.$type !== node2.$type ||
            node1.$forceUpdate === true;
    }

    function setProps($target, props) {
        Object.keys(props).forEach(function (name) {
            setProp($target, name, props[name]);
        })
    }

    function setProp($target, name, value) {
        if (!isElementProp(name))
            return;

        if (name === 'className') {
            $target.setAttribute('class', value);
        } else if (typeof value === 'boolean') {
            setBooleanProp($target, name, value);
        } else {
            $target.setAttribute(name, value);
        }
    }

    function setBooleanProp($target, name, value) {
        if (value) {
            $target.setAttribute(name, value);
            $target[name] = true;
        } else {
            $target[name] = false;
        }
    }

    function removeBooleanProp($target, name) {
        $target.removeAttribute(name);
        $target[name] = false;
    }

    function removeProp($target, name, value) {
        if (!isElementProp(name))
            return;

        if (name === 'className') {
            $target.removeAttribute('class');
        } else if (typeof value === 'boolean') {
            removeBooleanProp($target, name);
        } else {
            $target.removeAttribute(name);
        }
    }

    function isTemplateType($type) {
        return /^[A-Z]/.test($type)
    }

    function isElementProp(name) {
        return /^[a-z]/.test(name) && !isEventProp(name);
    }

    function isEventProp(name) {
        return /^on/.test(name);
    }

    function isVariableProp(name) {
        return name[0] === '_';
    }

    function isSystemProp(name) {
        return name[0] === '$';
    }

    function isOmegaProp(name) {
        return name === 'α' || name === 'ß' || name === 'Ω' || name === 'δ';
    }

    function isFunction(value) {
        return typeof value === 'function';
    }

    function updateProp($target, name, newVal, oldVal) {
        if (!newVal) {
            removeProp($target, name, oldVal);
        } else if (!oldVal || newVal !== oldVal) {
            setProp($target, name, newVal);
        }
    }

    function updateProps($target, newProps, oldProps) {
        if (!oldProps)
            oldProps = {};
        var props = Object.assign({}, newProps, oldProps);
        Object.keys(props).forEach(function (name) {
            if (!isElementProp(name))
                return;

            updateProp($target, name, newProps[name], oldProps[name]);
        })
    }

    function extractEventName(name) {
        return name.slice(2).toLowerCase();
    }

    function addEventListeners($target, node) {
        Object.keys(node).forEach(function (name) {
            if (isEventProp(name)) {
                $target.addEventListener(
                    extractEventName(name),
                    node[name]
                );
            }
        });
    }

    function getVariable(node, name) {
        var value = node.α[name];
        if (value !== undefined)
            return value;

        return node[name];
    }

    function setVariable(node, name, value) {
        node.α[name] = value;
    }

    function addPropListeners(node) {
        var keys = Object.keys(node);

        autoSubscribeProps.filter(function (name) {
            return !keys.includes(name);
        }).forEach(function (name) {
            node[name] = '';
            setVariable(node, name, '')
            addPropListener(node, name);
        })

        keys.forEach(function (name) {
            if ((isVariableProp(name) || isElementProp(name)) && !isFunction(node[name])) {
                setVariable(node, name, JSON.parse(JSON.stringify(node[name])))
                addPropListener(node, name);
            }
        });
    }

    function addPropListener(node, name) {
        Object.defineProperty(node, name, {
            get: function () {
                var value = getVariable(node, name);
                if (typeof value === 'object') {
                    snapshotVariable(node, name, value);
                    queueUpTest(node);
                }
                return value;
            },
            set: function (value) {
                if (JSON.stringify(node.α[name]) === JSON.stringify(value))
                    return;

                snapshotVariable(node, name, getVariable(node, name));
                setVariable(node, name, value);
                queueUpTest(node);
            }
        })
    }

    function snapshotVariable(node, name, value) {
        node.δ[name] = JSON.stringify(value);
    }

    function areAnyVariablesDifferent(node) {
        var keys = Object.keys(node);

        for(var name of keys) {
            var value = getVariable(node, name);
            if ((isVariableProp(name) || isElementProp(name)) && !isFunction(value) && isVariableDifferent(node, name, value))
                return true;
        }

        return false;
    }

    function isVariableDifferent(node, name, value) {
        var storedValue = node.δ[name];
        var currentValue = JSON.stringify(value);
        return storedValue !== currentValue;
    }

    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    var updateQueue = [];
    var tick = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (cb) { return window.setTimeout(cb, 1000 / 60); };

    function getQueue() {
        return updateQueue;
    }

    function addToQueue(node) {
        if (updateQueue.indexOf(node) >= 0)
            return;

        updateQueue.push(node);
    }

    function clearQueue() {
        updateQueue = [];
    }

    function queueUpTest(node) {
        addToQueue(node);

        tick.call(window, function () {
            getQueue().forEach(function (testNode) {
                if (!areAnyVariablesDifferent(testNode))
                    return;
                testNode.Γ.call();
            })

            clearQueue();
        })
    }

    if ($root && $node)
        updateElement($root, $node);

    return {
        createNode: function ($type, $text_or_$getComponents, props) {
            var node = {
                $type,
                ...props
            };

            if (typeof $text_or_$getComponents === 'string') {
                node.$text = $text_or_$getComponents;
            } else if (typeof $text_or_$getComponents === 'function') {
                node.$getComponents = $text_or_$getComponents;
            }

            return node;
        }, 
        updateElement,
        registerTemplate
    };
}
