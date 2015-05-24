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

## to-do
* macros
* static type system + type inference

## legal
(c) by Marcel Klehr  
MIT License