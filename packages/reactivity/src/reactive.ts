import { isObject } from "@vue/shared"
import {
    mutableHandlers,
    shallowReactiveHandlers,
    readonlyHandlers,
    shallowReadonlyHandlers
} from './baseHandlers'

// reactive.ts只处理响应式，其余的放到各自的功能文件中处理
// const mutableHandlers={}
// const shallowReactiveHandlers={}
// const readonlyHandlers={}
// const shallowReadonlyHandlers={}

export function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers)
}

export function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers)
}

export function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers)
}

export function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers)
}

// 四个方法的区别仅为 是不是深度 是不是仅读 
// 想通过一个方法通过传入不同的参数处理不同的逻辑 柯里化
// 最核心的是 拦截数据的获取和修改（get set） 与new Proxy相似

// 建立映射表 存储已经被代理过的对象
const reactiveMap = new WeakMap() //会自动垃圾回收，不会造成内存泄漏 存储的key只能是对象
const readonlyMap = new WeakMap()


export function createReactiveObject(target, isReadonly, baseHandlers) {
    // 如果目标不是对象，没法拦截了，reactive只能拦截对象类型
    if (!isObject(target)) {
        return target
    }
    // 如果某个对象已经被代理过了，就不要再代理了，所以做了一个映射表
    // 可能一个对象既被深度代理 又被仅读代理

    const proxyMap = isReadonly ? readonlyMap : reactiveMap

    const existProxy = proxyMap.get(target)
    if (existProxy) {
        return existProxy// 如果已经被代理了，直接返回即可
    }

    const proxy = new Proxy(target, baseHandlers)
    proxyMap.set(target, proxy) //将要代理的对象和对应代理结果缓存起来

    return proxy
}

// 如果let p=new Proxy()
// let p1=new Proxy(p)// 应该在设置值的时候做校验或者避免写出这种代码
