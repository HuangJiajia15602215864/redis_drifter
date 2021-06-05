var redis = require('redis');
var client = redis.createClient(), // 创建client客户端
    client2 = redis.createClient(), // 记录用户扔漂流瓶次数
    client3 = redis.createClient() // 记录用户捡漂流瓶次数


// 扔一个漂流瓶
exports.throw = function (bottle, callback) {
    client2.SELECT(2, function () { // 先到 2 号数据库检查用户是否超过扔瓶次数限制
        client2.GET(bottle.owner, function (err, result) { // 获取该用户扔瓶次数
            if (result >= 10) {
                return callback({
                    code: 0,
                    msg: "今天扔瓶子的机会已经用完啦~"
                });
            }
            client2.INCR(bottle.owner, function () { // 扔瓶次数加 1
                client2.TTL(bottle.owner, function (err, _ttl) { // 检查是否是当天第一次扔瓶子;若是，则设置记录该用户扔瓶次数键的生存期为 1 天;若不是，生存期保持不变
                    var ttl = (_ttl === -1) ? 86400 : _ttl;
                    client2.EXPIRE(bottle.owner, ttl);
                });
            });

            bottle.time = bottle.time || Date.now();
            var bottleId = Math.random().toString(16);
            var type = {
                male: 0,
                female: 1
            };
            client.SELECT(type[bottle.type], function () { // 根据漂流瓶类型的不同将漂流瓶保存到不同的数据库
                client.HMSET(bottleId, bottle, function (err, result) {
                    if (err) {
                        return callback({
                            code: 0,
                            msg: "过会儿再试试吧！"
                        });
                    }
                    callback({
                        code: 1,
                        msg: result
                    });
                    client.EXPIRE(bottleId, 86400);
                });
            });
        });
    });
}

// 放回漂流瓶
exports.throwBack = function (bottle, callback) {
    var type = {
        male: 0,
        female: 1
    };
    // 为漂流瓶随机生成一个 id
    var bottleId = Math.random().toString(16);
    // 根据漂流瓶类型的不同将漂流瓶保存到不同的数据库
    client.SELECT(type[bottle.type], function () {
        // 以 hash 类型保存漂流瓶对象
        client.HMSET(bottleId, bottle, function (err, result) {
            if (err) {
                return callback({
                    code: 0,
                    msg: "过会儿再试试吧！"
                });
            }
            // 返回结果，成功时返回 OK
            callback({
                code: 1,
                msg: result
            });
            // 根据漂流瓶的原始时间戳设置生存期
            client.PEXPIRE(bottleId, bottle.time + 86400000 - Date.now());
        });
    });
}

// 捡一个漂流瓶
exports.pick = function (info, callback) {
    client3.SELECT(3, function () {// 先到 3 号数据库检查用户是否超过捡瓶次数限制
        client3.GET(info.user, function (err, result) {// 获取该用户捡瓶次数
            if (result >= 10) {
                return callback({
                    code: 0,
                    msg: "今天捡瓶子的机会已经用完啦~"
                });
            }
            client3.INCR(info.user, function () {// 捡瓶次数加 1
                client3.TTL(info.user, function (err, _ttl) {// 检查是否是当天第一次捡瓶子。若是，则设置记录该用户捡瓶次数键的生存期为 1 天；若不是，生存期保持不变
                    var ttl = (_ttl === -1) ? 86400 : _ttl;
                    client3.EXPIRE(info.user, ttl);
                });
            });
            
            if (Math.random() <= 0.2) {
                return callback({
                    code: 0,
                    msg: "海星"
                });
            }
            var type = {
                all: Math.round(Math.random()), 
                male: 0,
                female: 1
            };
            info.type = info.type || 'all';     
            client.SELECT(type[info.type], function () {// 根据请求的瓶子类型到不同的数据库中取
                client.RANDOMKEY(function (err, bottleId) {
                    if (!bottleId) {
                        return callback({
                            code: 0,
                            msg: "海星"
                        });
                    }
                    client.HGETALL(bottleId, function (err, bottle) {
                        if (err) {
                            return callback({
                                code: 0,
                                msg: "漂流瓶破损了..."
                            });
                        }
                        callback({
                            code: 1,
                            msg: bottle
                        });
                        client.DEL(bottleId);
                    });
                });
            });
        });
    });
}