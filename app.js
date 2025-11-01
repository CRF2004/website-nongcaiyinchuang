const express = require('express');
const path = require('path');
const app = express();
const port = 8080;
const session = require('express-session');
const {Server} = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));        // 提供静态文件服务，指向 public 文件夹
app.use(express.json());

app.get('/', (req, res) => {                // 定义根路径路由
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.listen(port, () => {
    console.log(`服务器正在运行在 http://localhost:${port}`);// 启动服务器
});

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('clientMessage', (message) => {
        console.log('接收到客户端的消息: ', message);
        
        // 向所有客户端广播消息
        io.emit('serverMessage', message);
    });
    socket.on('disconnect', () => {    // 断开连接时触发
        console.log('一个用户断开连接');
    });
});

const cors = require('cors');
app.use(cors());

const crypto = require('crypto');
const secretKey = crypto.randomBytes(64).toString('hex');
app.use(session({
    secret: secretKey,  // 用于加密 session 的密钥
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 60000 * 30 }  // 设置 cookie 过期时间 (30分钟)
}));

app.get('/about', (req, res) => {
    if (req.session.user && req.session.user.isLoggedIn) {
        // 用户已登录，显示相应内容
        res.render('about', { username: req.session.user.username });
    } else {
        // 用户未登录，重定向到登录页面
        res.redirect('/login');
    }
});

var sql = require('mssql');
const config = {
    server: 'localhost',
    database: 'DBTest1',
    user: 'Server1',
    password: '114514114514000',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};
sql.connect(config)
  .then(pool => {
    return pool.request()
      .query('SELECT* FROM UserTab');
  })
  .then(result => {
    console.log(result.recordset);
  })
  .catch(err => {
    console.error(err);
  });

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let pool = await sql.connect(config);        // 连接数据库
        let result = await pool.request()
            .input('Uname', sql.VarChar, username)
            .query('SELECT Upassword,Uinfo,Umail,Uside FROM UserTab WHERE Uname = @Uname');
        if (result.recordset.length > 0) {
            const dbPassword = result.recordset[0].Upassword;            // 比对密码
            if (dbPassword === password) {
                req.session.user = { 
                    username: username,
                    Uname: username,
                    Umail: result.recordset[0].Umail,
                    Uside: result.recordset[0].Uside,
                    Uinfo: result.recordset[0].Uinfo,
                    isLoggedIn: true };    //cookie存储用户登陆状态
                await pool.request()
                .input('Uname', sql.VarChar, username)
                .query('UPDATE UserTab SET Ustate = 1 WHERE Uname = @Uname');
                res.status(200).json({message: 'Login successful'})

            } else {
                res.status(401).json({ error: 'Invalid password' });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error' });
    }
});

app.get('/session-status', (req, res) => {
    if (req.session.user && req.session.user.isLoggedIn) {
        return res.json({ isLoggedIn: true, username: req.session.user.username });
    } else {
        return res.json({ isLoggedIn: false });
    }
});

app.get('/heartbeat', (req, res) => {
    if (req.session.user) {
        // 如果会话有效，返回 200 OK
        res.status(200).json({ message: 'Session is alive' });
    } else {
        console.log(req.session);
        const username = req.session.user.username; // 获取用户名
        sql.connect(config).then(pool => {
            return pool.request()
                .input('username', sql.VarChar, username)
                .query('UPDATE Users SET Ustate = 0 WHERE username = @username');
            }).then(() => {        
                res.status(401).json({ error: 'Session expired' });        // 如果会话无效，返回 401 Unauthorized
            }).catch(err => {           
                console.error('Database update error:', err);
                res.status(500).json({ error: 'Failed to update user status' });
            });
    }
});

app.get('/userdetail', (req, res) => {
    if (req.session.user) {
        // 返回会话中的用户信息
        res.json({
            Uname: req.session.user.Uname,
            Umail: req.session.user.Umail,
            Uside: req.session.user.Uside,
            Uinfo: req.session.user.Uinfo
        });
    } else {
        // 如果用户未登录，返回错误信息
        res.status(401).json({ message: 'User not logged in' });
    }
});