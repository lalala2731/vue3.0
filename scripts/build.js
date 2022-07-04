// 把packages目录下的包全部打包

const fs = require('fs')
const execa = require('execa')//开启子进程 进行并行打包，使用rollup打包


// 找出packages中的包（文件夹）
const targets = fs.readdirSync('packages').filter(f => {
    if (!fs.statSync(`packages/${f}`).isDirectory()) {
        return false
    }
    return true
})

// 对目标进行依次打包，并行打包
async function build(target) {
    //使用rollup打包，执行的参数：使用配置文件 设置环境变量拿到target
    await execa('rollup', ['-c', '--environment', `TARGET:${target}`],
        { stdio: 'inherit' }) // 让子进程打包的信息共享给父进程
}

function runParallel(targets, iteratorFn) {
    const res = []
    for (const item of targets) {
        // 并行打包
        const p = iteratorFn(item)
        res.push(p)
    }
    return Promise.all(res)
}

runParallel(targets, build)