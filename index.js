const os = require('os')
const fs = require('fs')
const path = require('path')
const Koa = require('koa2')
const KoaRouter = require('koa-router')
const bodyParser = require('koa-body')
const PassThrough = require('stream').PassThrough
const serve = require('koa-static')

const app = new Koa()
const router = new KoaRouter()
app.use(bodyParser({multipart: true}))
app.use(serve('static'))

// 记录已上传文件md5，为秒传做准备
let tmpDir = path.join(__dirname, `./uploadTmp`)
let uploadDir = path.join(__dirname, `./upload/`)
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir)
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

// Demo中只将文件MD5存于内存中，实际可以以(文件名，md5)对应，记录数据库
// 查询一次目录
let fileMd5List = fs.readdirSync(uploadDir)
// 接收文件分片
router.post('/uploadChunk', async (ctx, next) => {
  const md5 = ctx.request.body.fields.md5
  // chunk总数
  const total = parseInt(ctx.request.body.fields.total)
  // 当前chunk
  const current = parseInt(ctx.request.body.fields.current)
  // file
  const file = ctx.request.body.files.file
  // 保存分片
  if (current < total) {
    // 分片存储路径
    let tmpPath = path.join(tmpDir, md5)
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath)
    }
    // 创建读写流
    const reader = fs.createReadStream(file.path);
    const stream = fs.createWriteStream(path.join(tmpPath, current + ''));
    reader.pipe(stream);
    ctx.body = await new Promise(function (resolve, reject) {
      // 流关闭时返回
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
      // 断点续传,因为只做了单点上传，所以此处只检测了文件个数就可以判断下一个分片
      //
      let files = fs.readdirSync(path.join(tmpDir, md5))
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
  let filePath = path.join(uploadDir, md5)
  // 原始文件名，用来存数据库
  console.log('原始文件名: ', name)
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
router.get('/download/:md5', async (ctx, next) => {
  let md5 = ctx.params.md5
  let filePath = path.join(uploadDir, md5)
  let fsStat = fs.statSync(filePath)
  if (fsStat.isFile()) {
    let reader = fs.createReadStream(filePath)
    // 若文件名存数据库，则从数据库取得文件名
    ctx.set('Content-disposition', 'attachment; filename=filename');
    ctx.set('Content-Length', fsStat.size);
    console.log(ctx.response.headers)
    ctx.body = reader.on('error', ctx.onerror).pipe(PassThrough())
  } else {
    ctx.throw(404)
  }
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(3456, () => {
  console.log('app listening port 3456!')
})

