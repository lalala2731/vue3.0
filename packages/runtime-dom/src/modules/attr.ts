export const patchAttr = (el: Element, key, value) => {
    if (value == null) {
        el.removeAttribute(key)
    } else {
        el.setAttribute(key,value)
    }
}