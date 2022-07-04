// createVNode 创建虚拟节点

import { isArray, isObject, isString, ShapeFlags } from "@vue/shared"

// h函数也具有创建虚拟节点的功能
// h('div',{style:{color:red}},'children') h方法和createApp类似，h就是createVnode

export function isVnode(vnode) {
    return vnode.__v_isVNode
}

export const createVNode = (type, props, children = null) => {
    // 可以根据type来区分是组件还是普通元素,因为h函数会传入字符串'div'，而createApp就会传入一个App组件，children对于组件来说就是一个插槽。

    // 给虚拟节点加一个类型
    // 用字符串还是对象标识是普通元素还是一个带状态的组件 0就表示啥也不是 1:4:0
    const shapeFlag = isString(type) ? ShapeFlags.ELEMENT : isObject(type) ? ShapeFlags.STATEFUL_COMPONENT : 0

    const vnode = { // 一个对象来描述相应的内容，虚拟节点具有跨平台的能力
        __v_isVNode: true,// 标识是一个VNode节点
        type,
        props,
        children,
        el: null, //稍后会将虚拟节点和真实节点对应起来，更新可能用得到
        key: props && props.key, // diff算法会用到key
        shapeFlag,// 判断出自己的类型和儿子的类型
        component: null // 存放组件对应的实例
    }
    // 处理儿子类型。因为儿子的情况比较多，可能没有儿子，也可能有一个数组的儿子，所以需要描述儿子的类型。儿子也有可能是文本数组插槽
    normalizeChildren(vnode, children)
    return vnode
}

function normalizeChildren(vnode, children) {
    let type = 0
    if (children == null) {

    } else if (isArray(children)) {
        type = ShapeFlags.ARRAY_CHILDREN
    } else {
        type = ShapeFlags.TEXT_CHILDREN
    }
    vnode.shapeFlag |= type // 标识自己和儿子的类型
}


export const Text = Symbol('Text')
export function normalizeVNode(child) {
    if (isObject(child)) return child

    return createVNode(Text, null, String(child))
}

