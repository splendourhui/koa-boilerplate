const logfilestream = require('logfilestream');
const chalk = require('chalk');
const path = require('path');

const STYLES = chalk.styles;
const LOG_TYPES = [{
  type: 'log',
  color: 'white'
}, {
  type: 'error',
  color: 'red'
}, {
  type: 'info',
  color: 'green'
}, {
  type: 'warn',
  color: 'yellow'
}];

// 错误信息格式化
const error2string = err => {
  if (err.stack) {
    return err.stack.replace(/^/gm, '  ') + '\n\n';
  }
  return err.toString();
};

// 日志打印类
class LoggerFactory {
  constructor(options) {
    this.logDir = options.logdir || './logs';
    this.env = options.env || process.env.NODE_ENV || 'development';
    this.writeStream = logfilestream({
      logdir: this.logDir,
      nameformat: `[${this.env}.]YYYY-MM-DD[.log]`,
      mkdir: true
    });
  }

  _write(str) {
    /** 先打印出来 */
    console.log(str);
    this.writeStream.write(str + '\n');
  }

  // 颜色转换
  _renderColor(str) {
    return str.replace(/\{\{([#\/])([^}]+)\}\}/g, ($0, $1, $2) => {
      if (!STYLES[$2]) return $0;

      if ($1 === '#') return STYLES[$2].open;
      if ($1 === '/') return STYLES[$2].close;
    });
  }

  _generateLogger(cache) {
    const logger = {};

    LOG_TYPES.forEach(typeObj => {
      logger[typeObj.type] = msg => {
        if (!msg) return;
        try {
          // 标签颜色转换
          msg = this._renderColor(msg);
          // 当前日志类型的总颜色转换
          msg = chalk[typeObj.color](msg);

        } catch (err) {
          const errorColor = LOG_TYPES.find(item => item.type === 'error').color;
          msg = chalk[errorColor](error2string(err));
        }
        if (cache) {
          cache.push(msg);
        } else {
          this._write(msg);
        }
      };
    });

    if (cache) {
      // 一次性把缓存的日志打印出来
      logger.flush = () => {
        cache.forEach(msg => {
          this._write(msg);
        });
      };
    }

    return logger;
  }

  generate(cache) {
    return this._generateLogger(cache);
  }
}

let libLoggerInstance;

let logdir;
let env;
let skipStatic;

const STATIC_EXT = /(.css)|(.gif)|(.html)|(.ico)|(.jpeg)|(.jpg)|(.js)|(.json)|(.pdf)|(.png)|(.svg)|(.swf)|(.tiff)|(.txt)|(.wav)|(.wma)|(.wmv)|(.xml)/;
const isStatic = url => {
  const trueUrl = url.replace(/\?.*/ig, '');
  const ext = path.extname(trueUrl);
  return STATIC_EXT.test(ext);
};

const time = start => {
  const delta = new Date().getTime() - start;
  return delta < 10000 ? delta + 'ms' : Math.round(delta / 1000) + 's';
};

const filter = async (ctx, next) => {
  // 记录基础的请求时间,跳过静态资源
  // 参考koa-logger
  const start = new Date().getTime();
  const logsMemory = []; // logs缓存，打log不会真的输出，而是记录

  ctx.logger = libLoggerInstance.generate(logsMemory);

  // 打印请求基本信息，包括参数
  if (!isStatic(ctx.url) || (isStatic(ctx.url) && !skipStatic)) {
    ctx.logger.log(`Started ${ctx.method}   ${ctx.url} for ${ctx.ip} at ${new Date()}`);
    ctx.query && ctx.logger.info(`  query: ${JSON.stringify(ctx.query)}`);
    ctx.request.fields && ctx.logger.info(`  body: ${JSON.stringify(ctx.request.fields)}`);
  }

  try {
    await next();
  } catch (err) {
    ctx.logger.error(error2string(err));
    ctx.logger.flush();

    // 告诉全局的error监控，此错误已经处理过了
    err.hasHandled = true;
    // 抛出去 方便其他程序监控
    ctx.throw(err);
  }

  // 静态资源直接return
  if (isStatic(ctx.url) && skipStatic) return;
  const res = ctx.res;

  // 监听请求的 finish 和 close 事件，任何一个事件触发，视为请求结束，把缓存的日志全部输出
  const onfinish = done.bind(null, 'finish');
  const onclose = done.bind(null, 'close');
  res.once('finish', onfinish);
  res.once('close', onclose);

  function done(event) {
    res.removeListener('finish', onfinish);
    res.removeListener('close', onclose);

    ctx.logger.log(`Completed in ${time(start)}  ${ctx.status}

`);
    ctx.logger.flush();
  }
};

const record = (app, options) => {
  options = options || {};

  logdir = options.logdir || path.join('./', 'logs');
  env = options.env || process.env.NODE_ENV || 'development';
  skipStatic = options.skipStatic || true;

  libLoggerInstance = new LoggerFactory({
    logdir,
    env
  });

  // 生成一个全局的 logger，用于随时打印
  const globalLogger = libLoggerInstance.generate();
  // 重置错误消息处理
  // koa 如果发现没有监听 error 事件，会默认生成一个所有错误打到 console 的错误处理。
  // 我们要重置掉。
  app.on('error', err => {
    if (!err.hasHandled) {
      globalLogger.error(error2string(err));
    }
  });

  // 暴露logger到全局
  if (options.exportGlobalLogger) {
    global['logger'] = globalLogger;
  }

  return filter;
};

module.exports = record;