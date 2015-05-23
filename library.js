var interpreter = require('./interpreter')

module.exports = function(ctx) {
  function defineActor(name, fn) {
    ctx.bindName(name, ctx.typeFactory('NativeActor', ctx, fn))
  }

  defineActor('+', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum = 0
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      if(!(val instanceof interpreter.types.Integer)) throw new Error('"+" expects its arguments to be of type Integer')
      sum += val.val
      args = ctx.memory.get(args.tail)
    }

    return ctx.memory.put(new interpreter.types.Integer(this.memory, sum))
  })
  
  defineActor('>', function(ctx, args) {
    args = ctx.memory.get(args)
    var sum = 0
      , val

    while(args.head) {
      val = ctx.memory.get(args.head)
      process.stdout.write(val.dump()+' ')
      args = ctx.memory.get(args.tail)
    }
    process.stdout.write('\n')

    return
  })
}