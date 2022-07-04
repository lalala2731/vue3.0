// 只针对某个具体的包打包

const fs = require('fs')
const execa = require('execa')//开启子进程 进行并行打包，使用rollup打包

const target = 'runtime-core'

build(target)

// 对目标进行依次打包，并行打包
async function build(target) {
    //使用rollup打包，执行的参数：使用配置文件 设置环境变量拿到target 
    // -cw 动态打包
    await execa('rollup', ['-cw', '--environment', `TARGET:${target}`],
        { stdio: 'inherit' }) // 让子进程打包的信息共享给父进程
}

// 写好脚本文件后，使用yarn install将packages下的所有包
// 链接到node_modules中去，名字就是在package.json中的
// @vue/...中的@vue