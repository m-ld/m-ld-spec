import { Subject, Pattern } from 'json-rql';
import { Observable } from 'rxjs';

/**
 * A **m-ld** clone represents domain data to an app. This interface is
 * implemented by a clone engine. It adheres to the **m-ld** data
 * [concurrency](https://m-ld.org/doc/#concurrency) contract. It may offer
 * additional data features, such as data persistence between re-starts; and API
 * features such as language-specific convenience methods. Refer to the clone
 * [engine](https://m-ld.org/doc/#platforms) documentation for details.
 */
export interface MeldClone {
  /**
   * Actively reads data from, or writes data to, the domain.
   *
   * An engine can legitimately offer a limited subset of the full **json-rql**
   * syntax for the `request` parameter, and reject patterns that it does not
   * support with an `Unsupported pattern` error.
   *
   * @param request the declarative transaction description
   * @returns an observable stream of subjects. For a write transaction, this is
   * empty, but indicates final completion or error of the transaction.
   * @see http://json-rql.org/interfaces/pattern.html
   * @see http://json-rql.org/interfaces/subject.html
   */
  transact(request: Pattern): Observable<Subject>;
  /**
   * Follow updates from the domain. All data changes are signalled through the
   * returned stream, strictly ordered according to the clone's logical clock.
   * The updates can therefore be correctly used to maintain some other view of
   * data, for example in a user interface or separate database.
   * 
   * @param after updates will be emitted to the returned stream after (not
   * including) the given tick count for the clone's logical clock. This tick
   * count can be in the past or future. If the clone is unable to recall
   * updates from a too-distant past, the stream will fail with `Updates
   * unavailable`.
   * @returns an observable stream of updates from the domain.
   */
  follow(after?: number): Observable<MeldUpdate>;
  /**
   * The current and future status of a clone. This stream is hot and
   * continuous, terminating when the clone closes (and can therefore be used to
   * detect closure).
   */
  readonly status: Observable<MeldStatus> & LiveStatus;
}

/**
 * An update event signalling a write operation, which may have been transacted
 * locally in this clone, or remotely on another clone.
 */
export interface MeldUpdate {
  /**
   * Partial subjects, containing properties that have been deleted from the
   * domain. Note that deletion of a property (even of all properties) does not
   * necessarily indicate that the subject's identity is not longer represented
   * in the domain.
   */
  '@delete': Subject[];
  /**
   * Partial subjects, containing properties that have been inserted into the
   * domain.
   */
  '@insert': Subject[];
  /**
   * Current local clock ticks at the time of the update.
   * @see MeldStatus.ticks
   */
  '@ticks': number;
}

/**
 * A means to obtain the current status, and await future statuses, of a clone.
 */
export interface LiveStatus {
  /**
   * The current clone status
   */
  readonly value: MeldStatus;
  /**
   * @returns a promise of a future status matching the given partial status
   * (with the exception of the `@ticks` field, which is ignored if specified).
   * If the clone never achieves the requested status, the promise will resolve
   * to `undefined` when the clone closes.
   */
  becomes: (match?: Partial<MeldStatus>) => Promise<MeldStatus | undefined>;
};

export interface MeldStatus {
  /**
   * Whether the clone is attached to the domain and able to receive updates.
   */
  online: boolean;
  /**
   * Whether the clone needs to catch-up with the latest updates from the
   * domain. For convenience, this flag will have the value `false` in
   * indeterminate scenarios such as if there are no other live clones on the
   * domain (this is a "silo").
   */
  outdated: boolean;
  /**
   * Whether this clone is the only one attached to a domain. Being a silo may
   * be a danger to data safety, as any changes made to a silo clone are not
   * being backed-up on any other clone.
   */
  silo: boolean;
  /**
   * Current local clock ticks at the time of the status change. This can be
   * used in a subsequent call to {@link MeldStore.follow}, to ensure no updates
   * are missed.
   *
   * This clock is *strictly* local, and there is no relationship between the
   * clock ticks of one clone and that of another, even for the same transaction.
   * 
   * @see MeldUpdate.@ticks
   */
  ticks: number;
}

/**
 * Errors that occur in a **m-ld** engine should be signalled with the given
 * error codes where appropriate. The means by which errors are signalled is
 * platform-specific.
 */
export enum MeldErrorStatus {
  /**
   * No error has occurred.
   */
  'No error' = 0,

  //////////////////////////////////////////////////////////////////////////////
  // Bad request errors
  /**
   * A **json-rql** pattern has neen specified that neither reads nor writes
   * data, for example a Group with variable content.
   */
  'Pattern is not read or writeable' = 4001,

  //////////////////////////////////////////////////////////////////////////////
  // Not found errors
  /**
   * A request was made for updates in the too-distant past. This can occur when
   * following clone updates, or when re-starting a clone that has been offline
   * for too long.
   */
  'Updates unavailable' = 4041,

  //////////////////////////////////////////////////////////////////////////////
  // Internal errors
  /**
   * A serious error has occurred in the engine implementation.
   */
  'Unknown error' = 5000,
  /**
   * The engine has received an update that it cannot parse. This may be due to
   * a version inconsistency, or a bad actor. As this error could lead to data
   * loss, the clone will immediately close, persisting its current state if
   * possible.
   */
  'Bad update' = 5001,
  /**
   * The engine has received a response that it cannot parse. This may be due
   * to a version inconsistency, or a bad actor. As this error could lead to
   * data loss, the clone will immediately close, persisting its current state
   * if possible.
   */
  'Bad response' = 5002,
  /**
   * The engine has received a rejection from another engine on the domain to
   * one of its requests. This could lead to the clone failing to initialise, or
   * shutting down shortly after initialisation.
   */
  'Request rejected' = 5003,
  /**
   * The engine has attempted an operation that requires other clones to be
   * visible. This typically indicates a concurrency problem in the engine.
   */
  'Meld is offline' = 5004,

  //////////////////////////////////////////////////////////////////////////////
  // Unsupported operations
  /**
   * The engine does not support the pattern in the transaction request.
   */
  'Unsupported pattern' = 5011,

  //////////////////////////////////////////////////////////////////////////////
  // Service unavailable
  /**
   * This is a new clone on the domain, but no other clones are visible,
   * possibly due to a network partition. The clone cannot initialise.
   */
  'No visible clones' = 5031,
  /**
   * This clone has been closed, explicitly by the app or due to an error. All
   * subsequent transactions will fail.
   */
  'Clone has closed' = 5032,
  /**
   * The clone data is not writeable due to a platform limitation such as file
   * locking, or concurrent access controls.
   */
  'Clone data is locked' = 5034
}
