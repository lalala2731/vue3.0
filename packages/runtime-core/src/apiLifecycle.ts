import { currentInstance, setCurrentInstance } from "./component"


const enum LifeCycleHooks {
    BEFORE_MOUNT = 'bm',
    MOUNTED = 'm',
    BEFORE_UPDATE = 'bu',
    UPDATED = 'u'
}
// 有可能currentInstance不会，比如mounted，父的会在子的之后执行，但是这时候currentInstance已经执行了子的实例，所以不一定是父的。
// 所以在这里通过闭包将父的currentInstance保存起来了。
const injectHook = (type, hook, target) => {
    if (!target) {
        return console.warn('injection APIs can only be used during execution of setup().')
    } else {
        const hooks = target[type] || (target[type] = [])

        const wrap = () => {
            setCurrentInstance(target)// 设置currentInstance为自己的   this不好推断类型
            hook.call(target)
            setCurrentInstance(null)
        }

        hooks.push(hook)
        return wrap
    }
}


const createHook = (lifecycle) => (hook, target = currentInstance) => {// target用来表示他是哪个实例的钩子

    // 给当前实例增加对应的生命周期
    injectHook(lifecycle, hook, target)

}

export const invokeArrayFns = (fns) => {
    for (let i = 0; i < fns.length; i++) {
        fns[i]()
    }
}

export const onBeforeMount = createHook(LifeCycleHooks.BEFORE_MOUNT) // 还是类似于柯里化
export const onMounted = createHook(LifeCycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifeCycleHooks.BEFORE_MOUNT)
export const onUpdated = createHook(LifeCycleHooks.UPDATED)