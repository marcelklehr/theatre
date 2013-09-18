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

types.Identifier = function (mem, str) {
  this.memory = mem
  this.val = str
}
types.Identifier.prototype.dump = function() {
  return "'"+this.val
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
  return "'"+this.val+"'"
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

types.Error = function(msg, pos, stack, jsError) {
  this.message = msg
  this.loc = pos
  this.stack = stack
  this.jsError = jsError
}

function Memory() {
  this.heap = {length: 1}
}
module.exports.Memory = Memory
Memory.prototype.put = function(val) {
  this.heap[this.heap.length] = val
  return this.heap.length++
}
Memory.prototype.get = function(addr) {
  return this.heap[addr]
}


function Context() {
  this.memory = new Memory
  this.memory.heap[0] = new types.List(this.memory, 0, 0)
  
  this.names = {
    nil: 0
  }
  
  this.actors = {
    '+': function(args) {
      var sum = 0
        , val
      
      for(var i=0; i<args.length; i++) {
        val = this.memory.get(args[i])
        if(!(val instanceof types.Integer)/* && !(val instanceof types.Float)*/) throw new Error('Actor "+" expects its arguments to be of type Integer or Float')
        sum += val.val
      }
      
      return this.memory.put(new types.Integer(this.memory, sum))
    }
  , 'print': function(args) {
      var operand
      for(var i=0; i<args.length; i++) {
        operand = this.memory.get(args[i])
        if('undefined' == typeof operand.val) throw new Error('Actor "print" expects only atoms')
        if(i>0) this.appendOutput(' ')
        this.appendOutput(operand.val)
      }
      this.appendOutput('\n')
    }
  , 'let': function(args) {
      
      var ident = this.memory.get(args[0])
      if(!(ident instanceof types.Identifier)) throw new Error('Actor "let" requires a name as the first argument')
      var name = ident.val
      
      names[name] = args[1]
    }
  , 'list': function(args) {
      var list = 0
        , item
      
      for(var i=args.length-1; i>=0; i--) {
        item = args[i]
        list = this.memory.put(new types.List(this.memory, item, list))
      }
      
      return list
    }
  }
}
module.exports.Context = Context

Context.prototype.bindName = function(name, addr) {
  this.names[name] = addr
}

Context.prototype.resolveName = function(name) {
  if(!this.names[name]) throw new Error('Can\'t resolve name "'+name+'"')
  return this.names[name]
}

//Execute an ast node
//returns an addr
Context.prototype.execute = function(node, stack) {
  try {
    switch(node.node) {
      case 'IDENTIFIER':
        return this.resolveName(node.value)

      case 'INTEGER':
        return this.memory.put(new types.Integer(this.memory, node.value))

      case 'FLOAT':
        return this.memory.put(new types.Float(this.memory, node.value))
      
      case 'STRING':
        return this.memory.put(new types.String(this.memory, node.value))
      
      case 'LIST':
        if(!node.children.length) return this.throw(new types.Error('Empty expression', node.loc, stack))
        
        var ident = node.children[0].value
          , fn = this.actors[ident]
        
        if(!fn) return this.throw(new types.Error('Unknown actor "'+ident+'"', node.loc, stack))
        return fn.call(this, node.children.slice(1).map(function(node) {
          return this.execute(node, stack)
        }.bind(this))) || 0
    }
  }catch(e) {
    return this.throw(new types.Error(e.message, node.loc, stack, e))
  }
  
  console.log(node)
  throw new Error('Unrecognized node in ast tree')
}

Context.prototype.throw = function(er) {
  this.uncaughtException(er)
}

Context.prototype.appendOutput = function(str) {
  if(this.ancestor) this.ancestor.appendOutput(str)
}