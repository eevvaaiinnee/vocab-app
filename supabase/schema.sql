-- ============================================
-- 词汇学习 App 数据库 schema
-- 在 Supabase 项目的 SQL Editor 里直接粘贴运行
-- ============================================

create extension if not exists "uuid-ossp";

-- 单词表
create table words (
  id               uuid primary key default uuid_generate_v4(),
  term             text not null,
  chinese_meaning  text not null default '',
  topic            text not null default '未分类',
  topics           text[] not null default '{}',
  added_date       date not null default current_date,
  exposure_count   int not null default 0,
  is_favorite      boolean not null default false,
  status           text not null default 'learning', -- 'learning' | 'mastered'
  last_shown_date  date,
  next_due_date    date not null default current_date,
  created_by       text
);

-- 例句表（每词5句）
create table sentences (
  id          uuid primary key default uuid_generate_v4(),
  word_id     uuid references words(id) on delete cascade,
  sentence    text not null,
  order_index int not null
);

-- 复习历史
create table review_log (
  id          uuid primary key default uuid_generate_v4(),
  word_id     uuid references words(id) on delete cascade,
  shown_date  date not null default current_date
);

-- 签到记录
create table checkins (
  id       uuid primary key default uuid_generate_v4(),
  date     date not null,
  success  boolean not null default true,
  unique(date)
);

-- 主题分类表（独立管理：新建/改名/删除，不依赖words里现有数据）
create table topics (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- 每日练习记录（保存当天生成的词，供当天持续展示 + 历史查看）
create table daily_sessions (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null unique,
  word_ids   uuid[] not null,
  created_at timestamptz not null default now()
);

-- Quiz 记录
create table quiz_log (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null default current_date,
  word_ids   uuid[] not null,
  accuracy   numeric
);

-- 索引：加速每日候选池查询
create index idx_words_due on words(next_due_date);
create index idx_words_topic on words(topic);
create index idx_words_status on words(status);

-- ============================================
-- 权限控制：任何人可读（查看），只有登录用户（你 + mentor）可写
-- ============================================
alter table words enable row level security;
alter table sentences enable row level security;
alter table review_log enable row level security;
alter table checkins enable row level security;
alter table quiz_log enable row level security;
alter table daily_sessions enable row level security;
alter table topics enable row level security;

-- 所有人（包括未登录访客）可以查看
create policy "public read" on words for select using (true);
create policy "public read" on sentences for select using (true);
create policy "public read" on review_log for select using (true);
create policy "public read" on checkins for select using (true);
create policy "public read" on quiz_log for select using (true);
create policy "public read" on daily_sessions for select using (true);
create policy "public read" on topics for select using (true);

-- 只有登录用户（你 + mentor 的账号）可以增删改
create policy "authenticated write" on words for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on sentences for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on review_log for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on checkins for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on quiz_log for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on daily_sessions for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated write" on topics for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
