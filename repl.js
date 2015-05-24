var interpret = require('./interpreter')
  , library = require('./library')
  , readline = require('readline')


var ctx = new interpret.Context

library(ctx)

ctx.uncaughtException = function(er) {
  console.log('Error:', er.message)
  if(!er.stack[0]) {
    console.log(' at '+er.loc)
  }else {
    console.log(' at '+(er.stack[0].node? er.stack[0].node.children[0].value : 'anonymous actor')+' ('+er.loc+')')
    for(var i=1; i <= er.stack.length; i++) {
      var caller = er.stack[i], name
      if(caller) name = (caller.node? caller.node.children[0].value : 'anonymous actor')
      else name = ''
      var loc = (er.stack[i-1].ctx.native? '<native code>' : er.stack[i-1].node.loc)
      console.log(' at '+name+' ('+loc+')')
    }
  }
  if(er.jsError) console.log(er.jsError.stack? er.jsError.stack : er.jsError)
}

ctx.parseError = function(er) {
  console.log('Parse Error:', er.message)
  console.log(er.stack? er.stack : er)
}

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.on('line', function(line) {
  var ptr = interpret(line, ctx)
  //console.log(ptr)
  if('undefined' !== typeof(ptr)) console.log(ctx.memory.get(ptr).dump())
  rl.prompt()
})

rl.setPrompt('>>>', 3)
rl.prompt()
