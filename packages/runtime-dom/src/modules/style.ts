export const patchStyle = (el: Element, prev, next) => {
    const style = (el as HTMLElement).style // 获取样式
    if (next == null) {
        el.removeAttribute('style') //{style:{color} } {style:{} }
    } else {
        // render里面的style传的是一个对象，不能随便替换

        // 老的里有新的里没有
        if (prev) {
            for (let key in prev) {
                if (next[key] == null) {
                    style[key] = '' //老的里有新的里没有需要删除
                }
            }
        }

        // 新的里面的需要添加到style上
        for (let key in next) {
            style[key] = next[key]
        }

    }

}