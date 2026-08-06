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
alter table topics disable row level security;

-- 每日练习记录（保存当天生成的词，供当天持续展示 + 历史查看）
create table daily_sessions (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null unique,
  word_ids   uuid[] not null,
  created_at timestamptz not null default now()
);
alter table daily_sessions disable row level security;

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

-- 两人共用同一份数据，不做行级隔离（RLS 可以先关闭，简单起见）
alter table words disable row level security;
alter table sentences disable row level security;
alter table review_log disable row level security;
alter table checkins disable row level security;
alter table quiz_log disable row level security;
