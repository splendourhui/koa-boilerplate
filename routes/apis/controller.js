const generateToken = require('../../middlewares/auth_check').generateToken;

exports.test = async (ctx, next) => {
  ctx.body = ctx.csrf;
};

exports.login = async (ctx, next) => {
  const token = generateToken();
  ctx.cookies.set('token', token);
  ctx.status = 200;
};