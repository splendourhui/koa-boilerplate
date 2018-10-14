const authCheck = require('../../middlewares/auth_check').authCheck;
const ctrl = require('./controller');

module.exports = router => {
  router.get('/test', ctrl.test);
  router.post('/login', ctrl.login);
};