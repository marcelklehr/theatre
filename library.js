var interpreter = require('./interpreter')

var library = module.exports = function(ctx) {
  function defineActor(name, fn) {
    ctx.bindName(name, ctx.typeFactory('NativeActor', ctx, fn))
  }

  // Helper function to convert lists to js arrays
  function toArray(ctx, msgPtr) {
    var list = ctx.memory.get(msgPtr)
    if(!(list instanceof interpreter.types.List)) {
      throw new Error('Expected a list')
    }
    // Get actor arguments
    var args = []
    while(list.head) {
      args.push(list.head)
      list = ctx.memory.get(list.tail)
    }
    return args
  }

  defineActor('+', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum = 0
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      if(!(val instanceof interpreter.types.Integer) && !(val instanceof interpreter.types.Float)) throw new Error('"+" expects its arguments to be of type Integer or Float')
      sum += val.val
      args = ctx.memory.get(args.tail)
    }

    return ctx.memory.put(new interpreter.types.Integer(this.memory, sum))
  })

  defineActor('-', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      if(!(val instanceof interpreter.types.Integer) && !(val instanceof interpreter.types.Float)) throw new Error('"-" expects its arguments to be of type Integer or Float')
      if("undefined" == typeof(sum)) sum = val.val
      else sum -= val.val
      args = ctx.memory.get(args.tail)
    }

    return ctx.memory.put(new interpreter.types.Integer(this.memory, sum))
  })

  defineActor('*', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum = 1
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      if(!(val instanceof interpreter.types.Integer) && !(val instanceof interpreter.types.Float)) throw new Error('"*" expects its arguments to be of type Integer or Float')
      sum *= val.val
      args = ctx.memory.get(args.tail)
    }

    return ctx.memory.put(new interpreter.types.Integer(this.memory, sum))
  })

  defineActor('/', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      if(!(val instanceof interpreter.types.Integer) && !(val instanceof interpreter.types.Float)) throw new Error('"/" expects its arguments to be of type Integer or Float')
      if("undefined" == typeof(sum)) sum = val.val
      else if(val.val === 0) throw new Error('Division by zero')
      else sum /= val.val
      args = ctx.memory.get(args.tail)
    }

    return ctx.memory.put(new interpreter.types.Integer(this.memory, sum))
  })

  defineActor('print', function print(ctx, argsPtr) {
    var args = ctx.memory.get(argsPtr)
    var sum = 0
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      process.stdout.write(val.dump()+' ')
      args = ctx.memory.get(args.tail)
    }
    process.stdout.write('\n')

    return argsPtr
  })

  defineActor('set', function set(ctx, msgPtr) {
    var args = ctx.memory.get(msgPtr)

    var symbol = ctx.memory.get(args.head)
    var tail = ctx.memory.get(args.tail)
    var valuePtr = tail.head
    ctx.caller.ctx.bindName(symbol.val, valuePtr)

    return valuePtr
  })

  defineActor('eval', function eval(ctx, msgPtr) {
    var args = ctx.memory.get(msgPtr)

    var code = ctx.memory.get(args.head).val
      , newCtx = new interpreter.Context(ctx, ctx)

    return interpreter(code, newCtx, 'eval')
  })

  defineActor('map', function(ctx, msgPtr) {
    var args = toArray(ctx, msgPtr)
    var mapperFn = this.memory.get(args[0])

    if(!(mapperFn instanceof interpreter.types.Actor)) {
      throw new Error('Expected actor as first argument')
    }

    args = args.slice(1)

    // Check list lengths and convert to arrays
    var length = toArray(ctx, args[0]).length
    args = args.map(function(l) {
      var array = toArray(ctx, l)
      if(array.length !== length) {
        throw new Error('Expected lists to be of equal lengths')
      }
      return array
    })

    var resPtr = 0
    if(args[0]) {
      for(var i=args[0].length-1; i>=0; i--) {
        var argsPtr = 0
        for(var j=0; j<args.length; j++) {
          var list = new interpreter.types.List(ctx.memory, args[j][i], argsPtr)
          argsPtr = ctx.memory.put(list)
        }
        var result = mapperFn.receive(argsPtr, {ctx: ctx})
        resPtr = ctx.memory.put(new interpreter.types.List(ctx.memory, result, resPtr))
      }
    }

    return resPtr
  })

  defineActor('head', function(ctx, msgPtr) {
    var list = ctx.memory.get(ctx.memory.get(msgPtr).head)

    if(!list || !(list instanceof interpreter.types.List)) {
      throw new Error('Expected list as first argument')
    }

    return list.head
  })

  defineActor('tail', function(ctx, msgPtr) {
    var list = ctx.memory.get(ctx.memory.get(msgPtr).head)

    if(!list || !(list instanceof interpreter.types.List)) {
      throw new Error('Expected list as first argument')
    }

    return list.tail
  })

  defineActor('concat', function(ctx, msgPtr) {
    var list = toArray(ctx, msgPtr)

    var string = ""
    list.forEach(function(ptr) {
      string += ctx.memory.get(ptr).val
    })

    return ctx.memory.put(new interpreter.types.String(ctx.memory, string))
  })
}
