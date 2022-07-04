export const patchClass = (el: Element, value) => {// 不需要prevValue，直接把next的值给上就好
    if (value == null) {
        el.removeAttribute('class')
    } else {
        el.className = value
    }

}