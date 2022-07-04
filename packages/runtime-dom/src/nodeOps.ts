export const nodeOps = {
    // createElement,不同的平台创建元素的方式不同
    // 现只考虑浏览器

    createElement: tagName => document.createElement(tagName),// 增加
    remove: child => { // 删除
        const parent = child.parentNode
        if (parent) {
            parent.removeChild(child)
        }
    },
    insert: (child, parent, anchor = null) => { // 插入
        parent.insertBefore(child, anchor) // 如果参照物为空，则相当于appendChild
    },
    querySelector: selector => document.querySelector(selector),// 查找
    setElementText: (el, text) => el.textContent = text, // 设置元素的内容 innerHTML有隐患

    // 文本操作 创建文本
    createText: text => document.createTextNode(text),
    setText: (node, text) => node.nodeValue = text,
    nextSibling: (node) => node.nextSibling

    // textContent是元素的内容，nodeValue是文本节点的内容
}