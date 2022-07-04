// runtime-dom的核心就是  提供domAPI方法
// 操作节点、操作属性的更新

import { createRenderer } from "@vue/runtime-core";
import { extend } from "@vue/shared";
import { nodeOps } from "./nodeOps";// 对象
import { patchProp } from "./patchProps";// 方法

// 节点操作就是增删改查
// 属性操作就是 添加 删除 更新 （样式、类、事件、其他属性）

// 渲染时用到的所有方法
export const rendererOptions = extend({ patchProp }, nodeOps)// 一个是方法，一个是对象，通过extend合并起来。（Object.assign）

// 用户调用的是runtime-dom --> runtime-core
// runtime-dom 是为了解决平台差异

// 迁移到core
// function createRenderer(rendererOptions) {
//     return {
//         createApp(rootComponent, rootProps) {
//             const app = {
//                 mount(container) {
//                     console.log(container,rootComponent,rootProps,rendererOptions);
                    
//                 }
//             }
//             return app
//         }
//     }
// }

// Vue中runtime-core提供了核心的方法，用来处理渲染，他会使用runtime-dom中的api进行渲染
// 把dom层和core层进行分割
export function createApp(rootComponent, rootProps = null) {
    
    // debugger // 两个cerateApp只是为了语义化，外面的这个会调用里面的createApp
    const app = createRenderer(rendererOptions).createApp(rootComponent, rootProps)// core
    let { mount } = app
    app.mount = function (container) {// 如果没有render也没有template，就会把innerHTML当作template
        // 清空容器的操作
        container = nodeOps.querySelector(container)
        container.innerHTML = ''
        mount(container)// 函数劫持 core  结果是proxy，就是instance.proxy,并且在mount中返回出去
        // 将组件渲染成dom元素进行挂载
    }

    return app
}

export * from '@vue/runtime-core'

