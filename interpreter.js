var parse = require('./parser')
  , DEBUG = false

module.exports = function(input, ctx, filename) {
  try {
    var parseTree = parse(input, filename)
    if(DEBUG) console.log(JSON.stringify(parseTree, null, '\t'))
    return Continuation.run(ctx, parseTree)
  }catch(e) {
    ctx.parseError(e)
  }
}

var types = {}
module.exports.types = types

types.Symbol = function (mem, str) {
  this.type = 'Symbol'
  this.memory = mem
  this.val = str
}
types.Symbol.prototype.dump = function() {
  return ''+this.val
}

types.Integer = function (mem, val) {
  this.type = 'Integer'
  this.memory = mem
  this.val = val
}
types.Integer.prototype.dump = function() {
  return this.val+''
}

types.Float = function (mem, val) {
  this.type = 'Float'
  this.memory = mem
  this.val = val
}
types.Float.prototype.dump = function() {
  return this.val+''
}

types.String = function (mem, val) {
  this.type = 'String'
  this.memory = mem
  this.val = val
}
types.String.prototype.dump = function() {
  return '"'+this.val+'"'
}

types.Boolean = function (mem, val) {
  this.type = 'Boolean'
  this.memory = mem
  this.val = val
}
types.Boolean.prototype.dump = function() {
  return this.val+''
}

types.List = function (mem, headPtr, tailPtr) {
  this.type = 'List'
  this.memory = mem
  this.head = headPtr
  this.tail = tailPtr
}
types.List.prototype.dump = function(recurse) {
  if(!this.head && !this.tail) return '()'
  var d = this.memory.get(this.head).dump()+(this.tail? ' '+this.memory.get(this.tail).dump(true) : '')
  if(!recurse) d = '( '+d+' )'
  return d
}

types.Macro = function(mem, parentCtx, args, nodes) {
  this.type = 'Macro'
  this.parentContext = parentCtx
  this.memory = mem
  this.args = args
  this.nodes = nodes
}
types.Macro.prototype.receive = function(msgPtr, caller) {
  var ctx = new Context(this.parentContext, caller)
    , list = this.memory.get(msgPtr)

  // Get actor arguments
  var args = []
  while(list.head) {
    args.push(list.head)
    list = this.memory.get(list.tail)
  }

  // Check arity
  if(args.length != this.args.length) {
    throw new Error('Expected '+this.args.length+' arguments, but got '+args.length)
  }

  args.forEach(function(ptr, i) {
    ctx.bindName(this.args[i], ptr)
  }.bind(this))

  return Continuation.run(ctx, this.nodes, /*enableThrow:*/true)
}
types.Macro.prototype.dump = function() {
  return '<macro>'
}

types.Actor = function(mem, parentCtx, args, nodes) {
  this.type = 'Actor'
  this.parentContext = parentCtx
  this.memory = mem
  this.args = args
  this.nodes = nodes
}
types.Actor.prototype.receive = function(msgPtr, caller) {
  var ctx = new Context(this.parentContext, caller)
    , list = this.memory.get(msgPtr)

  // Get actor arguments
  var args = []
  while(list.head) {
    args.push(list.head)
    list = this.memory.get(list.tail)
  }

  // Check arity
  if(args.length != this.args.length) {
    throw new Error('Expected '+this.args.length+' arguments, but got '+args.length)
  }

  args.forEach(function(ptr, i) {
    ctx.bindName(this.args[i], ptr)
  }.bind(this))

  return Continuation.run(ctx, this.nodes, /*enableThrow:*/true)
}
types.Actor.prototype.dump = function() {
  return '<anonymous actor>'
}

types.NativeActor = function(mem, parentCtx, fn) {
  this.type = 'NativeActor'
  this.memory = mem
  this.parentContext = parentCtx
  this.actor = fn
}
types.NativeActor.prototype = Object.create(types.Actor.prototype, {
  constructor: {
    value: types.NativeActor,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
types.NativeActor.prototype.receive = function(msgPtr, caller) {
  var ctx = new Context(this.parentContext, caller, /*native:*/true)

  try {
    var ret = this.actor(ctx, msgPtr)
  }catch(e) {
      throw(new types.Error(e.message, null, ctx.getStack(), e))
  }
  return ret
}
types.NativeActor.prototype.dump = function() {
  return '<native actor>'
}

types.Error = function(msg, pos, stack, jsError) {
  this.message = msg
  this.loc = pos
  this.stack = stack
  this.jsError = jsError
}


function Continuation(ctx, nodes, index) {
  this.ctx = ctx
  this.nodes = nodes
  this.index = index
}
Continuation.prototype.dump = function() {
  return '<continuation:'+this.nodes[this.index].loc+'>'
}
Continuation.prototype.play = function(enableThrow) {
  return Continuation.run(this.ctx, this.nodes.slice(this.index+1), enableThrow)
}
Continuation.run = function(ctx, nodes, enableThrow) {
  var ret
  for(var i=0; i<nodes.length; i++) {
    ret = ctx.execute(nodes[i], enableThrow, new Continuation(ctx, nodes, i))
    if(ret == -1) break
  }
  return ret
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


function Context(ancestor, caller, native) {
  this.ancestor = ancestor || null
  this.caller = caller || null
  this.native = native ||false

  this.names = {}

  this.memory = ancestor? ancestor.memory : new Memory
  if(!ancestor) this.memory.heap[0] = new types.List(this.memory, 0, 0)
}
module.exports.Context = Context

Context.prototype.bindName = function(name, addr, recurse) {
  if(!this.names[name]) {
    if(this.ancestor && this.ancestor.bindName(name, addr, true)) return true
    if(recurse === true) return false
  }
  this.names[name] = addr
  return true
}

Context.prototype.resolveName = function(name) {
  if(!this.names[name]) {
    if(this.ancestor && this.ancestor.resolveName(name)) {
      return this.ancestor.resolveName(name)
    }else throw new Error('Can\'t resolve name "'+name+'"')
  }
  return this.names[name]
}

Context.prototype.callActor = function(ptr, msgPtr, caller) {
  var actor = this.memory.get(ptr)
  if(!actor) throw new Error('Actor is not defined')
  if(!(actor instanceof types.Actor)) throw new Error('Value is not an actor')
  return actor.receive(msgPtr, caller) || 0
}

Context.prototype.typeFactory = function (type/*, ...*/) {
  if(type == 'Symbol' && this.memory.symbols[arguments[1]]) return this.memory.get(this.memory.symbols[arguments[1]])
  var obj = new types[type]
  types[type].apply(obj, [this.memory].concat(Array.prototype.slice.call(arguments, 1)))

  return this.memory.put(obj)
}

Context.prototype.getStack = function() {
  if(!this.caller) return []
  return [this.caller].concat(this.caller.ctx.getStack())
}

Context.prototype.quote = function(node) {
  try {
    switch(node.node) {
      case 'QUOTE':
        return this.typeFactory('List', this.typeFactory('Symbol', 'quote'), this.quote(node.children[0]))

      case 'QUASIQUOTE':
        return this.typeFactory('List', this.typeFactory('Symbol', 'quasiquote'), this.quote(node.children[0]))

      case 'QUASIQUOTE_INTERP':
        return this.typeFactory('List', this.typeFactory('Symbol', 'unquote'), this.quote(node.children[0]))

      case 'IDENTIFIER':
        if(node.value == 'true') return this.typeFactory('Boolean', true)
        if(node.value == 'false') return this.typeFactory('Boolean', false)
        if(node.value == 'nil') return 0
        return this.typeFactory('Symbol', node.value)

      case 'INTEGER':
        return this.typeFactory('Integer', node.value)

      case 'FLOAT':
        return this.typeFactory('Float', node.value)

      case 'STRING':
        return this.typeFactory('String', node.value)

      case 'LIST':
        // QUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quote') {
          return this.typeFactory('List', this.typeFactory('Symbol', 'quote'), this.quote(node.children[1]))
        }else
        // QUASIQUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quasiquote') {
          return this.typeFactory('List', this.typeFactory('Symbol', 'quasiquote'), this.quote(node.children[1]))
        }else
        // UNQUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'unquote') {
          return this.typeFactory('List', this.typeFactory('Symbol', 'unquote'), this.quote(node.children[1]))
        }

        var listPtr = 0
        , itemPtr

        for(var i=node.children.length-1; i>=0; i--) {
          itemPtr = this.quote(node.children[i], true)
          listPtr = this.typeFactory('List', itemPtr, listPtr)
        }

        return listPtr
    }
  }catch(e) {
    if(e.jsError) throw(e)
    else throw(new types.Error(e.message, node.loc, this.getStack(), e))
  }

  throw new Error('Unrecognized node in ast tree at '+node.loc+': '+JSON.stringify(node))
}


Context.prototype.quasiquote = function(node, continuation) {
  try {
    switch(node.node) {
      case 'QUOTE':
        return this.typeFactory('List', this.typeFactory('Symbol', 'quote'), this.quasiquote(node.children[0], continuation))

      case 'QUASIQUOTE':
        return this.typeFactory('List', this.typeFactory('Symbol', 'quasiquote'), this.quote(node.children[0]))

      case 'QUASIQUOTE_INTERP':
        return this.execute(node.children[0], true, continuation)

      case 'IDENTIFIER':
        if(node.value == 'true') return this.typeFactory('Boolean', true)
        if(node.value == 'false') return this.typeFactory('Boolean', false)
        if(node.value == 'nil') return 0
        return this.typeFactory('Symbol', node.value)

      case 'INTEGER':
        return this.typeFactory('Integer', node.value)

      case 'FLOAT':
        return this.typeFactory('Float', node.value)

      case 'STRING':
        return this.typeFactory('String', node.value)

      case 'LIST':
        // QUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quote') {
          return this.typeFactory('List', this.typeFactory('Symbol', 'quote'), this.quasiquote(node.children[1], continuation))
        }else
        // QUASIQUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quasiquote') {
          return this.typeFactory('List', this.typeFactory('Symbol', 'quasiquote'), this.quote(node.children[1]))
        }else
        // UNQUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'unquote') {
          return this.execute(node.children[1], true, continuation)
        }
        
        var listPtr = 0
        , itemPtr

        for(var i=node.children.length-1; i>=0; i--) {
          itemPtr = this.quasiquote(node.children[i], true)
          listPtr = this.typeFactory('List', itemPtr, listPtr)
        }

        return listPtr
    }
  }catch(e) {
    if(e.jsError) throw(e)
    throw(new types.Error(e.message, node.loc, this.getStack(), e))
  }

  throw new Error('Unrecognized node in ast tree at '+node.loc+': '+JSON.stringify(node))
}

//Evaluate an ast node
//returns an addr
Context.prototype.execute = function(node, enableThrow, continuation) {
  try {
    switch(node.node) {
      case 'QUOTE':
        return this.quote(node.children[0])

      case 'QUASIQUOTE':
        return this.quasiquote(node.children[0], continuation)

      case 'QUASIQUOTE_INTERP':
        throw new Error('Cannot interpolate when not in quasiquoting context')

      case 'IDENTIFIER':
        if(node.value == 'true') return this.typeFactory('Boolean', true)
        if(node.value == 'false') return this.typeFactory('Boolean', false)
        if(node.value == 'nil') return 0
        return this.resolveName(node.value)

      case 'INTEGER':
        return this.typeFactory('Integer', node.value)

      case 'FLOAT':
        return this.typeFactory('Float', node.value)

      case 'STRING':
        return this.typeFactory('String', node.value)

      case 'LIST':

        // QUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quote') {
          return this.quote(node.children[1])
        }else
        // QUASIQUOTE
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'quasiquote') {
          return this.quasiquote(node.children[1])
        }else
        // LIST
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'list') {
          var listPtr = 0
          , itemPtr

          for(var i=node.children.length-1; i>0; i--) {
            itemPtr = this.execute(node.children[i], true)
            listPtr = this.typeFactory('List', itemPtr, listPtr)
          }
          return listPtr
        } else
        // LAMBDA
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'lambda') {
          var args = []
          if(node.children[1]) {
            args = node.children[1].children.map(function(n) {
              if(n.node != 'IDENTIFIER') throw new new types.Error('Arguments to lambda definition mst be identifiers', n.loc, this.getStack(), 1)
              return n.value
            }.bind(this))
          }else throw new Error('Lambda expression must have a list of arguments')

          var actor = this.typeFactory('Actor', this, args, node.children.slice(2))
          return actor
        } else
        // defmacro
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'defmacro') {
          if(!node.children[3]) throw new Error('Argument missing. "defmacro" expects 3 arguments')
          
          var identifier = node.children[1].value
          if(!identifier) throw new types.Error('"defmacro" expects first argument to be of type Symbol', node.children[1].loc, this.getStack(), 1)
          
          var args = []
          if(node.children[2] && node.children[2].children) {
            args = node.children[2].children.map(function(n) {
              if(n.node != 'IDENTIFIER') throw new types.Error('Parameters of macro definition mst be identifiers', n.loc, this.getStack(), 1)
              return n.value
            }.bind(this))
          }else throw new Error('defmacro expects a list of paramters')

          var macro = this.typeFactory('Macro', this, args, node.children.slice(3))
          this.bindName(identifier, macro)
          return macro
        } else
        // CALLCC
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'callcc') {
          if(!node.children[1]) throw new Error('Argument missing. "callcc" expects 1 argument')
          var actor = this.execute(node.children[1])
          if(!(this.memory.get(actor) instanceof types.Actor)) throw new Error('Argument to "callcc" must be an actor')
          var args = this.typeFactory('List', this.memory.put(continuation), 0)
          this.callActor(actor, args, {ctx: this, node: node})
          return 0 // stops execution of current continuation
        } else
        // IF
        if(node.children[0] && node.children[0].node =='IDENTIFIER' && node.children[0].value == 'if') {
          if(!node.children[1] || !node.children[2] || !node.children[3]) throw new Error('Argument(s) missing. "if" expects 3 arguments')
          var cond = this.memory.get(this.execute(node.children[1]))

          if(cond.type !== 'Boolean') throw new Error('First argument to "if" must be of type Boolean')

          if(cond.val) {
            return this.execute(node.children[2], true)
          }else {
            return this.execute(node.children[3], true)
          }
        } else
        // ACTOR CALL
        if(node.children[0]) {
          var listPtr = 0
          , itemPtr = this.execute(node.children[0], true)
          
          // Macro call
          var macro
          if((macro = this.memory.get(itemPtr)) instanceof types.Macro) {
            for(var i=node.children.length-1; i>=0; i--) {
              itemPtr = this.quote(node.children[i], true)
              listPtr = this.typeFactory('List', itemPtr, listPtr)
            }
          
            var args = this.memory.get(listPtr).tail
            var expandedPtr = macro.receive(args, /*caller:*/{ctx: this, node: node})
            var expanded = this.memory.get(expandedPtr).dump()
            var tree = parse(expanded, node.loc+'>expanded')
            return Continuation.run(this, tree, true)
          }

          for(var i=node.children.length-1; i>=0; i--) {
            itemPtr = this.execute(node.children[i], true, new Continuation(this, node.children, i))
            if(itemPtr == -1) return -1
            listPtr = this.typeFactory('List', itemPtr, listPtr)
          }

          var args = this.memory.get(listPtr).tail

          // Continuation call
          var cont
          if((cont = this.memory.get(itemPtr)) instanceof Continuation) {
            return cont.play(true)
          }

          return this.callActor(itemPtr, args, /*caller:*/{ctx: this, node: node})
        }
    }
  }catch(e) {
    if(enableThrow && !e.jsError) throw(new types.Error(e.message, node.loc, this.getStack(), e))
    if(enableThrow && e.jsError) throw(e)
    if(e.jsError) return this.throw(e)
    else return this.throw(new types.Error(e.message, node.loc, this.getStack(), e))
  }

  throw new Error('Unrecognized node in ast tree at '+node.loc+': '+JSON.stringify(node))
}

Context.prototype.throw = function(er) {
  this.uncaughtException(er)
}
