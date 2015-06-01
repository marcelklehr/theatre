var DEBUG = true

/**
 * Lexer
 *
 * Takes a string and converts it to a stream of tokens
 * Token names are defined in `lexer.tokens`.
 * A token is represented by [token name:(int/string in dbg mode) , position:int, value:string]
 */
module.exports = function lexer(input, filename) {
  var c
    , tokstream = []
    , line = 1
    , char = 1
    , pos

  for(var i=0, l=input.length; i<l;i++,char++) {
    c = input[i]
    pos = line+':'+char

    if(c === '\n') line++ && (char = 1)

    if(c.match(/[\r\n ]/)) void(0)
    else
    if(c == '(')
        tokstream.push([tokens.LITERAL_LISTSTART, filename+':'+pos])
    else
    if(c == ')')
        tokstream.push([tokens.LITERAL_LISTEND, filename+':'+pos])
    else
    if(c.match(/[0-9.]/)) {
        var number = c
          , floatingPoint = (c == '.')
        while(++i && input[i]) {
          if(input[i] == '.') {
            if(floatingPoint) throw new Error('Number of type Float cannot have two floating points at position: '+pos)
            floatingPoint = true
            number += input[i]
          }else if(input[i].match(/[0-9]/)) {
            number += input[i]
          }else {
            i--
            break;
          }
        }
        if(floatingPoint) tokstream.push([tokens.LITERAL_FLOAT, filename+':'+pos, number])
        else tokstream.push([tokens.LITERAL_INTEGER, filename+':'+pos, number])
    }else
    if(c == '"') {
        var string = ''
          , escape = false
        while(++i && input[i]) {
          if(input[i] == '"') {
            if(!escape) break;
            else escape = !escape
            string += input[i]
          }else if (input[i] == '\\') {
            if(escape) string += input[i]
            escape = !escape
          }else {
            string += input[i]
            if(escape) escape = !escape
          }
        }
        tokstream.push([tokens.LITERAL_STRING, filename+':'+pos, string])
    }else
    if(c == "'") {
        tokstream.push([tokens.LITERAL_QUOTE, filename+':'+pos])
    }else if(c.match(/[^ 0-9()'`,"]/)){
        var ident = c
        while(++i && input[i]) {
          if(m = input[i].match(/[0-9a-zA-Z:?+~_%!\/<>\^]/)) {
            ident += input[i]
          }else {
            i--
            break;
          }
        }
        tokstream.push([tokens.IDENTIFIER, filename+':'+pos, ident])
    }else
    if(c == '`'){
        tokstream.push([tokens.LITERAL_QUASIQUOTE, filename+':'+pos, ident])
    }else
    if(c == ','){
        tokstream.push([tokens.LITERAL_QUASIQUOTE_INTERP, filename+':'+pos, ident])
    }else{
         throw new Error('Unrecognised character at position: '+pos+' >> '+ c)
    }
  }

  return tokstream
}

var tokens =
module.exports.tokens = {}

;[ 'LITERAL_LISTSTART'
, 'LITERAL_LISTEND'
, 'LITERAL_STRING'
, 'LITERAL_INTEGER'
, 'LITERAL_FLOAT'
, 'IDENTIFIER'
, 'LITERAL_QUOTE'
, 'LITERAL_QUASIQUOTE'
, 'LITERAL_QUASIQUOTE_INTERP'
].forEach(function(tok, i) {
  tokens[tok] = i
  if(DEBUG) tokens[tok] = tok
})
