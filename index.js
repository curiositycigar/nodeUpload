const os = require('os')
const fs = require('fs')
const Koa = require('koa2')
const KoaRouter = require('koa-router')
const bodyParser = require('koa-body')
const serve = require('koa-static')

const app = new Koa()
const router = new KoaRouter()
app.use(bodyParser({multipart: true}))
app.use(serve('static'))

let fileMd5List = []
let files = {}

router.post('/uploadChunk', async (ctx, next) => {
  const md5 = ctx.request.body.md5
  // chunk总数
  const total = ctx.request.body.total
  // 当前chunk
  const current = ctx.request.body.current
  // file
  console.log(ctx.request.body.file)
  const file = Buffer.from(ctx.request.body.file)
  if (current !== total) {
    const reader = fs.createReadStream(file);
    const stream = fs.createWriteStream(`./uploadTmp/${md5}/${current}`);
    reader.pipe(stream);
    ctx.body = {
      status: true,
      current: current + 1
    }
  } else {
    // 上传完毕
  }
})
router.post('/upload', async (ctx, next) => {
  console.log(ctx.request.body.files)
  const file = ctx.request.body.files.file;
  const reader = fs.createReadStream(file.path);
  const stream = fs.createWriteStream(path.join('./', Math.random().toString() + file.name));
  reader.pipe(stream);
  console.log('uploading %s -> %s', file.name, stream.path);
  ctx.body = ctx.request.body
})
router.post('/checkFile', async (ctx, next) => {
  let md5 = ctx.request.body.md5
  if (fileMd5List.indexOf(md5) !== -1) {
    ctx.body = {
      status: true
    }
  } else {
    ctx.body = {
      status: false
    }
  }
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(3456, () => {
  console.log('app listening port 3456!')
})

