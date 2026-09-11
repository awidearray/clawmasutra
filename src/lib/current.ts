import { cookies } from "next/headers";
import { actorFromSession } from "./auth";
import { SESSION_COOKIE } from "./config";
import { getDb } from "./db";

export async function currentActor() {
  const jar = await cookies();
  return actorFromSession(getDb(), jar.get(SESSION_COOKIE)?.value);
}
