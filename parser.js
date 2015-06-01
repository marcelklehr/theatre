var lex = require('./lexer')

/**
 * Parser
 *
 * Takes an input string, runs the lexer on it and converts the token stream
 * to an abstract syntax tree closely asserting its structure. It throws an error if it
 * detects syntactic problems.
 *
 * The top-level structure is an array of nodes, where a node is an object as follows:
 *   {node: `node type:string`, loc: `start position:int`, value: `a js value`}
 * or
 *   {node: `node type:string`, loc: `start position:int`, children: [child nodes..]}
 *
 * Node types:
 *  - LIST
 *  - IDENTIFIER
 *  - INTEGER
 *  - FLOAT
 *  - STRING
 */
module.exports = function parser(input, filename) {
  var tokstream = lex(input, filename)
    , stack = []
    , token
    , quoted
    , quasiquoted
    , interpolated
    , q

  for(var i=0; i<tokstream.length; i++) {
    token = tokstream[i]

    q = stack.pop()
    quoted = false
    quasiquoted = false
    interpolated = false
    if(q) {
      if(q.children && !q.children.length) {
        if('QUOTE' == q.node) quoted = true
        if('QUASIQUOTE' == q.node) quasiquoted = true
        if('QUASIQUOTE_INTERP' == q.node) interpolated = true
      }
      stack.push(q)
    }
    

    if(lex.tokens.LITERAL_LISTEND == token[0]) {
    
      var l
        , items = []

      // pop until we get to the LITERAL_LISTSTART token
      while((l = stack.pop()) && lex.tokens.LITERAL_LISTSTART != l[0]) {
        items.unshift(l)
      }

      if(!l) throw new Error('Unexpected token '+token[0]+' at '+token[1])

      if(l[2] || l[3] || l[4]) stack[stack.length-1].children.push({node: 'LIST', loc: l[1],  children: items})
      else stack.push({node: 'LIST', loc: l[1],  children: items})
      continue
    }

    if(lex.tokens.IDENTIFIER == token[0]) {
      if(quoted || quasiquoted || interpolated) q.children.push({ node: 'IDENTIFIER', loc: token[1], value: token[2]})
      else stack.push({ node: 'IDENTIFIER', loc: token[1], value: token[2]})
      continue
    }

    if(lex.tokens.LITERAL_LISTSTART == token[0]) {
      stack.push(token.concat([quoted, quasiquoted, interpolated]))
      continue
    }
    
    if(quoted) throw new Error('Unexpected token LITERAL_QUOTE at '+q.loc)
    if(quasiquoted) throw new Error('Unexpected token LITERAL_QUASIQUOTE at '+q.loc)
    if(interpolated) throw new Error('Unexpected token LITERAL_QUASIQUOTE_INTERP at '+q.loc)

    if(lex.tokens.LITERAL_QUOTE == token[0]) {
      stack.push({node: 'QUOTE', loc: token[1], children: []})
      continue
    }

    if(lex.tokens.LITERAL_QUASIQUOTE == token[0]) {
      stack.push({node: 'QUASIQUOTE', loc: token[1], children: []})
      continue
    }

    if(lex.tokens.LITERAL_QUASIQUOTE_INTERP == token[0]) {
      stack.push({node: 'QUASIQUOTE_INTERP', loc: token[1], children: []})
      continue
    }

    if(lex.tokens.LITERAL_STRING == token[0]) {
      stack.push({node: 'STRING', loc: token[1], value: token[2]})
      continue
    }

    if(lex.tokens.LITERAL_INTEGER == token[0]) {
      stack.push({node: 'INTEGER', loc: token[1], value: parseInt(token[2])})
      continue
    }

    if(lex.tokens.LITERAL_FLOAT == token[0]) {
      stack.push({node: 'FLOAT', loc: token[1], value: parseFloat(token[2])})
      continue
    }
  }

  // is the stack clean?
  stack.forEach(function(n) {
    if(n.node) return

    if(n[0]) {
      if(n[0] == lex.tokens.LITERAL_LISTSTART) throw new Error('Unclosed parenthesis at '+n[1])
    }
  })

  return stack
}
