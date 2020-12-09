# lists
In principle: list property behaves like a set for **json-rql** operations.

`'@list'` literally means *any* [well-formed list node](https://www.w3.org/TR/json-ld-api/#serialize-rdf-as-json-ld-algorithm) in the given position.

`'@list': { n: value }` syntax for indexed item access.

No operation ever causes dangling `rdf:rest` pointers.

## @insert
Using `@list`. *Adds* to existing triples, like all inserts.

Add to tail of existing list (actually, any list at < s p ? >):
```js
{
  '@insert': {
    '@id': 's',
    'p': {
      '@list': 'foo'
    }
  }
}
```

## @delete
Every item in list (actually, all < s p ?list > whether it's a list or not)
```js
{
  '@delete': {
    '@id': 's',
    'p': '?list'
  }
}
```
Every item in a list:
```js
{
  '@delete': {
    '@id': 's',
    'p': {
      '@list': '?item'
    }
  }
}
```
Single item by value:
```js
{
  '@delete': {
    '@id': 's',
    'p': {
      '@list': 'foo'
    }
  }
}
```
Single item by index:
```js
{
  '@delete': {
    '@id': 's',
    'p': {
      '@list': { 5: '?' } // @list key needed for index syntax
    }
  }
}
```

## update
Move an item (atomically):
```js
{
  '@delete': {
    '@id': 's',
    'p': {
      '@list': { 5: 'foo' }
    }
  },
  '@insert': {
    '@id': 's',
    'p': {
      '@list': { 0: 'foo' }
    }
  }
}
```
If the item was not in position 5, the delete does not match and 'foo' is duplicated.
- Use a variable instead of `'foo'` to move the item, irrespective of its
  content (needs `@where`)
- Delete `'@list': 'foo'` to move a matching item, irrespective of its starting
  position (but will delete all occurrences)
- Use immutable state to guarantee (local) behaviour

## @describe
Includes list properties in full (like sets)

## @select
Select list (and anything else at < s p ?list >):
```js
{
  '@select': '?list',
  '@where': {
    '@id': 's',
    'p': '?list'
  }
}
```
==>
```js
{
  '?list' {
    '@list': ['i1', 'i2']
  }
}
```
Select item by index:
```js
{
  '@select': '?item',
  '@where': {
    '@id': 's',
    'p': {
      '@list': { 5: '?item' } // @list key needed for index syntax
    }
  }
}
```

## app updates
Format is always fully indexed, e.g.
```js
{
  '@delete': [{ '@id': 's', 'p': { '@list': { 0: 'o', 1: 'o2', 2: 'o3' } } }],
  '@insert': [{ '@id': 's', 'p': { '@list': { 0: 'o4' } } }]
}
```

## concurrency
List positions have a stable identifier.

`rdf:List`, `rdf:first` and `rdf:rest` have a default constraint that maintains list integrity.

Setup:
```
< s prop o >
< o first x; rest p >
< p first y; rest q >
< q first z; rest nil >
```

### concurrently move `q` to head of list
Both clones:

`DELETE { s prop o . p rest q . q rest nil } INSERT { s prop q . p rest nil . q rest o }`

_No conflict_, no data matches DELETE, redundant INSERT.

### move `q` to different locations
Intent: q to head
`DELETE { s prop o . p rest q . q rest nil } INSERT { s prop q . p rest nil . q rest o }`

Intent: q after o (conflicting) / p after q (not conflicting)
`DELETE { o rest p . p rest q . q rest nil } INSERT { o rest q . p rest nil . q rest p }`

Result
```
< s prop q >
< q first z; rest o, p >
< o first x; rest q >
< p first y; rest nil >

s-q   => s-q-o-p ✔️ (meets most intent)
 (|\
  o p
```
Resolution algorithm: Graph traversal from s, omit processed, delete body-less
- Depth-first ltr = `s-q-o-p` = `DELETE { q rest p . o rest q } INSERT { o rest p }`
- (Depth-first rtl = `s-q-p-o`, breadth-first ltr = `s-q-o-p`, breadth-first rtl = `s-q-p-o`)

Is this a CRDT?
- Trivially, yes, because the graph is a CRDT.
- Will all orderings converge to something sane?
- Is the list-graph always connected? (No garbage)

### move `q` to head & delete `p`
Intent: q to head
`DELETE { s prop o . p rest q . q rest nil } INSERT { s prop q . p rest nil . q rest o }`

Intent: delete p
`DELETE { p first y . p rest q . o rest p } INSERT { o rest q }`

Result
```
< s prop q >
< q first z; rest o >
< o first x; rest q >
< p rest nil >

s-q   => s-q-o ✔️
 (|
  o p?
```

### move `q` to head and delete `q` & `o`
Intent: q to head
`DELETE { s prop o . p rest q . q rest nil } INSERT { s prop q . p rest nil . q rest o }`

Intent: delete q & o
`DELETE { q first z; q rest nil . o first x; rest p . s prop o . p rest q } INSERT { s prop p . p rest nil }`

Result
```
< s prop p, q >
< p first y; rest nil >
< q rest o >

s       => s-p ✔️ (assuming delete wins)
|\
p q?
```