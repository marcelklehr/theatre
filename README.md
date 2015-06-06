Open the curtain, I present you:
# theatre
a my own chocolate-flavoured Lisp dialect

## give it a go
Spin up the REPL:
```
$ node repl
```

and check out...

### Mathematical operators
```
>>>(+ 1 2 3)
6

>>>(* 1 2 3)
6 # oho.

>>>(- 1 2 3)
-4 # mh.

>>>(/ 1 2 3)
0.16666666666666666 # uh!
```

### lambda expressions
```
>>>(set 'captain (lambda(x)(print (concat "The captain says: " x))) )
<anonymous actor>

>>>(captain "Set the sails!")
"The captain says: Set the sails!"
()
```

### higher-order functions
```
>>>(map + '(1 2 3) '(4 3 2))
( 5 5 5 ) # heh!
```

### continuations
```
(set 'continuation-in-my-pocket 0)
(set 'counter (lambda(x)
  (set 'i x)
  (callcc (lambda(c)(set 'continuation-in-my-pocket c)))
  (set 'i (+ i 1))
  i
))
(print (counter 2))
(print (continuation-in-my-pocket))
(print (continuation-in-my-pocket))
```
```
3
4
5
```
(Here, we put the current status away into our pocket, `counter` returns `3` -- so far so good.
Now to the crazy part: we call that continuation in our pocket, and *magic*: we're inside that `counter` function again and return `4`.  And the same again: `5`. Continuations ftw!) 

### macros
```

(defmacro until (cond body)
  `((lambda()
      (set 'cc 0)
      (callcc (lambda(c)(set 'cc c)))
      ,body
      (if (! ,cond) (cc) nil)
      ))
  )

(set 'i 0)
(until (= i 10)
  (proc 
    (set 'i (+ i 1))
    (print i)
    )
  )
```
(A macro is different from a function (or `lambda`) in that it doesn't evaluate its arguments, instead it takes the AST representation of the arguments and returns a new new AST tree, that is, new code, which is then evaluated. Here we use the power of continuations to implement an `until` loop. Notice how the macro inserts `cond` and `body` at the respective places in the code)

## to-do
* static type system + type inference

## legal
(c) by Marcel Klehr  
MIT License