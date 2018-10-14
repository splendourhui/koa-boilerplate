const Koa = require('koa');
const convert = require('koa-convert');
const koaBody = require('koa-better-body');
const koaCsrf = require('koa-csrf');
const session = require('koa-generic-session');
const logger = require('./utils/logger');
const koaStatic = require('koa-static');
const path = require('path');
const koaRouter = require('koa-router');
const setRouter = require('./routes/apis');

const app = new Koa();

// set the session keys
app.keys = [ 'key1', 'key2' ];

// add session support
app.use(convert(session()));

// add the CSRF middleware
app.use(
  new koaCsrf({
    invalidSessionSecretMessage: 'Invalid session secret',
    invalidSessionSecretStatusCode: 403,
    invalidTokenMessage: 'Invalid CSRF token',
    invalidTokenStatusCode: 403,
    excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
    disableQuery: false
  })
);

// response time header
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set("X-Response-Time", `${ms}ms`);
  console.log(`This request is responsed in ${ms}ms`);
});

// static file server
app.use(koaStatic(path.resolve(__dirname, './public')));

// koa body parser, support file body
app.use(
  convert(
    koaBody({
      patchKa: true,
      jsonLimit: '20mb',
      formLimit: '20mb',
      multipart: true,
      extendTypes: {
        json: ['application/json'],
        multipart: ['multipart/mixed', 'multipart/form-data']
      }
    })
  )
);

app
  // add logger middleware
  .use(
    logger(app, {
      logdir: `./logs`
    })
  );

// Add /apis prefix for every router.
const router = new koaRouter({ prefix: '/apis' });
// Initial router
setRouter(router);
// Register router
app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(3000);
console.log(`Server is listening on 3000`);
