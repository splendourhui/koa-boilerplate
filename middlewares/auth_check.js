const uuid = require('uuid');

// 存储 access-token
let store;

// 保证全局只有一个 store
store = global['store'] || {};
global['store'] = store;

// 判断 token 是否有效
const isValidToken = token => {
  if (!token) return false;
  const expires = store[token];
  if (!expires) return false;
  return expires > new Date().getTime();
};

// 生成一个 token，有效期 4 小时
exports.generateToken = () => {
  const token = uuid();
  store[token] = new Date().getTime() + 1000 * 60 * 60 * 4;
  return token;
};

// 接口权限校验
// 为了示例，这里用了内存来存储和校验 token，生产环境需要切换为缓存或数据库
exports.authCheck = async (ctx, next) => {
  const token = ctx.cookies.get('token');
  if (!isValidToken(token)) {
    return ctx.body = {
      status: 401,
      message: 'UnAuthorized'
    };
  } else {
    await next();
  }
};