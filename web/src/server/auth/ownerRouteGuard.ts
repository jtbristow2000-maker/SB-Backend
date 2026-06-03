export function shouldProtectOwnerRoutes(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PERSISTENCE === "supabase";
}
