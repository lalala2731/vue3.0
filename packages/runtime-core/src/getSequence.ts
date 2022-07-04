// 贪心算法 + 二分查找
// 如果当前的比结果集中的最后一个大，就插到结果集的最后一个
// 如果比结果集的最后一个小，就插到结果集中第一个比它答的元素的位置，将其替换掉


// let arr = [1, 2, 3, 4, 0, 5]
// let arr = [2, 3, 1, 5, 6, 8, 7, 9, 4] // 最长递增子序列
// 值：     1 3 4 6 7 9
// 索引:    2 1 8 4 6 7
// 应为:值: 2 3 5 6 7 9
// 每次放入值的时候，都知道当前   最小的结尾（它前面那个值和索引） ，即使是替换值，就把它要替换的值的最小的结尾（前一个值的索引）告诉他


export function getSequence(arr) { // 最终输出的  索引
    const len = arr.length
    const result = [0] // 索引  递增的序列用二分查找性能高
    let start
    let end
    let middle
    const p = arr.slice(0) // 里面内容无所谓  和原来的数组相同  用来存放索引
    for (let i = 0; i < len; i++) {
        const arrI = arr[i]
        if (arrI !== 0) {
            let resultLastIndex = result[result.length - 1]
            // 取到索引对应的值      ------当前的值比结果集的最后一个数大-------
            if (arr[resultLastIndex] < arrI) {
                p[i] = resultLastIndex // 标记当前前一个对应的索引
                result.push(i)
                continue
            }

            // 二分查找 找到比当前值大的那一个     ------当前的值比结果集的最后一个数小-------
            start = 0
            end = result.length - 1
            while (start < end) {// 重合就说明找到了对应的值
                middle = ((start + end) / 2) | 0 // Math.floor

                if (arr[result[middle]] < arrI) {
                    start = middle + 1 // 移动边界
                } else {
                    end = middle // 移动边界
                }
            }
            // 循环结束，start = end，为找到的正确的位置
            if (arrI < arr[result[start]]) { // 如果相同 或者比当前的还大就不换了

                if (start > 0) { // 只有后面的才记录 替换的是第一个，他前面没有，就不记录
                    p[i] = result[start - 1] // 要将他替换的前一个记住
                }

                result[start] = i
            }

        }
    }


    let len1 = result.length // 总的个数
    let last = result[len1 - 1]
    while (len1-- > 0) { // 根据前驱节点一个个向前查找
        result[len1] = last
        last = p[last]
    }
    return result
}


// console.log(getSequence([5,3,4,0]));
