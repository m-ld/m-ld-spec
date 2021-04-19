## Data Semantics
Data in **m-ld** is [structured](https://m-ld.org/doc/#structured-data), stored
as a graph, and represented as JSON in the clone API.

This graph nature, along with the convergence model for concurrent updates,
gives rise to the following set of semantic rules, awareness of which will help
an app developer to correctly handle the data.

### Subjects
A top-level JSON object represents a `Subject`, that is, something interesting
to talk about in the domain.

```json
{
```
1. Every Subject may have an identity, given with the `@id` field. If an
   identity is not provided on first insertion, an identifier will be generated
   of the form <code>.well-known/genid/<i>GUID</i></code>, which is visible when
   querying the Subject.
   ```json
   "@id": "fred",
   ```
1. Properties of a Subject can be:
   - The native JSON atomic values: strings, numbers, booleans
   
   ```json
   "name": "Fred Flintstone",
   ```
   - Other Subjects, represented as JSON objects
   
   ```json
   "address": { "number": 55, "street": "Cobblestone Rd" },
   ```
   - References to other Subjects: JSON objects with a single `@id` field
   
   ```json
   "spouse": { "@id": "wilma" },
   ```
   - Arrays of any of the above.
1. Array properties have
   [*Set*&nbsp;semantics](https://en.wikipedia.org/wiki/Set_(abstract_data_type))
   by default, unlike normal JSON arrays, unless they are qualified with the
   `@list` keyword (see next). They do not contain duplicate members, and they
   are *unordered*. Insertion of duplicate values in a transaction results in
   only one of the values being stored.
   ```json
   "interests": ["bowling", "pool", "golf", "poker"],
   ```
1. A Subject having an `@list` property represents a list. The value of the
   `@list` key is the full, ordered content of the list (if an array), or a set
   of index-item pairs (if a hash). See [Lists](#lists) below for more details.
   ```json
   "episodes": {
      "@list": ["The Flintstone Flyer", "Hot Lips Hannigan", "The Swimming Pool"]
   },
   ```
1. In the absence of a `single-valued` constraint (see below), any property of a
   Subject except the `@id` property can become multi-valued (an array) in the
   data. This can happen by inserting a value without deleting the old one, or
   due to conflicting edits.
   ```json
   "height": [5, 6]
   ```
1. In the absence of a `mandatory` constraint (see below), any property of a
   Subject except the `@id` property can become empty (see next).
1. When accepting data in a transaction, the following JSON values are
   equivalent, and represent an empty property:
   - an empty array (`[]`)
   - `null`
   - omission of the property

   In particular, it is not possible to 'nullify' a value using an `@insert`
   clause, because passing a value of `null` actually tells the engine that the
   transaction has nothing to say about the value – as if it was not mentioned
   at all. To remove a value, it is necessary to use a `@delete` clause.
1. When providing data in response to a Read transaction, an engine will never
   emit `null` or an empty array (`[]`) – the property will be omitted.

```json
}
```

### Constraints
A 'constraint' is a semantic rule that describes invariants about the data. As
part of **m-ld**'s [concurrency](https://m-ld.org/doc/#concurrency) model,
engines may provide a set of available constraints that can be declared in the
engine initialisation.

> 🚧 Inclusion of declarative integrity constraints in **m-ld** is an
> experimental feature, and the subject of active research. The available
> constraints and the means by which they are declared for a domain is likely to
> change. Please do [get in touch](https://m-ld.org/hello/) with your requirements.

Declarative constraints have two modes of operation:
1. They are *checked* during a local write transaction. If the update violates
   the constraint's invariant, then the transaction fails and no data changes
   are made. This is a 'fail fast' mechanism which prevents the majority of
   violations before they are committed to the domain.
1. They are *applied* when remote updates are applied to the local data.
   Application of a constraint involves an **automatic** resolution, the rules
   for which are defined in the constraint. This mechanism catches invariant
   violations arising due to conflicts between clone updates.

The following is a list of candidate declarable constraints. See the
[engine](https://m-ld.org/doc/#platforms) documentation for supported
constraints and syntax.

- `single-valued`: A subject property must have a single atomic value.
  
  Conflict Scenario: Any subject property in the domain can become multi-valued (an
  array) if concurrent inserts are made to the same subject property.
  
  Resolution: Pick a 'winning' value using a rule. This could be based on the
  conflicting values (e.g. maximum or average), or based on another property
  value (e.g. a timestamp).

- `mandatory`: A subject must have a value for a property.

  Conflict Scenario: If one app instance removes a subject in its entirety at the same
  time as another app instance updates a property, then the updated property
  value remains in the converged domain – all other properties are now missing,
  even if mandatory. (Note that neither app instance violated the rule locally.)

  Resolution: Treat a subject without a value for a mandatory field as an
  invalid subject. The subject is deleted (note that in the conflict scenario,
  this was the intention of one of the updates).

- `unique`: A set of subjects in the domain (e.g. of a specific type) must
  have unique values for a property (besides their identity).

  Conflict Scenario: Concurrent updates to two different subjects could both
  update the property to the same value.

  Resolution: Decide the Subject to receive the conflicting value. Delete the
  other subject's property. If the property is mandatory, revert the value to
  the previous (it must exist in the same transaction).

### Lists
As noted above, plain JSON arrays as Subject property values are interpreted as
unordered _sets_. However as in most programming languages, an ordered
collection or _list_ is also natively supported by **m-ld**, using additional
syntax as follows.

A list in **m-ld** is a kind of Subject. It and can therefore have an identity
and properties. It differs from a normal Subject by the inclusion of the `@list`
keyword.

```json
{ "@id": "shopping", "@list": ["Bread", "Milk"] }
```

> This syntax is a super-set of standard JSON-LD, which does not permit a
> [list&nbsp;object](https://www.w3.org/TR/json-ld11/#lists) to have other
> properties. JSON-LD list objects can be loaded into **m-ld** as anonymous
> Subjects, but the reverse is typically not possible without some
> pre-processing.

The value of the `@list` property represents the ordered collection of 'items',
which can be any normal Subject property value type such as JSON values (except
`null`), Subjects and References. Duplicate items are allowed, and will remain
duplicated when retrieved.

When retrieving a list, the contents of the `@list` property will always be
consistently ordered. In the example above, `"Milk"` will always follow
`"Bread"` unless an update has been made to the list.

Updating and querying a list makes use of an alternate syntax for the `@list`
key, using a JSON object to specify index positions.

```json
{ "@insert": { "@id": "shopping", "@list": { "2": "Spam" } } }
```

This appends `"Spam"` to the shopping list at index position 2. After this
update, the shopping list content will be `["Bread", "Milk", "Spam"]`. If the
given index position was `"1"` instead, the final content would be `["Bread",
"Spam", "Milk"]`.
- Each key of the `@list` value object must be a non-negative integer
  [JSON&nbsp;number](https://tools.ietf.org/html/rfc7159#section-6) or a
  variable. As with all JSON keys, this must be surrounded by quotes. Any other
  key format will cause an error.
- Keys whose value is greater than the list length are interpreted as the list
  length. It is not possible to create a 'sparse' list with empty or undefined
  values.
- Keys always represent indexes in the list before any other part of the update
  has been processed.

A variable can be used in the index or item position to query a list. The
following query selects the index position of `"Spam"` in the shopping list.

```json
{
  "@select": "?spamIndex",
  "@where": { "@id": "shopping", "@list": { "?spamIndex": "Spam" } }
}
```
The following query selects the item at position 1 in the shopping list.
```json
{
  "@select": "?item",
  "@where": { "@id": "shopping", "@list": { "1": "?item" } }
}
```
It is therefore possible to delete items from a list using this syntax; for
example, the item at index 1 regardless of its value:
```json
{ "@delete": { "@id": "shopping", "@list": { "1": "?" } } }
```

_Moving_ an item in a list can require a little more syntax, depending on the
meaning of the list and so how concurrent edits should be understood. Like all
[transactions](#transactions) in **m-ld**, a move comprises a delete and an
insert. Since list items can have duplicates, the outcome of a concurrent move
of an item to two different locations could be:
- The item now exists in both locations. This would make sense if the list were
  the notes of a piece of music.
- The item is moved to one of the locations, but not both. This would make sense
  for a shopping list.

In **m-ld**, the latter meaning is captured with the concept of list _slots_. In
this case it's not the item that is moved but the slot – like a box containing
the item. Slots can only appear once in a list, so the final position is chosen
as one of the two user-specified positions.

Most of the time list slots are implicit in the interface, for simplicity. They
can be made explicit using the keyword `@item`. Just like a list is identified by
having a `@list` property, a slot is identified by having an `@item` property.

```json
{ "@insert": { "@id": "shopping", "@list": { "2": "Spam" } } }
```
(implicit slot) is the same as:
```json
{ "@insert": { "@id": "shopping", "@list": { "2": { "@item": "Spam" } } } }
```
(the explicit slot is `{ "@item": "Spam" }`). A slot is a Subject, and has an
`@id`, which is normally automatically generated for implicit slots.

Using slots, it is possible to move an item as follows:
```json
{
  "@delete": {
    "@id": "shopping",
    "@list": { "2": { "@id": "?slot", "@item": "Spam" } }
  },
  "@insert": {
    "@id": "shopping",
    "@list": { "0": { "@id": "?slot", "@item": "Spam" } }
  }
}
```
This moves the slot containing Spam at index 2 to the head of the list.