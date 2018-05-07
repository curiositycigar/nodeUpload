const os = require('os')
const fs = require('fs')
const path = require('path')
const Koa = require('koa2')
const KoaRouter = require('koa-router')
const bodyParser = require('koa-body')
const serve = require('koa-static')

const app = new Koa()
const router = new KoaRouter()
app.use(bodyParser({multipart: true}))
app.use(serve('static'))

let fileMd5List = []
let tmpDir = path.join(__dirname, `./uploadTmp`)
let uploadDir = path.join(__dirname, `./upload/`)

router.post('/uploadChunk', async (ctx, next) => {
  const md5 = ctx.request.body.fields.md5
  // chunk总数
  const total = parseInt(ctx.request.body.fields.total)
  // 当前chunk
  const current = parseInt(ctx.request.body.fields.current)
  // file
  const file = ctx.request.body.files.file
  console.log(md5, current, total)
  if (current < total) {
    let tmpPath = path.join(tmpDir, md5)
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath)
    }
    const reader = fs.createReadStream(file.path);
    const stream = fs.createWriteStream(path.join(tmpPath, current + ''));
    reader.pipe(stream);
    ctx.body = await new Promise(function (resolve, reject) {
      reader.on('close', function () {
        resolve({
          status: true,
          current: current + 1
        })
      })
    })
  } else {
    ctx.body = {
      status: false,
      error: '文件分片出错!'
    }
  }
})

router.post('/checkFile', async (ctx, next) => {
  let md5 = ctx.request.body.md5
  if (fileMd5List.indexOf(md5) !== -1) {
    // 文件存在
    ctx.body = {
      status: false
    }
  } else {
    try {
      fs.accessSync(path.join(tmpDir, md5))
      // 断点续传
      let files = fs.readdirSync(path.join(tmpDir, md5))
      console.log(files)
      ctx.body = {
        status: true,
        current: files.length
      }
    } catch (e) {
      ctx.body = {
        status: true,
        current: 0
      }
    }
  }
})
router.post('/finishUpload', async (ctx, next) => {
  let name = ctx.request.body.name
  let total = ctx.request.body.total
  let md5 = ctx.request.body.md5
  let tmpPath = path.join(tmpDir, md5)
  let filePath = path.join(uploadDir, md5 + name)
  fileMd5List.push(md5)
  for (let i = 0; i < total; i++) {
    let content = fs.readFileSync(path.join(tmpPath, i + ''))
    fs.appendFileSync(filePath, content)
  }
  ctx.body = {
    status: true,
    data: '上传成功!'
  }
  console.log('文件写入完成！')
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(3456, () => {
  console.log('app listening port 3456!')
})

