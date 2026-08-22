-- 新闻版（news briefing）：daily_issues.news jsonb 列。
-- 幂等写法（生产库是 push 工作流，手动执行；可安全重复）。
ALTER TABLE "daily_issues" ADD COLUMN IF NOT EXISTS "news" jsonb;
