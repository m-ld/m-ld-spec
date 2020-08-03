## Clone API
> This narrative and the associated API definitions use Typescript as an
> abstract specification language, for familiarity. **m-ld** itself is language-
> and platform-agnostic. Clone engine implementations provide language-specific
> bindings which will differ from these definitions, both syntactically and in
> the completeness with which the engine implements them.

### Initialisation
A **m-ld** clone must be initialised before it is ready to participate in data
transactions. To initialise, it must be configured with (at least):
- A domain name, representing the domain identity, such as `test.m-ld.org`. This
  is used to establish communication with other clones.
- A default [JSON-LD context](https://www.w3.org/TR/json-ld/#the-context)
  (optional). This can be used to simplify entity and property identities when
  using the clone API.

> **m-ld** natively uses [JSON-LD](https://json-ld.org/) as its data syntax,
> to ensure the widest possible applicability and ease of integration with
> existing systems. However, it is not generally necessary for users to have
> intimate knowledge of JSON-LD and Linked Data unless in advanced use-cases.

The [clone API](interfaces/meldclone.html) comprises two primary methods for
interacting with data:
- _Active_ transactions, for an app to read and write data: `transact`
- _Passive_ events, for an app to react to data changes: `follow`

In addition, it is possible to react to clone status via the `status` property.

During initialisation, a clone will determine its initial 'online' status, and
if possible, rev-up with recent updates from the domain. See the
[Clone Protocol](#clone-protocol) for more details.

### Transactions
The [`transact`](interfaces/meldclone.html#transact) API supports both read and
write of data. It takes a single parameter, a JSON object which declaratively
describes the transaction. The method returns an observable stream of
*subjects*, which represent query results – for write transactions, this is an
empty stream.

> The transaction JSON object and each returned subject are a
> [**json-rql**](https://json-rql.org/)
> [Pattern](https://json-rql.org/interfaces/pattern.html) and
> [Subject](https://json-rql.org/interfaces/subject.html), respectively.
> **json-rql** is a superset of JSON-LD, designed for query expressions. The
> following provides an informal introduction to the syntax. Note that clone
> engines may legitimately offer a limited subset of the full **json-rql**
> syntax. Check the engine documentation for details.

The simplest transaction inserts some data. In this case the transaction
description is just the data, a JSON subject, such as:
```json
{
  "@id": "fred",
  "name": "Fred"
}
```
No data is returned.

The subject is identified in the domain by the keyword property `@id`. The
value of this property must be unique.

> This property is defined to be an
> [IRI](https://en.wikipedia.org/wiki/Internationalized_Resource_Identifier),
> but by default, **m-ld** will scope a relative IRI to the domain. For example,
> if the domain is `test.m-ld.org`, this subject's identity will actually be
> `http://test.m-ld.org/fred`. This scoping is not significant in most
> use-cases, since queries for this data also use and retrieve the un-scoped
> identity, as shown below.

To retrieve this data subject, a *Query* JSON object is used as the transaction
description. A query uses a keyword property, in this case `@describe`, to
indicate the data filter and return format:
```json
{
  "@describe": "fred"
}
```
The return stream contains a single subject:
```json
{
  "@id": "fred",
  "name": "Fred"
}
```
In this case the response to the query returns an identical subject to that first
inserted. In general though, the inserted subject can be an arbitrarily nested
JSON object, but a describe query will only return the top-level attributes.

A key difference between **m-ld** and typical JSON stores is that in **m-ld**,
the JSON is a representation of a graph, and there is no storage of the original
structure of any subject.

In particular, this affects how write transactions are processed. All raw
subject transactions are treated as *insertions* to the data that already
exists. For example, following the above transactions with:
```json
{
  "@id": "fred",
  "age": 40
}
```
results in data that will be Described as:
```json
{
  "@id": "fred",
  "name": "Fred",
  "age": 40
}
```

In order to *update* a subject with changed data, it is necessary to explicitly
remove unwanted old data. This can be done with the more verbose
[Update](https://json-rql.org/interfaces/update.html) syntax, for example:
```json
{
  "@delete": {
    "@id": "fred",
    "name": "Fred"
  },
  "@insert": {
    "@id": "fred",
    "age": 40
  }
}
```

> The need for explicit removal of prior data can lead to unexpected data
> structure changes if not accounted for. Some clone engines provide an explicit
> `PUT`-like API to reduce verbosity. However similar situations can also arise
> due to concurrent data changes, so it is important for an app to be aware of
> this characteristic.

The query language also supports `@select` statements, which are able to gather
data values in arbitrarily complex ways from subjects in the domain. This
requires the use of a `@where` clause and *Variables*, which are placeholders
for subject keys, properties or values. For example:
```json
{
  "@select": "?nm",
  "@where": { "@id": "fred", "name": "?nm" }
}
```
The return stream contains a single pseudo-subject with matching values for the
variable:
```json
{
  "?nm": "Fred"
}
```
> 🚧 *Further documentation and examples coming soon.* Please
> [get in touch](mailto:info@m-ld.io) to tell us about your use-case!

### Events
Whenever data changes in a clone, an update event is notified to "followers" who
have subscribed using the [`follow`](interfaces/meldclone.html#follow) API. Data
can change due to both *local* and *remote* transactions, so this API is
essential for an app to maintain a current view on the domain data. Such a view
may be used for:
- Displaying the live data to the user
- Synchronising the data to some other (non-**m-ld**) database
- Indexing the data in some domain-specific way

Each [update](interfaces/meldupdate.html) has a strict structure indicating the
data that has been deleted and inserted, in both cases as arrays of Subjects.
Note that each subject is *partial*: it contains only the properties that were
affected by the transaction.

For example, given the following subject:
```json
{
  "@id": "fred",
  "name": "Fred"
}
```
and the following transaction (either remotely or locally):
```json
{
  "@id": "fred",
  "age": 40
}
```
The resultant update event will include:
```json
{
  "@delete": [],
  "@insert": [{ "@id": "fred", "age": 40 }]
}
```
On receipt of this update the app may not need to know any more about the
current state of the object, for example because it is already displayed in the
user interface; and the update can be trivially applied. If this is not so, then
the app can make a query to retrieve current state.

> Since data updates can arise at any time, to guarantee consistency in
> downstream data representations like a database, care may need to be taken to
> ensure that asynchronous queries do not receive data from more recent updates
> than intended. Update events and clone [status](#status) include a field for
> local logical clock `ticks`, which can be used by the clone engine to identify
> a specific data snapshot. However due to differences in engine data stores and
> language concurrency models, engines may vary in how this field is used. Check
> the engine documentation for the necessary details.

### Status
A clone engine's status can be obtained using the
[status](interfaces/meldclone.html#status) property. This provides the current
status description, an observable stream of changing status, and a way to await
a particular status. This can be used to refine the app's behaviour depending on
its requirements, for example:
- Awaiting the latest data before showing the user interface (see
  [Initialisation](#initialisation))
- Warning the user or disabling features when offline
- Additional data safety measures when the clone is 'siloed'
