#!/usr/bin/env node

let { extname, join } = require('path')
let { promisify } = require('util')
let posthtml = require('posthtml')
let mqpacker = require('css-mqpacker')
let Bundler = require('parcel-bundler')
let postcss = require('postcss')
let fs = require('fs')

let writeFile = promisify(fs.writeFile)
let readFile = promisify(fs.readFile)
let copyFile = promisify(fs.copyFile)
let unlink = promisify(fs.unlink)

const ROOT_INDEX = join(__dirname, 'dist', 'index.html')

function findAssets (bundle) {
  return Array.from(bundle.childBundles).reduce((all, i) => {
    return all.concat(findAssets(i))
  }, [bundle.name])
}

let bundler = new Bundler(join(__dirname, 'index.html'), {
  sourceMaps: false
})

let bundlerJs = new Bundler(join(__dirname, 'src', 'main.js'), {
  scopeHoist: true,
  sourceMaps: false
})

async function build () {
  await bundlerJs.bundle()
  let bundle = await bundler.bundle()
  let assets = findAssets(bundle)
  let jsFile = join(__dirname, 'dist', 'main.js')
  let cssFile = assets.find(i => extname(i) === '.css')
  let srcJsFile = assets.find(i => /main\..*\.js/.test(i))

  let [css, js] = await Promise.all([
    readFile(cssFile).then(i => i.toString()),
    readFile(jsFile).then(i => i.toString()),
    unlink(srcJsFile)
  ])

  js = js
    .replace('function () ', '()=>')
    .replace(/};}\)\(\);$/, '}})()')

  await Promise.all([
    unlink(cssFile),
    // unlink(jsFile)
  ])

  css = postcss([mqpacker]).process(css, { from: cssFile }).css

  function htmlPlugin (tree) {
    tree.match({ tag: 'link', attrs: { rel: 'stylesheet' } }, () => {
      return { tag: 'style', content: css }
    })

    tree.match({ tag: 'script' }, i => {
      if (i.content && i.content[0].indexOf('navigator.language') !== -1) {
        return { tag: 'script', content: i.content[0].replace('/index.html', '') }
      } else if (i.attrs.src && i.attrs.src.indexOf('/main.') !== -1) {
        return { tag: 'script', attrs: { src: '/main.js', defer: true } }
      } else {
        return i
      }
    })

    tree.match({ tag: 'a', attrs: { href: /^\/\w\w\/index.html$/ } }, i => {
      return {
        tag: 'a',
        content: i.content,
        attrs: { ...i.attrs, href: i.attrs.href.replace('/index.html', '') }
      }
    })

    tree.match({ attrs: { class: true } }, i => {
      return {
        tag: i.tag,
        content: i.content,
        attrs: {
          ...i.attrs,
          class: i.attrs.class
            .split(' ')
            .map(kls => {
              if (!classes[kls]) {
                process.stderr.write(`Unused class .${ kls }\n`)
                process.exit(1)
              }
              return classes[kls]
            })
            .join(' ')
        }
      }
    })
  }

  assets
    .filter(i => extname(i) === '.html'/* && i !== ROOT_INDEX*/)
    .forEach(async i => {
      let html = await readFile(i)
      await writeFile(i, posthtml().use(htmlPlugin).process(html, { sync: true }).html)
    })
}

build().catch(e => {
  process.stderr.write(e.stack + '\n')
  process.exit(1)
})