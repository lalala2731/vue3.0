import { effect } from "@vue/reactivity"
import { ShapeFlags } from "@vue/shared"
import { createAppApi } from "./apiCreateApp"
import { createComponentInstance, setupComponent } from "./component"
import { queueJob } from "./scheduler"
import { normalizeVNode, Text } from "./vnode"
import { getSequence } from './getSequence'
import { invokeArrayFns } from "./apiLifecycle"

export function createRenderer(rendererOptions) {

    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        setText: hostSetText,
        setElementText: hostSetElementText,
        nextSibling: hostNextSibling,
    } = rendererOptions

    //#region -----------------------组件↓-----------------------------
    const setupRenderEffect = (instance, container) => {
        // 需要创建一个effect，在effect中调用render方法，这样render方法中拿到的数据会收集这个effect，属性更新的时候effect会重新执行。
        // debugger
        effect(function componentEffect() {
            // 每个组件都有一个effect，vue3是组件级更新，数据变化会重新执行对应组件的effect
            if (!instance.isMounted) {
                // 初次渲染

                let { bm, m } = instance

                if (bm) {
                    invokeArrayFns(bm)
                }
                let proxyToUse = instance.proxy// 代理对象
                // $vnode   _vnode
                // vnode    subTree
                // 组件     组件的渲染内容
                let subTree = instance.subTree = instance.render.call(proxyToUse, proxyToUse)// 在render函数中用到了proxy的某个属性，当此属性已更新，就会重新执行
                // 用render的返回值h(xxx,xxx)继续渲染
                patch(null, subTree, container)

                instance.isMounted = true

                if (m) {// mounted 要求必须在我们自组建完成后才会调用自己。
                    invokeArrayFns(matchMedia)
                }

            } else {
                // 更新逻辑
                // console.log('更新');

                let { bu, u } = instance

                if (bu) {
                    invokeArrayFns(bu)
                }

                const prevTree = instance.subTree
                let proxyToUse = instance.proxy
                const nextTree = instance.render.call(proxyToUse, proxyToUse)
                // console.log(prevTree, nextTree);
                //组件级更新还有点问题

                patch(prevTree, nextTree, container) // 组件级更新，更新组件内部的内容元素element 属性更新更新组件


                if (u) {
                    invokeArrayFns(u)
                }
            }
        }, {
            scheduler: queueJob // 只有trigger的时候，才会条件触发scheduler
        })


    }

    const mountComponent = (initialVNode, container) => {
        // 组件的渲染流程 最核心的就是调用setup拿到返回值，获取render函数返回的结果进行渲染

        // 1.先有实例 根据虚拟节点创建一个实例挂载到虚拟节点上
        // 组件中所有的方法存放在component.ts中
        const instance = (initialVNode.component = createComponentInstance(initialVNode))
        // 2.需要的数据解析到实例上
        setupComponent(instance)
        // 3.创建一个effect，让render执行
        setupRenderEffect(instance, container)


    }

    const processComponent = (n1, n2, container) => {
        // 判断是初始化还是更新节点
        if (n1 == null) { // 组件没有上一次的虚拟节点
            mountComponent(n2, container)
        } else {
            // 组件更新流程
        }
    }
    //#endregion ------------------------------组件↑------------------------



    //#region ------------------------------元素↓------------------------

    const mountChildren = (children, container) => {
        for (let i = 0; i < children.length; i++) {
            // 创建不同的虚拟节点进行多文本内容的处理  如果是元素就直接返回，走挂载元素
            let child = (children[i] = normalizeVNode(children[i]))// 有可能都是文本，那么就会被覆盖，处理方法就是将其转换为虚拟节点。
            // debugger
            // console.log(child);
            // 一定要改children[i],不然无法关联
            patch(null, child, container)
        }
    }

    const mountElement = (vnode, container, anchor = null) => {
        // 递归渲染
        const { props, shapeFlag, type, children } = vnode
        let el = (vnode.el = hostCreateElement(type))

        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key])
            }
        }
        // 处理儿子
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, children)// 文本直接放进去
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) { // 多个儿子:['aaa','bbb']
            // console.log(children);
            // debugger
            mountChildren(children, el)
        }

        hostInsert(el, container, anchor)
    }

    const patchProps = (oldProps, newProps, el) => {
        if (oldProps !== newProps) {
            // 先把新的属性弄到老的属性上
            for (let key in newProps) {
                const prev = oldProps[key]
                const next = newProps[key]
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next)
                }
            }

            // 再把新的没有的从老的上删除 比较老的中有但是新的中没有的key
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null)
                }
            }
        }
    }


    const unmountChildren = (children) => {
        for (let i = 0; i < children.length; i++) {
            unmount(children[i])
        }
    }

    const patchKeyedChildren = (c1, c2, el) => {
        // Vue3 对特殊情况进行优化

        let i = 0// 默认从头开始对比
        let e1 = c1.length - 1
        let e2 = c2.length - 1

        // 尽可能减少比对的区域

        // 1.sync from start 从头开始一个个比，遇到不同的就停止 a b c d e // a b d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i]
            const n2 = c2[i]
            if (isSameVNodeType(n1, n2)) {
                // 深度遍历，遍历属性和孩子
                patch(n1, n2, el)
            } else {
                break
            }

            i++
        }

        // 2.sync from end 从后面开始比 a b c / d e b c
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1]
            const n2 = c2[e2]
            if (isSameVNodeType(n1, n2)) {
                // 深度遍历，遍历属性和孩子
                patch(n1, n2, el)
            } else {
                break
            }
            e1--
            e2--
        }

        // 3.common sequence + mount
        // 比较后 有一方已经完全对比完成了
        // 确定是否是挂载

        // 如果 完成后，最终i的值大于e1， 说明老的少新的多 挂载------------------

        if (i > e1) { //老的少 新的多   --------前提都是有一方已经比对完成了------------多的是从i到e2的部分
            if (i <= e2) {// 表示有新增的部分
                // 找参照物
                const nextPos = e2 + 1
                // 判断是向前插入，还是向后插入
                const anchor = nextPos < c2.length ? c2[nextPos].el : null
                // 找到参照物后，从头（尾）开始每个插到前面去(新的)

                while (i <= e2) {
                    patch(null, c2[i], el, anchor)

                    i++
                }
            }
        } else if (i > e2) {// 老的多，新的少
            while (i <= e1) {
                unmount(c1[i])
                i++
            }
        } else {
            // 乱序比较，需要尽可能的复用
            // 用新的元素做成一个映射表去老的里找，一样的就复用，不一样的要不插入，要不删除

            let s1 = i
            let s2 = i

            // 数组做映射，用老的去新的映射里面查找的时候，会将老的里有的在映射表里做标记
            const toBePatched = e2 - s2 + 1
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0)// （乱序）新节点中的元素在老节点中的位置（+1不是索引而是位置）



            // vue3 用的是---新的---做映射表  vue2用的是老的做映射表
            const keyToNewIndexMap = new Map()

            for (let i = s2; i <= e2; i++) {
                const childVNode = c2[i] // child
                keyToNewIndexMap.set(childVNode.key, i)
            }

            // 去老的里面查找，看有没有复用的
            for (let i = s1; i <= e1; i++) {
                const oldVNode = c1[i]
                let newIndex = keyToNewIndexMap.get(oldVNode.key)
                if (newIndex === undefined) {// 老的里的不在新的里面
                    unmount(oldVNode)
                } else { // 新老的比对,比较完后位置有差异
                    // 新的和旧的关系，索引的关系
                    // 老的里有的会标记上，老的里没有，新的里有的，还是0
                    newIndexToOldIndexMap[newIndex - s2] = i + 1
                    patch(oldVNode, c2[newIndex], el) // patch操作会复用元素 更新属性 比较孩子
                }
            }

            // 最后移动节点，将新增的节点插入
            // [5,3,4,0]=>[1,2],最长递增子序列
            let increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)
            let j = increasingNewIndexSequence.length - 1 // 取出最后一个人的索引
            for (let i = toBePatched - 1; i >= 0; i--) {// 倒序插入
                let currentIndex = i + s2 // 找到h（要新增的节点）的索引
                let child = c2[currentIndex] // 找到h对应的节点
                let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null
                // 第一次插入h后。。

                if (newIndexToOldIndexMap[i] == 0) {// 如果是0，说明没有被patch过
                    patch(null, child, el, anchor)
                } else {
                    // [1,2,3,4,5,6]
                    // [1,6,2,3,4,5] 最长递增子序列
                    // 这样会把所有的节点都移动一遍  希望尽可能的少移动
                    // hostInsert(child.el,el,anchor) // 操作当前的d，以d下一个作为参照物插入（移动位置）

                    // 3 2 1 0
                    // [1,2]
                    if (i != increasingNewIndexSequence[j]) {
                        hostInsert(child.el, el, anchor) // 操作当前的d，以d下一个作为参照物插入（移动位置）
                    } else {
                        j-- // 跳过不需要移动的元素
                    }

                }

            }


            // 最长递增子序列


        }


    }

    const patchChildren = (n1, n2, el) => {// el:父节点
        // console.log(n1,n2,el);

        const c1 = n1.children // 新老儿子
        const c2 = n2.children
        // console.log(c1);

        // 共有如下几种情况
        // 老的有儿子，新的没儿子   老的没儿子新的有儿子   新老都有儿子    新老都是文本

        const prevShapeFlag = n1.shapeFlag// 分别标识儿子的状况
        const shapeFlag = n2.shapeFlag

        // 现在是文本
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            // 1.老的是数组，但是新的是文本
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                // debugger
                unmountChildren(c1) // 如果c1中包含组件会调用组件的销毁方法 c1???老节点的儿子。
            }

            // 2.两个都是文本
            if (c2 !== c1) {
                hostSetElementText(el, c2)
            }
        } else {
            // 现在是元素   上一次有可能是文本 或者数组
            // debugger
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                // 3.老的是数组，新的是数组
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {// 一个元素也会包装成数组 有可能是null？
                    // 当前是数组 之前是数组
                    // 两个数组的对比 -> diff算法--------

                    patchKeyedChildren(c1, c2, el)



                } else { // 4.老的是数组，新的不是数组
                    // 没有孩子 特殊情况 当前是null，删掉老的--------------------------------
                    unmountChildren(c1)
                }
            } else {
                // 上一次是文本
                // 5.上一次是文本
                if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    hostSetElementText(el, '')
                }
                //，现在是数组
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    mountChildren(c2, el)
                }
            }
        }
    }

    const patchElement = (n1, n2, container) => {
        // 走到这里说明元素是相同节点

        // 复用元素节点
        let el = (n2.el = n1.el)
        // 更新属性，更新儿子
        const oldProps = n1.props || {}
        const newProps = n2.props || {}

        patchProps(oldProps, newProps, el)

        patchChildren(n1, n2, el)
    }

    const processElement = (n1, n2, container, anchor) => {
        if (n1 == null) {
            mountElement(n2, container, anchor)
        } else {
            // 元素更新
            patchElement(n1, n2, container)

        }
    }

    //#endregion ------------------------------元素↑------------------------

    // #region 文本
    const processText = (n1, n2, container) => {
        if (n1 == null) {
            // console.log(n1,n2);
            // 创建真实文本节点，需要文本内容，而n2只是一个为了不让两次覆盖掉的中间处理
            hostInsert((n2.el = hostCreateText(n2.children)), container)// 虚拟节点的children上存放的是文本内容 将其转换为文本元素，放在n2的el上

        }
    }
    // #endregion

    const isSameVNodeType = (n1, n2) => { // 如果两个元素标签不一样，直接删除前一个生成新的替换
        return n1.type === n2.type && n1.key === n2.key
    }

    const unmount = (n1) => {// 如果是组件，调用组件的生命周期
        // debugger
        // console.log(n1.el);

        hostRemove(n1.el)

    }


    // 执行核心
    const patch = (n1, n2, container, anchor = null) => {
        // 针对不同类型，做初始化操作

        const { shapeFlag, type } = n2

        // 组件更新
        if (n1 && !isSameVNodeType(n1, n2)) { // 如果两个元素标签不一样，直接删除前一个生成新的替换
            // anchor是为了替换元素找位置时的锚定
            anchor = hostNextSibling(n1.el)
            // n1,n2不是一个类型，就把n1删掉，换成n2
            unmount(n1)
            n1 = null// n1置null，n2不为null，n2走创建流程

        }

        switch (type) {
            case Text: processText(n1, n2, container)
                break
            default:
                if (shapeFlag & ShapeFlags.ELEMENT) { // 元素
                    processElement(n1, n2, container, anchor);

                } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) { // 组件
                    processComponent(n1, n2, container)

                }
                break
        }



    }


    // render方法的作用是渲染一个虚拟节点，将这个虚拟节点挂载到具体的dom元素上，与mount类似？
    const render = (vnode, container) => {
        // core的核心

        // 默认调用render，可能是初始化流程   
        // 先用App 和属性生成一个虚拟节点（组件），调用mounted，render执行，h执行生成又一个虚拟节点（元素）
        patch(null, vnode, container)

    }
    return {
        createApp: createAppApi(render)
    }
}