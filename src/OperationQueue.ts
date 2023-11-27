import Semaphore from 'semaphore'
import { DependencyMode, Operation } from './types'

export default class OperationQueue {

  // #region Dependencies

  private readonly dependencies = new Map<OperationQueue, DependencyMode>()

  /**
   * Adds another queue as a dependency of this queue. This will cause this queue to wait for the other
   * queue. See {@link DependencyMode} for more info.
   *
   * Note that each queue can only exist once as a dependency. That means that if you add the same queue
   * again, the mode will be overwritten with the last mode specified.
   *
   * @param queue The queue to add as a dependency.
   * @param mode The dependency mode.
   */
  public addDependency(queue: OperationQueue, mode: DependencyMode) {
    this.dependencies.set(queue, mode)
    if (mode === DependencyMode.Interleave) {
      queue.dependencies.set(this, mode)
    }
  }

  // #endregion

  // #region Operations

  private operations: OperationEntry[] = []

  public enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.push(operation, resolve, reject)
    })
  }

  public clear() {
    this.operations = []
    this.suspend()
  }

  private push<T>(operation: Operation, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) {
    this.operations.push([operation, resolve, reject])
    this.resume()
  }

  // #endregion

  // #region Scheduling

  private _suspended: boolean = true
  public get isRunning() {
    return !this._suspended
  }

  public resume() {
    if (!this._suspended) { return }
    this._suspended = false

    this.runNext()
  }

  public suspend() {
    if (this._suspended) { return }
    this._suspended = true
  }

  // #endregion

  // #region Running

  private currentSemaphore = new Semaphore({signalled: true})
  private allSemaphore = new Semaphore({signalled: true})

  private async runNext() {
    // Dequeue the next operation.
    const entry = this.operations.shift()

    // If there is no next operation, signal done.
    if (entry == null) {
      this.allSemaphore.signal()
      this.suspend()
      return
    }

    // Reset all semaphores.
    this.currentSemaphore.reset()
    this.allSemaphore.reset()

    // Before moving on, make sure all dependencies are done.
    const dependencies = Array.from(this.dependencies)
    await Promise.all(dependencies.map(async ([dependency, mode]) => {
      if (mode === DependencyMode.WaitAll) {
        await dependency.all()
      } else {
        await dependency.current()
      }
    }))

    await this.run(entry)
    this.currentSemaphore.signal()
    this.runNext()
  }

  private async run(entry: OperationEntry) {
    const [operation, resolve, reject] = entry
    await Promise.resolve(operation()).then(resolve, reject)
  }

  public async current() {
    // Do this extra check, because `await` always runs asynchronously. In our case, to prevent deadlocks, we
    // need to allow the called to continue synchronously if the current semaphore is green.
    if (this.currentSemaphore.isSignalled) { return }
    await this.currentSemaphore
  }

  public all() {
    // Do this extra check, because `await` always runs asynchronously. In our case, to prevent deadlocks, we
    // need to allow the called to continue synchronously if the all semaphore is green.
    return this.allSemaphore
  }

  // #endregion

}

type OperationEntry = [Operation, (value: any | PromiseLike<any>) => void, (reason?: any) => void]
