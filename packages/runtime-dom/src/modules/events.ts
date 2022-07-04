/*
    1.给元素缓存一个绑定事件的列表
    2.如果前后都有，直接改变invoke中的value中value属性指向最新的事件即可
    3.如果以前缓存中没有缓存过的，而且value有值，需要绑定方法，并且缓存起来
    4.如果以前绑定过需要删除，解绑事件，删除缓存

*/

export const patchEvent = (el, key, value) => {// vue指令 添加和删除 key:onClick??
    // 对函数的缓存
    const invokers = el._vei || (el._vei = {})// vueEvensInvoker

    const exists = invokers[key]//是否存在
    if (value && exists) { //如果需要绑定事件且存在
        exists.value = value
    } else {
        const eventName = key.slice(2).toLowerCase()// 前两个是on，不需要

        if (value) {// 要绑定事件 以前没有绑定过
            let invoker = invokers[key] = createInvoker(value)//?invoke[key]??
            el.addEventListener(eventName, invoker)
        } else {// 以前绑定了 但是没有value
            el.removeEventListener(eventName, exists)
            invokers[key] = undefined//??key??
        }
    }



}

function createInvoker(value) {
    const invoker = (e) => {
        invoker.value(e)
    }
    invoker.value = value // 为了能够随时更改value属性
    return invoker
}

/*
    一个元素绑定事件 addEventListener（fn1）addEventListener（fn1）
    比如 div @click=fn 后：div @click=fn1
    （）=>value()，修改value的值
    或者原来有，后来没有这个事件了
    对事件进行缓存
*/