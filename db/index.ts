import * as tables from "./schema"
import * as relations from "./relations"
// Vercel/Neon: WebSocket Pool (supports interactive transactions)
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"
// k8s/local: node-postgres
import { Pool as PgPool } from "pg"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import ws from "ws"

const schema = { ...tables, ...relations }

function createDb() {
  if (process.env.DB_DRIVER === "neon") {
    neonConfig.webSocketConstructor = ws
    return drizzleNeon(
      new NeonPool({ connectionString: process.env.DATABASE_URL }),
      { schema }
    )
  }
  return drizzlePg(
    new PgPool({ connectionString: process.env.DATABASE_URL, max: 10 }),
    { schema }
  )
}

type Db = ReturnType<typeof drizzlePg<typeof schema>>

// Reuse one pool across dev hot reloads.
const globalForDb = globalThis as unknown as { __basedriveDb?: Db }

// Both drivers expose the same query builder surface; type them as one.
export const db: Db = globalForDb.__basedriveDb ?? (createDb() as Db)
if (process.env.NODE_ENV !== "production") globalForDb.__basedriveDb = db

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type DbOrTx = Db | Tx
export { schema }
