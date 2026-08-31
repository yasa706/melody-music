# 专辑功能部署说明

本版本新增了正式的“专辑”数据表和 `songs.album_id` 字段，因此部署新代码前必须先给现有 Cloudflare D1 数据库执行一次数据库升级。

## 第一步：升级 D1（只执行一次）

推荐直接执行本项目中的：

`migrations/0004_albums.sql`

如果使用 Wrangler：

```bash
npx wrangler d1 execute melody-music-db --remote --file=migrations/0004_albums.sql
```

如果使用 Cloudflare 网页后台：进入 D1 → `melody-music-db` → Console，把 `migrations/0004_albums.sql` 的全部 SQL 粘贴进去执行一次。

## 第二步：部署代码

把本 ZIP 解压后的项目内容上传/推送到原来的 GitHub 仓库，Cloudflare Worker 会按现有配置重新部署。

## 第三步：建立专辑

1. 打开 `/admin/` 并登录管理员账号。
2. 左侧选择“专辑”。
3. 点击“＋ 新增”，填写专辑名称、歌手/团队、描述和封面，也可以直接上传封面到现有 R2。
4. 保存专辑。
5. 打开“歌曲”→ 编辑歌曲 → 在“所属专辑”下拉框选择刚建立的专辑 → 保存。
6. 回到网站首页即可看到专辑封面墙；点击专辑会显示其中歌曲，点击歌曲即可播放。

## 兼容说明

旧歌曲不会被删除。原来的 `songs.album` 文字字段仍保留，新的正式专辑关系使用 `songs.album_id`。没有加入专辑的旧歌曲仍然会继续显示和播放。
