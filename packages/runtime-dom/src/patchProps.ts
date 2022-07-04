// 这里面针对的是属性操作，一系列的属性操作

import { patchAttr } from "./modules/attr"
import { patchClass } from "./modules/class"
import { patchEvent } from "./modules/events"
import { patchStyle } from "./modules/style"

export const patchProp = (el, key, prevValue, nextValue) => {
    switch (key) {
        case 'class': // 对比属性
            patchClass(el, nextValue)
            break
        case 'style':
            patchStyle(el,prevValue,nextValue)
            break
        default:
            if (/^on[^a-z]/.test(key)) { // on1 onA都可以
                patchEvent(el,key,nextValue) // 添加 删除 修改
            } else { // 如果不是事件，才是属性
                patchAttr(el, key, nextValue)
            }
            break
    }
}