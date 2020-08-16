## Data Semantics
Data in **m-ld** is [structured](https://m-ld.org/doc/#structured-data), stored
as a graph, and represented as JSON in the clone API.

This graph nature, along with the convergence model for concurrent updates,
gives rise to the following set of semantic rules, awareness of which will help
an app developer to correctly handle the data.

1. Every Subject has an identity, given with the `@id` field.
1. Properties of a Subject can be:
   - The native JSON atomic values: strings, numbers, booleans
   - Subjects, represented as JSON objects with an `@id` property
   - [References](#reference) to Subjects, which are JSON objects with a single
     `@id` field, e.g. `{ "@id": "foo" }`
   - Arrays of any of the above.
1. Arrays have *Set* semantics – unlike normal JSON arrays. They do not contain
   duplicate members, and they are *unordered*. Insertion of duplicate values in
   a transaction results in only one of the values being stored.
   > 🚧 JSON-LD supports List semantics when specified using the `@list` type.
   > **m-ld** will support the `@list` type in a forthcoming release.
1. In the absence of a `single-valued` constraint (see below), any property of a
   Subject except the `@id` property can become multi-valued (an array) in the
   data.
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

### Declarative Constraints
A 'constraint' is a semantic rule that describes invariants about the data. As
part of **m-ld**'s [concurrency](https://m-ld.org/doc/#concurrency) model,
engines may provide a set of available constraints that can be declared in the
engine initialisation.

> 🚧 Inclusion of declarative integrity constraints in **m-ld** is an
> experimental feature, and the subject of active research. The available
> constraints and the means by which they are declared for a domain is likely to
> change. Please do [get in touch](mailto:info@m-ld.io) with your requirements.

Declarative constraints have two modes of operation:
1. They are *checked* during a local write transaction. If the update violates
   the constraint's invariant, then the transaction fails and no data changes
   are made. This is a 'fail fast' mechanism which prevents the majority of
   violations before they are committed to the domain.
1. They are *applied* when remote updates are applied to the local data.
   Application of a constraint involves an **automatic** resolution, the rules
   for which are defined in the constraint. This mechanism catches invariant
   violations arising due to conflicts between clone updates.

The following is a list of candidate declarable constraints and their
configuration options. See the [engine](https://m-ld.org/doc/#platforms)
documentation for supported constraints and syntax.

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
