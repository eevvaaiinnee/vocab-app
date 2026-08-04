# 词汇记忆 App

ACT/TOEFL 词汇练习工具，React + Supabase。

## 设置步骤

### 1. Supabase 项目
1. 在 [supabase.com](https://supabase.com) 新建项目
2. 打开 SQL Editor，粘贴运行 `supabase/schema.sql`
3. 在 Authentication -> Users 里手动新建两个用户（你 + mentor）的邮箱账号
4. 在 Project Settings -> API 里拿到 `Project URL` 和 `anon public key`

### 2. 本地开发
```bash
npm install
cp .env.example .env
# 编辑 .env，填入第1步拿到的 URL 和 key
npm run dev
```

### 3. 部署到 GitHub Pages
1. 把整个项目 push 到你的 GitHub repo
2. Repo Settings -> Pages -> Source 选 "GitHub Actions"
3. Repo Settings -> Secrets and variables -> Actions，新增两个 secret：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. push 到 main 分支会自动触发部署（workflow 在 `.github/workflows/deploy.yml`）
5. 部署完成后，在 Pages 设置里配置自定义子域名（跟你之前 evainesun.com 子域名的做法一致），并在你的域名 DNS 里加一条 CNAME 记录指向 `你的GitHub用户名.github.io`

### 4. 登录方式
目前前端还没接 Supabase Auth 的登录页（因为只有2个人用，可以先用 Supabase 的 magic link 或者最简单的方式）。如果你想要一个简单的登录页，告诉我，我再补上——现在这版默认是"打开就能用"，数据库层面没做权限隔离（两人权限一致，都能读写）。

## 文件结构
```
src/
  lib/
    supabaseClient.js   # Supabase 连接配置
    scheduler.js        # 核心调度算法（间隔计算、每日候选池）
  components/
    DailyPractice.jsx    # 每日学习
    WordBank.jsx          # 词库浏览
    AddWords.jsx          # 批量添加单词（手动填写释义+例句）
    Checkin.jsx            # 签到日历
    Quiz.jsx                # Quiz
supabase/
  schema.sql              # 数据库建表
```

## 调度算法说明
见 `src/lib/scheduler.js` 里的注释，对应之前讨论的：
- 陌生人(1-3次) / 熟人(4-6次) / 老熟人(7+次) / 烦人(flag) / 朋友们(mastered)
- 每个词有 `next_due_date`，只有到期的老词才会进入当天候选池，越早到期优先级越高
- 烦人词间隔减半且无视到期日强制插入
- quiz 答错会让词回退状态并把间隔重置为1-2天
