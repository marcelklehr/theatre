var interpret = require('./interpreter')
  , library = require('./library')
  , fs = require('fs')


var ctx = new interpret.Context

library(ctx)

ctx.uncaughtException = function(er) {
  console.log('Error:', er.message)
  if(!er.stack[0]) {
    console.log(' at '+(null === er.loc? '<native code>' : er.loc))
  }else {
    console.log(' at '+(er.stack[0].node? er.stack[0].node.children[0].value : 'anonymous actor')+' ('+(null === er.loc? '<native code>' : er.loc)+')')
    for(var i=1; i <= er.stack.length; i++) {
      var caller = er.stack[i], name
      if(caller) name = (caller.node? caller.node.children[0].value : 'anonymous actor')
      else name = ''
      var loc = (er.stack[i-1].ctx.native? '<native code>' : er.stack[i-1].node.loc)
      console.log(' at '+name+' ('+loc+')')
    }
  }
  if(er.jsError) console.log(er.jsError.stack? er.jsError.stack : er.jsError)
  process.exit(1)
}

ctx.parseError = function(er) {
  console.log('Parse Error:', er.message)
  console.log(er.stack? er.stack : er)
  process.exit(1)
}

fs.readFile(process.argv[2], function(er,blob) {
  interpret(blob.toString(), ctx, process.argv[2])
})
