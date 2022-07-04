import { isFunction, isObject, ShapeFlags } from "@vue/shared"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance"

export function createComponentInstance(vnode) {
    // webComponent 规定组件要有属性和插槽

    const instance = {
        vnode,
        type: vnode.type,// type就是创建时候得rootComponent，用户写的对象
        props: {}, //props和attrs的区别 传的参数，接收是props，未接收时attrs？
        attrs: {},
        slots: {},
        ctx: {},
        setupState: {}, // 如果setup返回一个对象，这个对象会作为setupState
        isMounted: false, // 表示这个组件是否挂载过   组件实例启动的标识
        render: null,
        data: { a: 1 }
    }
    instance.ctx = { _: instance } // instance.ctx._ 指向的也是实例，会代理
    return instance
}

export function setupComponent(instance) {
    const { props, children } = instance.vnode

    // 根据props解析出props和attrs，将其放到instance上
    instance.props = props // 判断props和attrs的区别，initProps()
    instance.children = children // 插槽的解析 initSlot()

    // 需要先看下当前组件是不是有状态的组件，因为有可能是函数组件

    let isStateful = instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
    if (isStateful) { // 表示现在是一个带状态的组件
        // 调用 当前实例的setup方法，用setup的返回值填充setupState和对应的render

        setupStatefulComponent(instance)
    }

}

export let currentInstance = null// 当前的实例

// 设置当前实例
export let setCurrentInstance = (instance) => {
    currentInstance = instance
}

// 在setup中获取当前实例
export let getCurrentInstance = () => {
    return currentInstance
}


function setupStatefulComponent(instance) {
    // 1.代理 传递给render函数的参数 不管数据在stateupState、data、props上，统统代理到render（proxy）上，方便取值
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers as any)// 为了统一变量，生产环境和开发环境功能不同

    // 2.获取组件的类型 拿到组件的setup方法
    // type就是创建时候得rootComponent，用户写的对象 App
    let Component = instance.type
    let { setup } = Component
    // debugger
    // --- 没有setup？没有render？---

    if (setup) {
        currentInstance = instance
        // setup的上下文是创造出来的一个新的对象
        let setupContext = createSetupContext(instance)
        const setupResult = setup(instance.props, setupContext)// instance 中 props attrs slots emit expose 会被提取出来，因为在开发的过程中会使用这些属性
        currentInstance = null
        // 判断setup的返回值，有可能是一个函数，有可能是一个对象
        handleSetupResult(instance, setupResult) // setup里的render函数优先成为render函数

    } else {
        finishComponentSetup(instance) // 完成组件的启动
    }


    // Component.render(instance.proxy)
}

function handleSetupResult(instance, setupResult) {
    if (isFunction(setupResult)) {
        instance.render = setupResult
    } else if (isObject(setupResult)) {
        instance.setupState = setupResult
    }
    finishComponentSetup(instance)
}

function finishComponentSetup(instance) {
    // render要不在setup中（setup存在），要不在component（App）中
    let Component = instance.type
    if (!instance.render) {
        // 对template 模板进行编译 产生render函数
        // instance.render=render
        if (!Component.render && Component.template) {
            // 编译template，将结果赋予Component.render
        }
        instance.render = Component.render
    }

    // 对vue2.x进行兼容处理
    // applyOptions
}

function createSetupContext(instance) {
    return { // instance的一些东西会提取到context中
        attrs: instance.attrs,
        // props: instance.props,
        slots: instance.slots,
        emit: () => { },
        expose: () => { }
    }
}


// instance 表示的组件的状态 各种各样的状态，组件的相关信息
// context 就四个参数（生产环境），为了开发时使用
// proxy 主要为了取值方便 -> proxy.xx 代理