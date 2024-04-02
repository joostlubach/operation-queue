import OperationQueue from '../OperationQueue.js'
import { DependencyMode } from '../types.js'

describe("OperationQueue", () => {
  let logs: string[]

  beforeEach(() => {
    logs = []
  })

  describe("single queue", () => {
    let queue: OperationQueue

    beforeEach(() => {
      queue = new OperationQueue()
    })

    it("should allow enqueueing an operation", async () => {
      await queue.enqueue(() => log('1'))
      expect(logs).toEqual(['1'])
    })

    it("should return the result value of the operation as a result to .enqueue()", async () => {
      const retval1 = await queue.enqueue(() => 'foo')
      const retval2 = await queue.enqueue(() => Promise.resolve('bar'))
      expect(retval1).toEqual('foo')
      expect(retval2).toEqual('bar')
    })

    it("should run all queued operations sequentially and allow waiting for all operations to be completed", async () => {
      queue.enqueue(() => log('1', 20))
      queue.enqueue(() => log('2', 10))

      await queue.all()
      expect(logs).toEqual(['1', '2'])
    })

    it("should allow waiting for the current operation to be completed", async () => {
      queue.enqueue(() => log('1', 20))
      await queue.current()
      queue.enqueue(() => log('2', 10))
      log('3')

      await queue.all()
      expect(logs).toEqual(['1', '3', '2'])
    })
  })

  describe("queue dependencies", () => {
    let queue1: OperationQueue
    let queue2: OperationQueue

    beforeEach(() => {
      queue1 = new OperationQueue()
      queue2 = new OperationQueue()
    })

    it("should allow waiting for all operations of another queue to be completed", async () => {
      queue1.addDependency(queue2, DependencyMode.WaitAll)
      queue2.enqueue(() => log('2.1'))
      queue1.enqueue(() => log('1.1'))
      queue2.enqueue(() => log('2.2'))

      await queue1.all()
      expect(logs).toEqual(['2.1', '2.2', '1.1'])
    })

    it("should allow waiting for the current operation of another queue to be completed", async () => {
      queue1.addDependency(queue2, DependencyMode.WaitCurrent)
      queue2.addDependency(queue1, DependencyMode.WaitCurrent)
      queue2.enqueue(() => log('2.1'))
      queue1.enqueue(() => log('1.1'))
      queue2.enqueue(() => log('2.2'))

      await queue1.all()
      await queue2.all()
      expect(logs).toEqual(['2.1', '1.1', '2.2'])
    })

    it("should allow specifying some queues to interleave, and some not", async () => {
      const dirQueue = new OperationQueue()
      const fileAQueue = new OperationQueue()
      const fileBQueue = new OperationQueue()

      fileAQueue.addDependency(dirQueue, DependencyMode.Interleave)
      fileBQueue.addDependency(dirQueue, DependencyMode.Interleave)

      // These two run parallel. Use a timeout to ensure order.
      fileAQueue.enqueue(() => log('A1', 40))
      fileBQueue.enqueue(() => log('B1', 20))

      // Then this one runs.
      dirQueue.enqueue(() => log('dir', 40))

      // Finally, these run in parallel again.
      fileAQueue.enqueue(() => log('A1', 10))
      fileBQueue.enqueue(() => log('B1', 20))

      await fileAQueue.all()
      await fileBQueue.all()
      await dirQueue.all()

      expect(logs).toEqual(['B1', 'A1', 'dir', 'A1', 'B1'])
    })
  })

  function log(text: string, after: number = 0) {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        logs.push(text)
        resolve()
      }, after)
    })
  }
})
