//      v2.0
// bind functions to their node
// only send props that have changed to update props
// separate concerns
//      templates
//      data
//      rendering

var Omega = Ω = function ($root, $node, $templates) {
    var Omega = {
        initialize: function (node) {
            node.Ω = {
                props: {},
                components: [],
                dirty: {}
            }
        },
        isNull: function (node) {
            return node.Ω === undefined;
        },
        dirty: {
            get: function (node) {
                if (Omega.isNull(node))
                    return undefined;
                return node.Ω.dirty;
            },
            set: function (node, value) {
                node.Ω.dirty = value;
            }
        },
        components: {
            get: function (node) {
                if (Omega.isNull(node))
                    return undefined;
                return node.Ω.components;
            },
            set: function (node, value) {
                if (Omega.isNull(node))
                    Omega.initialize(node);
                node.Ω.components = value;
            }
        },
        props: {
            get: function (node) {
                if (Omega.isNull(node))
                    Omega.initialize(node);
                return node.Ω.props;
            }
        },
        update: {
            call: function (node) {
                return node.Ω.update.call();
            },
            build: function (node, element) {
                node.Ω.update = function () {
                    Node.update(this.element, this.node);
                }.bind({ node, element });
            }
        }
    };

    var Props = {
        autoSubscribe: ['className', 'style', 'value', '$text', 'href', 'src', '$forceUpdate'],
        addListeners: function (node) {
            var keys = Object.keys(node);

            Props.autoSubscribe.filter(function (name) {
                return !keys.includes(name);
            }).forEach(function (name) {
                node[name] = '';
                Props.set(node, name, '')
                Props.addListener(node, name);
            })

            keys.forEach(function (name) {
                if ((Is.variableProp(name) || Is.elementProp(name)) && !Is.function(node[name])) {
                    var clone = Data.copy(node[name]);
                    Props.set(node, name, clone);
                    Props.addListener(node, name);
                }
            });
        },
        addListener: function (node, name) {
            Object.defineProperty(node, name, {
                get: function () {
                    var value = Props.get(node, name);
                    if (typeof value === 'object') {
                        Props.snapshot(node, name, value);
                        Queue.add(node);
                    }
                    return value;
                },
                set: function (value) {
                    if (JSON.stringify(Props.get(node, name, true)) === JSON.stringify(value))
                        return;

                    Props.snapshot(node, name, Props.get(node, name));
                    Props.set(node, name, value);
                    Queue.add(node);
                }
            })
        },
        get: function (node, name, omegaOnly) {
            var props = Omega.props.get(node);
            var value = props[name];
            if (value !== undefined || omegaOnly === true)
                return value;

            return node[name];
        },
        set: function (node, name, value) {
            var props = Omega.props.get(node);
            props[name] = value;
        },
        snapshot: function (node, name, value) {
            var dirty = Omega.dirty.get(node);
            dirty[name] = JSON.stringify(value);
        },
        isDifferent: function (node, name, value) {
            var dirty = Omega.dirty.get(node);
            var storedValue = dirty[name];
            var currentValue = JSON.stringify(value);
            return storedValue !== currentValue;
        }
    };

    var Node = {
        update: function (element, node) {
            var dirtyProps = Omega.dirty.get(node);

            Element.updateProps(
                element,
                node,
                dirtyProps,
                true
            );

            var previous = Omega.components.get(node);
            var updated = Node.getComponents(node);

            var current = Element.updateChildren(element, updated, previous);
            Omega.components.set(node, current);
        },
        getComponents: function (node) {
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
                components = components.map(function (component) {
                    if (Is.templateType(component.$type) && Templates.doesExist(component.$type)) {
                        // if node inherits a template, build the template into the node
                        return Templates.build(component);
                    }
                    return component;
                });
            }

            return components;
        },
        hasChanged: function (node) {
            var dirtyKeys = Object.keys(node.Ω.dirty);

            for (var name of dirtyKeys) {
                var value = Props.get(node, name);
                if ((Is.variableProp(name) || Is.elementProp(name)) && !Is.function(value) && Props.isDifferent(node, name, value))
                    return true;
            }

            return false;
        },
        areDifferent: function (node1, node2) {
            return typeof node1 !== typeof node2 ||
                typeof node1 === 'string' && node1 !== node2 ||
                node1.$type !== node2.$type ||
                node1.$forceUpdate === true;
        },
        executeInit: function (node, element) {
            var $init = node.$init;
            if (!$init || typeof $init !== 'function')
                return

            return $init.apply(node, [element]);
        }
    }

    var Element = {
        create: function (node) {
            if (typeof node === 'string') {
                // if the node is string, return a text element 
                return document.createTextNode(node);
            }

            // initialize omega props
            Omega.initialize(node);

            if (Is.templateType(node.$type) && Templates.doesExist(node.$type)) {
                // if node inherits a template, build the template into the node
                node = Templates.build(node);
            }

            // build element
            var element = document.createElement(node.$type);

            // build update function
            Omega.update.build(node, element);
            // set props to element
            Element.setProps(element, node);
            // set event listeners
            Element.addEventListeners(element, node);
            // set prop listeners
            Props.addListeners(node);

            // add components/children
            var components = Node.getComponents(node);

            components
                .map(Element.create)
                .forEach(element.appendChild.bind(element));

            Omega.components.set(node, components);

            Node.executeInit(node);
            return element;
        },
        update: function (parent, newNode, oldNode, index) {
            var result = newNode;
            if (oldNode === undefined) { // new node, create element
                parent.appendChild(
                    Element.create(newNode)
                );
            } else if (newNode === undefined) { // no node, remove element
                parent.removeChild(
                    parent.childNodes[index]
                );
            } else if (Node.areDifferent(newNode, oldNode)) { // node is different, remove element and create new
                parent.replaceChild(
                    Element.create(newNode),
                    parent.childNodes[index]
                );
            } else if (newNode.$type) { // sill a node, traverse children for more changes
                // result = oldNode;
                var element = parent.childNodes[index];
                // check for prop changes on the element
                Element.updateProps(
                    element,
                    newNode,
                    oldNode
                );

                var previous = Omega.components.get(oldNode) || [];
                var updated = Node.getComponents(oldNode);

                var current = Element.updateChildren(element, updated, previous);
                Omega.components.set(result, current);                
            }
            return result;
        },
        updateChildren: function(parentElement, updated, previous) {
            var current = [];

            var updatedLength = updated.length;
            var previousLength = previous.length;
            for (var i = 0; i < updatedLength || i < previousLength; i++) {
                var node = Element.update(
                    parentElement,
                    updated[i],
                    previous[i],
                    i
                );
                if (node) {
                    current.push(node);
                }
            }

            return current;
        },
        setProps: function (element, node) {
            Object.keys(node).forEach(function (name) {
                Element.setProp(element, name, node[name]);
            })
        },
        setProp: function (element, name, value) {
            if (!Is.elementProp(name))
                return;

            if (name === 'className') {
                element.setAttribute('class', value);
            } else if (typeof value === 'boolean') {
                Element.setBooleanProp(element, name, value);
            } else {
                element.setAttribute(name, value);
            }
        },
        removeProp: function (element, name, value) {
            if (!Is.elementProp(name))
                return;

            if (name === 'className') {
                element.removeAttribute('class');
            } else if (typeof value === 'boolean') {
                Element.removeBooleanProp(element, name);
            } else {
                element.removeAttribute(name);
            }
        },
        setBooleanProp: function (element, name, value) {
            if (value) {
                element.setAttribute(name, value);
                element[name] = true;
            } else {
                element[name] = false;
            }
        },
        removeBooleanProp: function (element, name) {
            element.removeAttribute(name);
            element[name] = false;
        },
        updateProps: function (element, newProps, oldProps, isStringified) {
            if (!oldProps)
                oldProps = {};
            var props = Object.assign({}, newProps, oldProps);
            Object.keys(props).forEach(function (name) {
                if (!Is.elementProp(name))
                    return;

                Element.updateProp(element, name, newProps[name], oldProps[name], isStringified);
            })
        },
        updateProp: function (element, name, newVal, oldVal, isStringified) {
            if (!newVal) {
                Element.removeProp(element, name, oldVal);
                return;
            }
            if (isStringified === true && JSON.stringify(newVal) === oldVal) {
                return;
            }
            if (!oldVal || newVal !== oldVal) {
                Element.setProp(element, name, newVal);
            }
        },
        extractEventName: function (name) {
            return name.slice(2).toLowerCase();
        },
        addEventListeners: function (element, node) {
            Object.keys(node).forEach(function (name) {
                if (Is.eventProp(name)) {
                    element.addEventListener(
                        Element.extractEventName(name),
                        node[name]
                    );
                }
            });
        },
        inject: function (root, node) {
            root.appendChild(
                Element.create(node)
            );
        },
        hasChanged: function (node1, node2) {
            return typeof node1 !== typeof node2 ||
                typeof node1 === 'string' && node1 !== node2 ||
                node1.$type !== node2.$type ||
                node1.$forceUpdate === true;
        }
    };

    var Is = {
        elementProp: function (name) {
            return /^[a-z]/.test(name) && !Is.eventProp(name);
        },
        eventProp: function (name) {
            return /^on/.test(name);
        },
        templateType: function ($type) {
            return /^[A-Z]/.test($type)
        },
        variableProp: function (name) {
            return name[0] === '_';
        },
        systemProp: function (name) {
            return name[0] === '$';
        },
        omegaProp: function (name) {
            return name === 'Ω';
        },
        function: function (value) {
            return typeof value === 'function';
        }
    }

    var Templates = {
        registeredTemplates: {},
        register: function (name, template) {
            Templates.registeredTemplates[name] = template;
        },
        get: function (name) {
            return Templates.registeredTemplates[name];
        },
        doesExist: function (name) {
            return Templates.get(name) !== undefined;
        },
        build: function (node) {
            var template = Templates.get(node.$type);

            node.$type = template.$type;

            Object.keys(template).forEach(function (key) {
                var templateValue = template[key];
                var nodeValue = node[key];
                if (nodeValue !== undefined)
                    return;

                if (typeof templateValue === 'function') {
                    node[key] = templateValue.bind(node);
                } else {
                    node[key] = Data.copy(templateValue);
                }
            });

            return node;
        }
    };

    var Queue = {
        nodes: [],
        tick: window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (cb) { return window.setTimeout(cb, 1000 / 60); },
        add: function (node) {
            if (Queue.nodes.indexOf(node) >= 0)
                return;

            Queue.nodes.push(node);

            Queue.tick.call(window, function () {
                Queue.nodes.forEach(function (testNode) {
                    if (!Node.hasChanged(testNode))
                        return;
                    Omega.update.call(testNode)
                });

                Queue.clear();
            });
        },
        clear: function () {
            Queue.nodes = [];
        }
    }

    var Data = {
        copy: function (value) {
            if (typeof value === 'object') {
                return Data.clone(value);
            } else {
                return value;
            }
        },
        clone: function (o) {
            var out, v, key;
            out = Array.isArray(o) ? [] : {};
            for (key in o) {
                v = o[key];

                if (typeof v === 'object') {
                    out[key] = copy(v)
                } else if (typeof v === 'function') {
                    out[key] = v.bind(out);
                } else {
                    out[key] = v;
                }
            }
            return out;
        }
    }

    if ($templates) {
        Object.keys($templates).forEach(function (name) {
            Templates.register(name, $templates[name]);
        });
    }

    if ($root && $node)
        Element.inject($root, $node);
}