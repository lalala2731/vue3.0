
let queue = []
export function queueJob(job) { // trigger的scheduler会把当前的effect传过来：effect.options.scheduler(effect)
    // debugger
    if (!queue.includes(job)) { // 去重，向栈里塞effect，
        queue.push(job)
        queueFlush() // 塞一次执行一次，刷新队列
    }
}

let isFlushPending = false// 记录是否在刷新中。
function queueFlush() {
    if (!isFlushPending) {
        isFlushPending = true // 但只有第一次才会走到这
        Promise.resolve().then(flushJobs) // 异步，全部塞完之后顺序执行effect，并将栈清空
    }
}

function flushJobs() {
    isFlushPending = false
    // 清空时 需要根据调用的顺序依次刷新，保证先刷新父元素再刷新子元素

    queue.sort((a, b) => a.id - b.id) // 顺序就是先父后子
    // console.log(queue);
    
    for (let i = 0; i < queue.length; i++) {
        const job = queue[i]
        job()
    }
    queue.length = 0
}
