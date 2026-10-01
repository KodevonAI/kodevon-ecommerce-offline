import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

export async function hit(db: Db, key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`);
  return Number((r as any).rows[0].count) <= limit;
}
