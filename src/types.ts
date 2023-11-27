export type Operation = () => any | Promise<any>

/**
 * A way a queue can depend on another queue.
 */
export enum DependencyMode {

  /**
   * The dependent queue will wait for all operations in the other queue to finish before starting. If new operations
   * are added to the dependency, this will block the current queue as well. If two queues depend on each other like
   * this, it will cause deadlocks.
   */
  WaitAll,

  /**
   * The dependent queue will wait for the current operation in the other queue to finish before starting. If new
   * operations are added to the dependency, this queue will not wait for those to finish. In this mode, two queues
   * can depend on each other without causing deadlocks, but rather behave as one queue.
   */
  WaitCurrent,

  /**
   * Same as {@link WaitCurrent}, but in this case, the current queue is also added as a {@link WaitCurrent} dependency
   * of the other queue. This essentially creates a single synchronous queue that will run all operations in order.
   *
   * This becomes useful in the case of queues that are used to synchronize access to a resource, in combination with
   * a single queue that is used to access some dependency of that resource.
   *
   * For instance, let's say you use two operation queues to synchronize access to two files, but you also need to
   * do stuff with the directory. You can then create a third operation queue to synchronize access to the directory,
   * where you set up the following dependencies:
   *
   * - *File A* `   <-- interleaves -->   ` *Directory*
   * - *File B* `   <-- interleaves -->   ` *Directory*
   *
   * There is no reason for the file queues to be interleaving each other, as those files are independent. However,
   * the directory queue should be interleaving the file queues, as it needs to wait for the file queues to finish.
   *
   * Looking at this sequentially, this is how the operations would be enqueued.
   *
   * ```
   *
   *  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
   *  │    File A     │    │    File B     │    │   Directory   │
   *  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
   *          │                    │                    │
   *  ┌───────┴───────┐    ┌───────┴───────┐            │
   *  │ Operation A1  │◄⋯⋯⋯│ Operation B1  │⋯⋯⋯⋯⋯⋯⋯⋯⋯┐  │
   *  └───────┬───────┘    └───────┬───────┘         ┋  │
   *          │                    │            ┌────┴──┴────────┐
   *          │                    │            │ Operation dir │
   *          │                    │            └───────┬────────┘
   *  ┌───────┴───────┐    ┌───────┴───────┐         ▲
   *  │ Operation A2  │⋯⋯⋯⋯│ Operation B2  ├⋯⋯⋯⋯⋯⋯⋯⋯⋯┘
   *  └───────┬──────┬┘    └───────┬───────┘
   *
   * ```
   *
   * I.e. the directory operation depends on Operation A1 and Operation B1. Operation A2 and Operation B2 depend on
   * the directory operation. However, operations on file A and B don't depend on each other.
   */

  Interleave

}
