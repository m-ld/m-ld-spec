# lists

## principles
1. Internal representation of a `@list` does not need to use [Collections](https://www.w3.org/TR/rdf-schema/#ch_collectionvocab) or [Containers](https://www.w3.org/TR/rdf-schema/#ch_containervocab). Instead it is driven by a sequence CRDT operating on the list items.
1. A List object is reified to a Subject (unlike in JSON-LD) and has an `@id`, which _can_ be set by the user. This is because it's normal in JSON-LD to be able to create multiple lists for a subject-predicate, but it's necessary to identify the list (not just by its head) when making updates.
1. A List object behaves logically like a Set of _slots_ `(@id, pos, object)`, where `pos` has its coherence maintained across operations (mapping [Kleppmann](https://martin.kleppmann.com/papers/list-move-papoc20.pdf) to an RDF-representable form).
1. Slot `pos` is represented as a positive integer in **json-rql**, but can be managed in any way by the list CRDT in play.
1. Slot `@id` is to identify slots across moves, with the constraint that a slot can only exist once in the list. It _cannot_ be set by the user.
1. Slot `object` is _not_ inferred to be in the object position for the predicate whose object is the list, whether for insert or query.
1. Translation to/from containers & collections is possible (e.g. recognising well-formed list nodes [(WFLN)](https://www.w3.org/TR/json-ld-api/#serialize-rdf-as-json-ld-algorithm)).
1. Translation to/from JSON-LD `@list` is as natural as possible.
1. JSON-LD Context is respected, and supports omission of the `@list` keyword.
1. List CRDT _behaviour_ is a pluggable `@type`-driven extension to **m-ld**, but list _representation_ using `@list` is built-in. The default list CRDT is `rdflseq`, which is packaged with **m-ld**.

<!-- TODO: Length & pagination -->
<!-- TODO: Recovery of list genids: applies to anon subjects generally -->

## syntax
```js
// JSON-LD
{
  '@id': 's',
  'p': {
    // '@id': 'listId' – is allowed here
    // '@type': 'http://m-ld.org/rdflseq' – default, or other
    // Never revert to JSON-LD rdf:List interpretation
    '@list': [
      'foo', // Zeroth position literally means zero, i.e. insert at head
      'bar'
    ]
  }
}
// json-rql indexed slot syntax
{
  '@id': 's',
  'p': {
    '@id': 'listId',
    // @type is implicit if 'p': { '@container': '@list' } in context
    // 'http://m-ld.org/rdflseq' by default, or other
    // @list key triggers indexed-object interpretation
    '@list': {
      // json-rql index uses a data URI
      'data:,0': 'foo',
      // In Javascript index can be a plain number, but not a plain string
      // ('1' would resolve to a property of the first list item)
      1: 'bar'
    }
  }
}
// Fully-expanded rdflseq
{
  '@id': 's',
  'p': {
    '@type': 'http://m-ld.org/rdflseq',
    // Slot positions generated or validated by the list type
    'http://m-ld.org/rdflseq/p/10/a': {
      'http://m-ld.org/rdflseq/#item': 'foo'
    },
    'http://m-ld.org/rdflseq/p/20/a': {
      'http://m-ld.org/rdflseq/#item': 'bar'
    }
  }
}
// < s p l >
// # CRDT-generated positions will be unique
// < l pos/10/a o >
// < l pos/20/b p >
// < o item 'foo' >
// < p item 'bar' >

// For reference, RDF Collection in JSON-LD
// This does not create a m-ld list
// Possibly this should WARN that convergence will discombobulate the list
{
  '@id': 's',
  'p': {
    // '@id': firstId – can't specify the list @id this way
    'rdf:first': 'foo',
    'rdf:rest': {
      // '@id': secondId
      'rdf:first': 'bar',
      'rdf:rest': { '@id': 'rdf:nil' }
    }
  }
}
```

## @insert
Using `@list`. *Adds* to existing triples, like all inserts.

Create list with genid at `< s p ?o >`:
> This creates a new list even if there is already one at `< s p ? >`
```js
{
  '@insert': {
    '@id': 's',
    'p': {
      // '@id': '_:b1' – implicit
      '@list': ['foo', 'bar']
    }
    // if 'p': { '@container': '@list' } in context
    // 'p': ['foo', 'bar']
  }
}
```
Create identified list at `< s p ?o >` (json-rql):
```js
{
  '@insert': {
    '@id': 's',
    'p': {
      '@id': 'myList',
      '@list': { // May not omit, even if 'p': { '@container': '@list' } in context
        'data:,0': 'foo',
        'data:,1': 'bar'
      }
    }
  }
}
```
Insert into identified list (JSON-LD):
```js
{
  '@insert': {
    '@id': 'listId',
    // This is not an append, which requires explicit index >= length
    // 🚧 @list at top-level is ignored by JSON-LD processor
    // This inserts at the head of the list (array index is a strong identifier)
    '@list': ['foo', 'bar']
  }
}
```
Insert into identified list (json-rql):
```js
{
  '@insert': {
    '@id': 'listId',
    '@list': {
      0: 'foo',
      // Javascript numeric keys are translated to data URIs
      'data:,1': 'bar'
    }
  }
}
```

## @delete
All `< s p ?o >` whether `?o` is a list or not:
> This leaves lists dangling unless `'p': { '@container': '@list' }` in context
```js
{
  '@delete': {
    '@id': 's',
    'p': '?'
  }
}
```
Every list and item at `s p`, _including slots_ (but not subject items):
```js
{
  '@delete': {
    '@id': 's',
    'p': {
      // '@id': '?' is implicit
      '@list': '?i'
      // 🚧 Slot variable is expanded to ?i#index, ?i#slot and ?i#item
      // == '@list': { '?i#index': '?i' }
    }
    // if 'p': { '@container': '@list' } in context
    // 'p': '?i'
  }
}
```
Specific value at `s p` _and its slot_:
```js
{
  // Deletes < list index slot > and < slot item 'foo' >
  '@delete': {
    '@id': '?list',
    '@list': { '?i': 'foo' }
    // If '?i' is referenced in a non-list-item position, it is ?i#index
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      // 🚧 Index variable is expanded to ?i#index and ?i#slot
      '@list': { '?i': 'foo' }
    }
  }
}
```
Specific slot by index in a list at `< s p ?list >`:
```js
{
  '@delete': {
    '@id': '?list',
    '@list': { 5: '?i' }
    // If '?i' is referenced in a non-list-item position, it is ?i#item
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': {
        // 🚧 Item variable is expanded to ?i#item and ?i#slot
        5: '?i'
      }
    }
  }
}
```

## update
Move a slot by value (atomically):
```js
{
  // @delete of start index is implicit because list semantics
  '@insert': {
    '@id': '?list',
    '@list': { 0: '?i' }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      // 🚧 Slot variable is expanded to ?i#item, ?i#index and ?i#slot
      // TODO: Unfathomable?
      '@list': { '@id': '?i': '@eq': 'foo' }
    }
    // SAME AS
    // '@graph': {
    //   '@id': 's',
    //   'p': { '@id': '?list', '@list': '?i' }
    // },
    // '@filter': { '@eq': ['?i', 'foo'] }
  }
}
```
Move a slot by start index:
```js
{
  '@insert': {
    '@id': '?list',
    '@list': { 0: '?i' }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      // 🚧 Item variable is expanded to ?i#item and ?i#slot
      '@list': { 5: '?i' }
    }
  }
}
```

## @describe
Includes list properties in full (like sets), with `@id`.

## @construct
Infer < s p item > (but lose ordering)
```js
{
  '@construct': { '@id': 's', 'p': '?o' }, // ?o#item
  '@where': {
    '@id': 's',
    'p': { '@list': '?o' }
  }
}
```

## @select
Select list (and anything else at < s p ?list >):
```js
{
  '@select': '?list',
  '@where': { '@id': 's', 'p': '?list' }
  // if 'p': { '@container': '@list' } in context then must use
  // '@where': { '@id': 's', 'p': { '@id': '?list', '@list': '?' } }
}
```
==>
```js
{
  '?list': {
    // Fully identified and indexed
    '@id': '.well-known/genid/list1',
    '@type': 'http://m-ld.org/rdflseq',
    '@list': ['i1', 'i2']
  }
}
```
Select item(s) by index:
```js
{
  '@select': '?o', // ?o#item
  '@where': {
    '@id': 's',
    'p': { '@list': { 5: '?o' } }
  }
}
```
<!-- TODO: Length of a list -->

## app updates
Format is always fully indexed and identified, e.g.
```js
{
  '@delete': [{ '@id': 's', 'p': { '@id': '.well-known/genid/list1', '@list': { 0: 'foo' } } }],
  '@insert': [{ '@id': 's', 'p': { '@id': '.well-known/genid/list1', '@list': { 0: 'bar' } } }]
}
```

## implementation
1. `'@list': {}` translation to **json-rql** syntax
1. List 'constraint' check/apply
1. List index query rewrite

## concurrency
Constraint: slot identity can only appear once, lowest wins

Setup
```n3
< s p l >
< l rdf:type lseq >
< l 10/a o >
< l 20/a p >
< l 21/a q >
< o item x >
< p item y >
< q item z >
```
### concurrently move `q` to index 0
Clone a: `DELETE { l 30/a q } INSERT { l 4/a q }`

Clone b: `DELETE { l 30/a q } INSERT { l 6/b q }`

### move `p` and `q` to index 0
Clone a: `DELETE { l 30/a q } INSERT { l 4/a q }`

Clone b: `DELETE { l 20/a p } INSERT { l 6/b p }`


<!---------------------------------------------------------------------------->
<!-- OLD: RDF Collection-based -->
<!--
`'@list'` literally means everything in the RHS is made the `rdf:first` of a WFLN.
No operation ever causes dangling `rdf:rest` pointers.

## concurrency
List positions have a stable identifier.

`rdf:List`, `rdf:first` and `rdf:rest` have a default constraint that maintains list integrity.

Resolution algorithm:
1. Establish list identities (head). For each list:
1. Graph traversal from subject, breadth-first ordered, omit processed, delete body-less

Is this a CRDT?
- Trivially, yes, because the graph is a CRDT
- Will all orderings converge to something sane?
- Is the list-graph always connected? (No garbage)

Setup
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

### move `q` to head and move `p` to head
Intent: q to head
`DELETE { s prop o . p rest q . q rest nil } INSERT { s prop q . p rest nil . q rest o }`

Intent: p to head
`DELETE { s prop o . o rest p . p rest q } INSERT { s prop p . p rest o . o rest q }`

Result
```
< s prop p, q >
< p first y; rest o, nil >
< o first x; rest q >
< q first z; rest o >

 s   => (one list, head was o) s-p-q-o ✔️ (meets most intent)
 |\
-p q
 |//
 o
```

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

s-q   => s-q-o-p ✔️ `DELETE { q rest p . o rest q } INSERT { o rest p }`
 (|\
  o p-
```

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
  o p?-
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
-p q?
```

-->