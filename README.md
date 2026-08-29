# Melody Music

Spotify / 网易云音乐风格的轻量音乐网站，使用 Cloudflare Worker + D1 + R2。前台访客无需登录；管理员通过 `/admin` 管理歌曲、歌单、分类、MP3、封面与 LRC 同步歌词。

## 功能

- 单管理员登录，PBKDF2-SHA-256 密码哈希
- Secure + HttpOnly + SameSite=Strict 会话 Cookie，默认 7 天
- 歌曲新增、编辑、删除、发布/下架
- MP3 和封面支持 R2 上传或外部 URL
- LRC 支持粘贴编辑和 `.lrc` 上传，前台同步滚动
- 歌单和分类 CRUD
- D1 存元数据，R2 存媒体文件
- Cloudflare Worker 同时提供 API 和静态网站

## 1. 安装

```bash
npm install
```

## 2. 创建 Cloudflare 资源

登录 Cloudflare：

```bash
npx wrangler login
```

创建 D1：

```bash
npx wrangler d1 create melody-music-db
```

把命令返回的 `database_id` 填入 `wrangler.jsonc` 中 `DB` 的 `database_id`。仓库里的全零 ID 只是占位符。

创建 R2：

```bash
npx wrangler r2 bucket create melody-music-media
```

应用数据库迁移：

```bash
npx wrangler d1 migrations apply DB --remote
```

## 3. 创建管理员账号

不要把密码写入 GitHub。先在本机生成 SQL：

```bash
MELODY_ADMIN_USERNAME=admin MELODY_ADMIN_PASSWORD='<strong-password>' node scripts/bootstrap-admin.mjs
```

复制脚本输出的 SQL，然后执行：

```bash
npx wrangler d1 execute DB --remote --command "<这里粘贴生成的 SQL>"
```

建议管理员密码至少 12 位，并包含随机字符。

## 4. 本地开发

先应用本地 D1 迁移：

```bash
npx wrangler d1 migrations apply DB --local
```

启动：

```bash
npx wrangler dev
```

访问：

- 前台：`http://localhost:8787/`
- 后台：`http://localhost:8787/admin`

> 正式环境 Cookie 使用 `Secure`；本地开发时如浏览器对 HTTP Secure Cookie 有限制，可使用 Wrangler 提供的本地 HTTPS/远程开发方式进行登录测试。

## 5. 测试

```bash
npm test
```

## 6. 部署

先检查 Worker 是否能打包：

```bash
npx wrangler deploy --dry-run
```

正式部署：

```bash
npx wrangler deploy
```

Cloudflare Git 部署的部署命令也使用：

```bash
npx wrangler deploy
```

### Cloudflare 绑定

- D1：`DB`
- R2：`MEDIA`
- 静态 Assets：`ASSETS`

## 7. 上线后检查

确认以下流程：

```text
GET /                         -> 200
GET /api/songs                -> 200 JSON
GET /admin                    -> 200
错误管理员密码                -> 401
正确管理员登录                -> 200 + Secure Cookie
创建草稿                      -> 后台可见、前台 API 不可见
发布歌曲                      -> /api/songs 可见
上传 MP3/封面/LRC             -> 可以播放/显示/同步
退出登录后修改后台数据         -> 401
```

## 文件结构

```text
public/                 前台和后台静态页面
src/                    Worker API、认证、D1/R2、LRC 逻辑
migrations/             D1 数据库迁移
scripts/                管理员初始化工具
test/                   Node 测试
docs/superpowers/       设计与实施计划
```
