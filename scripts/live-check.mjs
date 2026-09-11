const base = process.env.APP_URL || process.argv[2];
if (!base) {
  console.error("APP_URL or argv required");
  process.exit(1);
}

async function hit(path, init = {}) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", ...init });
  return res;
}

const health = await hit("/api/health");
const healthBody = await health.json();
if (health.status !== 200 || healthBody.ok !== true || healthBody.db !== true) {
  console.error("health failed", health.status, healthBody);
  process.exit(1);
}

const home = await hit("/");
if (home.status !== 200) {
  console.error("home", home.status);
  process.exit(1);
}

const skill = await hit("/skill.md");
const skillText = await skill.text();
if (skill.status !== 200 || !skillText.includes("/api/v1/agents/pair")) {
  console.error("skill failed");
  process.exit(1);
}

const app = await hit("/app");
if (![307, 308, 302].includes(app.status)) {
  console.error("expected /app redirect, got", app.status);
  process.exit(1);
}

const underage = await hit("/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "kid@example.com",
    password: "abcdefghij",
    name: "Kid",
    age: 17,
    ageConfirmed: true,
  }),
});
if (underage.status !== 400) {
  console.error("underage signup should 400, got", underage.status);
  process.exit(1);
}

const noKey = await hit("/api/v1/me");
if (noKey.status !== 401) {
  console.error("missing key should 401, got", noKey.status);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    base,
    health: healthBody,
    home: home.status,
    skillBytes: skillText.length,
    appRedirect: app.status,
  }),
);
