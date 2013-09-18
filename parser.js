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
module.exports = function parser(input) {
  var tokstream = lex(input)
    , stack = []

  tokstream.forEach(function(token) {
  
    if(lex.tokens.IDENTIFIER == token[0]) {
      stack.push({node: 'IDENTIFIER', loc: token[1], value: token[2]})
      return
    }
  
    if(lex.tokens.LITERAL_LISTSTART == token[0]) {
      stack.push(token)
      return
    }
    
    if(lex.tokens.LITERAL_LISTEND == token[0]) {
      var l
        , items = []
      
      // pop until we get to the LITERAL_LISTSTART token which
      while((l = stack.pop()) && lex.tokens.LITERAL_LISTSTART != l[0]) items.unshift(l)
      
      if(!l) throw new Error('Unexpected token '+token[0]+' at '+token[1])

      stack.push({node: 'LIST', loc: l[1],  children: items})     // <---- USE INTERPRETER TYPES HERE!!! (?)  STRINGS ARE UNNECESSARY IF WE ALLOW QUOTATIONS (-> quote idents)!
      return
    }
    
    if(lex.tokens.LITERAL_STRING == token[0]) {
      stack.push({node: 'STRING', loc: token[1], value: token[2]})
      return
    }
    
    if(lex.tokens.LITERAL_INTEGER == token[0]) {
      stack.push({node: 'INTEGER', loc: token[1], value: parseInt(token[2])})
      return
    }
    
    if(lex.tokens.LITERAL_FLOAT == token[0]) {
      stack.push({node: 'FLOAT', loc: token[1], value: parseFloat(token[2])})
      return
    }
  })
  
  // is the stack clean?
  stack.forEach(function(n) {
    if(n.node) return
    
    if(lex.tokens.LITERAL_LISTSTART == n[0]) throw new Error('Unclosed parenthesis at '+n[1])
  })
  
  return stack
}