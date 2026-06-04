import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rlsSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "0005_business_rls.sql"),
  "utf8"
);

const tenantTables = [
  "businesses",
  "business_members",
  "customer_profiles",
  "call_records",
  "messages",
  "tasks",
  "appointments",
  "quote_drafts",
  "audit_events",
  "number_port_requests"
];
const numberSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "0006_business_numbers_and_port_requests.sql"),
  "utf8"
);

describe("owner business RLS migration", () => {
  it("enables row-level security on every tenant-scoped table", () => {
    for (const table of tenantTables) {
      expect(`${rlsSql}\n${numberSql}`).toContain(
        `alter table public.${table} enable row level security`
      );
    }
  });

  it("scopes tenant rows through business membership and auth.uid()", () => {
    expect(rlsSql).toContain("public.current_user_business_ids()");
    expect(rlsSql).toContain("where user_id = auth.uid()");
    expect(rlsSql).toContain("business_id = any(public.current_user_business_ids())");
  });
});
