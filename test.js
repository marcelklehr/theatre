var parse = require('./parser')
var interpret = require('./interpreter')


var memory = new interpret.Memory
  , ctx = new interpret.Context(memory)

ctx.uncaughtException = function(er) {
  console.log('An error occurred:', er.message, 'at ', er.loc)
  console.log(er.stack)
  if(er.jsError) console.log(er.jsError.stack? er.jsError.stack : er.jsError)
  //process.exit(1)
}

ctx.appendOutput = function(str) {
  process.stdout.write(str)
}

;[ 
  '()'
, '"oho! a string!\\" what a pleasure in this \'lispy\' landscape...\\" some parens maybe? ))))"'
, "(+ (5 8))"
, "(print (+ 5 8))"
].forEach(function(prg) {
  console.log('>>>', prg)
  console.log(JSON.stringify(parse(prg), null, '   '))
  interpret(prg, ctx)
  console.log()
})