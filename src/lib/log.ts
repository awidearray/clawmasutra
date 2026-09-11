export function logEvent(
  level: "info" | "warn" | "error",
  msg: string,
  fields: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...fields,
    }),
  );
}
