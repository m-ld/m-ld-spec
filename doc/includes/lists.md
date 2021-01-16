# lists

## principles
1. Internal representation of a `@list` does not need to use [Collections](https://www.w3.org/TR/rdf-schema/#ch_collectionvocab) or [Containers](https://www.w3.org/TR/rdf-schema/#ch_containervocab). Instead it is driven by a sequence CRDT operating on the list items.
1. A List object is reified to a Subject (unlike in JSON-LD) and has an `@id`, which can be set by the user. This is because it's normal in JSON-LD to be able to create multiple lists for a subject-predicate, but it's necessary to identify the list (not just by its head) when making updates.
1. A List object behaves logically like a Set of _slots_ `(@id, pos, object)`, where `pos` has its coherence maintained across operations (mapping [Kleppmann](https://martin.kleppmann.com/papers/list-move-papoc20.pdf) to an RDF-representable form).
1. Slot `pos` is represented as a positive integer in **json-rql**, but can be managed in any way by the list CRDT in play.
1. Slot `@id` is to identify slots across moves, with the constraint that a slot can only exist once in the list. It can be set by the user by fully specifying the slot (see below).
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
    // @type 'http://m-ld.org/rdflseq' is added if not specified
    // @list key triggers indexed-object interpretation
    '@list': {
      // json-rql index uses a data URI or numeric string
      'data:,0': 'foo',
      // In Javascript index can be a plain number.
      // Anything else errors.
      1: 'bar',
      // Use of the @item keyword means this value is a slot, not a subject item
      2: { '@id': 'mySlot', '@item': 'baz' }
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
    // This interleaves at the head of the list (array index is a strong identifier)
    '@list': ['foo', 'bar']
  }
}
```
Insert into identified list (json-rql):
> Append to list requires list length
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
Insert multiple at one index in identified list:
```js
{
  '@insert': {
    '@id': 'listId',
    // This inserts two items at the head of the list
    // Note indexed list hash does not nest
    '@list': { 0: ['foo', 'bar'] }
    // Specify slots with
    // '@list': { 0: [{ '@item': 'foo' }, { '@item': 'bar' }] }
    // 🚧 expands internally to '@list': {
    //   'data:,0,0': { '@id': '_:b1', '@item': 'foo', 'mld:#index': 0 }
    //   'data:,0,1': { '@id': '_:b2', '@item': 'bar', 'mld:#index': 0 }
    // }
    // Deeper nesting is nested lists
  }
}
```
Create nested lists:
> List arrays nest by default, per JSON-LD
```js
{
  '@insert': {
    '@id': 's',
    'coordinates': {
      '@id': 'sc',
      '@list': [[0, 0], [1, 1]]
    }
  }
}
```
Insert new nested list into list:
> List hashes do not nest
```js
{
  '@insert': {
    '@id': 's',
    'coordinates': {
      '@id': 'sc',
      '@list': { 0: { '@list': [-1, -1] } }
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
      '@list': { '?index': '?item' }
      // 🚧 expands to '?index#listKey': { '@id': '?index#slot', '@item': '?item', 'mld:#index': '?index' }
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
    // 🚧 expands to '?i#listKey': { '@id': '?i#slot', '@item': 'foo', 'mld:#index': '?i' }
    // If '?i' is referenced in a non-list-item position, it is just plain ?i
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': { '?i': 'foo' }
      // 🚧 expands to '?i#listKey': { '@id': '?i#slot', '@item': 'foo', 'mld:#index': '?i' }
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
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': { 5: '?i' }
      // 🚧 expands to '?': { '@id': '?', '@item': '?i', 'mld:#index': 5 }
    }
  }
}
```

## update
Move a slot by value (atomically):
```js
{
  // @delete of start index is NOT implicit - without it, list constraint rejects
  '@delete': {
    '@id': '?list',
    '@list': { '?i': { '@id': '?slot', '@item': 'foo' } }
  },
  '@insert': {
    '@id': '?list',
    '@list': { 0: { '@id': '?slot', '@item': 'foo' } }
     // 🚧 expands to 'data:,0': { '@id': '?slot', '@item': 'foo', 'mld:#index': 0 }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': { '?i': { '@id': '?slot', '@item': 'foo' } }
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
    '@list': { 0: { '@id': '?slot', '@item': '?i' } }
     // 🚧 expands to 'data:,0': { '@id': '?slot', '@item': '?i', 'mld:#index': 0 }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      // Same item could be in two slots, which slot moves? – must be explicit
      '@list': { 5: { '@id': '?slot', '@item': '?i' } }
      // 🚧 expands to '?': { '@id': '?slot', '@item': '?i', 'mld:#index': 5 }
      // listKey, slot & index belong to the index variable because item can appear more than once
    }
  }
}
```
Swap slots:
```js
{
  '@insert': {
    '@id': '?list',
    '@list': { 0: '?i5', 5: '?i0' }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': { 0: '?i0', 5: '?i5' }
    }
  }
}
```
Replace a slot item:
```js
{
  '@delete': {
    '@id': '?list', '@list': { '?i': 'foo' }
  },
  '@insert': {
    '@id': '?list',
    '@list': { '?i': 'bar' }
     // 🚧 expands to '?i#listKey': { '@id': '?i#slot', '@item': 'bar', 'mld:#index': '?i' }
  },
  '@where': {
    '@id': 's',
    'p': {
      '@id': '?list',
      '@list': { '?i': 'foo' }
      // 🚧 expands to '?i#listKey': { '@id': '?i#slot', '@item': 'foo', 'mld:#index': '?i' }
    }
  }
}
```

## @describe
Does not include list property items unless the list itself is described.

## @construct
Infer < s p item > (but lose ordering)
```js
{
  '@construct': { '@id': 's', 'p': '?o' },
  '@where': {
    '@id': 's',
    'p': { '@list': { '?': '?o' } }
  }
}
```

## @select
Select list reference (and anything else at < s p ?o >):
```js
{ '@select': '?list', '@where': { '@id': 's', 'p': '?list' } }
```
Select item(s) by index:
```js
{
  '@select': '?o',
  '@where': {
    '@id': 's',
    'p': { '@list': { 5: '?o' } }
  }
}
```
<!-- TODO: Select by index range -->
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