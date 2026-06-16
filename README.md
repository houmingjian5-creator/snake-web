# 霓虹贪吃蛇

一个纯静态的网页版贪吃蛇游戏，可以直接发布到 GitHub Pages、Netlify、Vercel 或任意静态网站服务。

账号、昵称、密码摘要和排行榜保存在玩家当前浏览器的 `localStorage` 中。这个版本不依赖服务器，所以不同设备之间的账号和排行榜不会自动同步。

## 本地预览

```bash
node server.js
```

然后打开 `http://127.0.0.1:5173/`。

## GitHub Pages

把本目录中的文件上传到 GitHub 仓库根目录，然后在仓库 Settings -> Pages 中选择从 `main` 分支根目录发布。
