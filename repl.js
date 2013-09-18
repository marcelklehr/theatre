var interpret = require('./interpreter')
  , readline = require('readline')


var ctx = new interpret.Context

ctx.uncaughtException = function(er) {
  console.log('An error occurred:', er.message, 'at ', er.loc)
  console.log(er.stack)
  if(er.jsError) console.log(er.jsError.stack? er.jsError.stack : er.jsError)
}

ctx.parseError = function(er) {
  console.log('Parse Error:', er.message)
  console.log(er.stack? er.stack : er)
}

ctx.appendOutput = function(str) {
  process.stdout.write(str)
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