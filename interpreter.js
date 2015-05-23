var parse = require('./parser')

module.exports = function(input, ctx) {
  try {
    var parseTree = parse(input)
      , res
    
    for(var i=0, l=parseTree.length; i<l; i++) {
      res = ctx.execute(parseTree[i])
    }
    
    return res
  }catch(e) {
    ctx.parseError(e)
  }
}

var types = {}
module.exports.types = types

types.Symbol = function (mem, str) {
  this.memory = mem
  this.val = str
}
types.Symbol.prototype.dump = function() {
  return '\''+this.val
}

types.Integer = function (mem, val) {
  this.memory = mem
  this.val = val
}
types.Integer.prototype.dump = function() {
  return this.val+''
}

types.Float = function (mem, val) {
  this.memory = mem
  this.val = val
}
types.Float.prototype.dump = function() {
  return this.val+''
}

types.String = function (mem, val) {
  this.memory = mem
  this.val = val
}
types.String.prototype.dump = function() {
  return '"'+this.val+'"'
}

types.List = function (mem, headPtr, tailPtr) {
  this.memory = mem
  this.head = headPtr
  this.tail = tailPtr
}
types.List.prototype.dump = function(recurse) {
  if(!this.head) return '()'
  var d = this.memory.get(this.head).dump(true)+(this.tail? ' '+this.memory.get(this.tail).dump(true) : '')
  if(!recurse) d = '( '+d+' )'
  return d
}

types.Actor = function(mem, ctx, nodes) {
  this.context = ctx
  this.memory = mem
  this.nodes = nodes
}
types.Actor.prototype.receive = function(msgPtr) {

}

types.NativeActor = function(mem, parentCtx, fn) {
  this.memory = mem
  this.parentContext = parentCtx
  this.actor = fn
}
types.NativeActor.prototype.receive = function(msgPtr, caller) {
  var ctx = new Context(this.parentContext, caller)
  return this.actor(ctx, msgPtr)
}

types.Error = function(msg, pos, stack, jsError) {
  this.message = msg
  this.loc = pos
  this.stack = stack
  this.jsError = jsError
}

function Memory() {
  this.heap = {length: 1}
  this.symbols = {}
}
module.exports.Memory = Memory
Memory.prototype.put = function(val) {
  this.heap[this.heap.length] = val
  return this.heap.length++
}
Memory.prototype.get = function(addr) {
  return this.heap[addr]
}


function Context(ancestor, caller) {
  this.ancestor = ancestor
  this.caller = caller
  
  this.names = {}
  
  this.memory = ancestor? ancestor.memory : new Memory
  if(!ancestor) this.memory.heap[0] = new types.List(this.memory, 0, 0)
}
module.exports.Context = Context

Context.prototype.bindName = function(name, addr) {
  this.names[name] = addr
}

Context.prototype.resolveName = function(name) {
  if(!this.names[name]) throw new Error('Can\'t resolve name "'+name+'"')
  return this.names[name]
}

Context.prototype.callActor = function(name, msg, caller) {
  var actor = this.memory.get(this.resolveName(name))
  if(!actor) throw new Error('Unknown actor "'+name+'"')
  if(!(actor instanceof types.NativeActor) && !(actor instanceof types.Actor)) throw new Error('Identified value is not an actor: "'+name+'"')
  return actor.receive(msg, caller) || 0
}

Context.prototype.typeFactory = function (type/*, ...*/) {
  if(type == 'Symbol' && this.memory.symbols[arguments[1]]) return this.memory.get(this.memory.symbols[arguments[1]])
  var obj = new types[type]
  types[type].apply(obj, [this.memory].concat(Array.prototype.slice.call(arguments, 1)))
  
  return this.memory.put(obj)
}

Context.prototype.getStack = function() {
  if(!this.caller) return []
  return [this.caller].concat(this.caller.getStack())
}

//Execute an ast node
//returns an addr
Context.prototype.execute = function(node, enableThrow) {
  try {
    switch(node.node) {
      case 'IDENTIFIER':
        if(node.quoted) return this.typeFactory('Symbol', node.value)
        else return this.resolveName(node.value)

      case 'INTEGER':
        return this.typeFactory('Integer', node.value)

      case 'FLOAT':
        return this.typeFactory('Float', node.value)
      
      case 'STRING':
        return this.typeFactory('String', node.value)
      
      case 'LIST':
        var listPtr = 0
        , itemPtr
      
        for(var i=node.children.length-1; i>=0; i--) {
          itemPtr = this.execute(node.children[i], true)
          listPtr = this.typeFactory('List', itemPtr, listPtr)
        }
        
        // ACTOR CALL
        if(node.children[0].node=='IDENTIFIER' && !node.quoted) { // What about returning an actor?
          var args = this.memory.get(listPtr).tail
          return this.callActor(node.children[0].value, args, /*caller:*/{ctx: this, node: node})
        }
        
        return listPtr
    }
  }catch(e) {
    if(enableThrow) throw(new types.Error(e.message, node.loc, this.getStack(), e))
    if(e.jsError) return this.throw(e)
    else return this.throw(new types.Error(e.message, node.loc, this.getStack(), e))
  }
  
  throw new Error('Unrecognized node in ast tree '+JSON.stringify(node))
}

Context.prototype.throw = function(er) {
  this.uncaughtException(er)
}