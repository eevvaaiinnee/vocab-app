import { createClient } from '@supabase/supabase-js';

// 这两个值来自你的 Supabase 项目设置 -> API
// 部署时用 .env 文件配置，不要把 key 硬编码提交到 git
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
