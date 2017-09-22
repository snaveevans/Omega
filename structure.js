
var node = {
    $type: "", // {string} (required)
    $getComponents: function () {}, // {function} return string, node, array of nodes, called on local variable changes on node or higher node
    $init: function () {}, // {function} on rendered
    $destroy: function() {}, // {function} on removal
    $text: '', // {string} text replacement for returning text in $getComponents
    alphaNumeric: "element props", // string (support objects eventually)
    _localVariables:  "", // anything - listeners are placed on these
};

var test = {
    asdf23: "foobar"
};
