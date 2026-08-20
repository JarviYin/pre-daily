// SEO 循环的分发与测量适配器。三个渠道全部 env-gated、best-effort：
// 未配置时优雅跳过（返回原因），绝不让循环崩溃。
//  • IndexNow — 即时通知 Bing/Yandex 等支持该协议的分发（免费、无需账号）
//  • Baidu 主动推送 — 中文搜索主引擎，需要百度站长平台的 token（未备案域名收录有限）
//  • Google Search Console — 拉昨日曝光/点击/查询，测量循环的唯一真相来源
import { createSign } from "node:crypto";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.pre-daily.com").replace(/\/$/, "");

type ChannelResult = { ok: boolean; reason?: string; detail?: string };

// ── IndexNow ────────────────────────────────────────────────────

/**
 * 批量提交 URL 到 IndexNow 协议（Bing/Yandex/Naver 等）。需要 INDEXNOW_KEY
 * （一个 8-128 字符的 key），且站内需放置 {key}.txt 验证文件。
 * 默认使用站点已部署的验证 key（public/9029….txt，见 scripts/indexnow.ts）；
 * INDEXNOW_KEY env 可覆盖。
 */
const INDEXNOW_DEFAULT_KEY = "90294919de6f95e9e0f8eac988df513d";

export async function notifyIndexNow(urls: string[]): Promise<ChannelResult> {
  const key = process.env.INDEXNOW_KEY || INDEXNOW_DEFAULT_KEY;
  if (urls.length === 0) return { ok: false, reason: "无 URL" };
  const host = new URL(siteUrl()).host;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl()}/${key}.txt`,
        urlList: urls,
      }),
    });
    return res.ok
      ? { ok: true }
      : { ok: false, reason: `HTTP ${res.status}`, detail: (await res.text()).slice(0, 200) };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// ── Baidu 主动推送 ──────────────────────────────────────────────

/**
 * Baidu 链接主动推送（data.zz.baidu.com/urls）。需要 BAIDU_PUSH_SITE（如
 * https://www.pre-daily.com）与 BAIDU_PUSH_TOKEN。返回成功数与剩余配额。
 */
export async function baiduPush(urls: string[]): Promise<ChannelResult> {
  const site = process.env.BAIDU_PUSH_SITE;
  const token = process.env.BAIDU_PUSH_TOKEN;
  if (!site || !token) return { ok: false, reason: "BAIDU_PUSH_* 未配置" };
  if (urls.length === 0) return { ok: false, reason: "无 URL" };
  try {
    const res = await fetch(
      `http://data.zz.baidu.com/urls?site=${encodeURIComponent(site)}&token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: urls.join("\n"),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      success?: number;
      remain?: number;
      error?: number;
      message?: string;
    };
    if (res.ok && body.success != null && body.success > 0) {
      return { ok: true, detail: `success=${body.success} remain=${body.remain ?? "?"}` };
    }
    return {
      ok: false,
      reason: `HTTP ${res.status}${body.message ? ` ${body.message}` : ""}`,
    };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// ── Google Search Console ───────────────────────────────────────

type GscQueryStat = { query: string; impressions: number; clicks: number };

export type GscYesterday = {
  impressions: number;
  clicks: number;
  topQueries: GscQueryStat[];
};

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 用服务账号私钥签发 RS256 JWT（无第三方依赖）。 */
function serviceAccountJwt(email: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const h = base64url(Buffer.from(JSON.stringify(header)));
  const p = base64url(Buffer.from(JSON.stringify(claims)));
  const sig = createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey);
  return `${h}.${p}.${base64url(Buffer.from(sig))}`;
}

/**
 * 拉取 GSC 昨日汇总 + top10 查询。需要服务账号 JSON 凭据（
 * GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY）且该服务账号已被
 * 添加为 GSC 资源的用户。未配置/失败 ⇒ null（循环降级为「无测量」）。
 */
export async function fetchGscYesterday(): Promise<GscYesterday | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const site = process.env.GSC_SITE_URL || siteUrl();
  if (!email || !key) return null;
  try {
    const jwt = serviceAccountJwt(email, key);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const tokenBody = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokenBody.access_token) {
      console.warn("[seo-gsc] token exchange failed:", tokenRes.status);
      return null;
    }
    const auth = `Bearer ${tokenBody.access_token}`;
    const endpoint =
      `https://searchconsole.googleapis.com/webmasters/v3/sites/` +
      `${encodeURIComponent(site)}/searchAnalytics/query`;
    // 昨天（GSC 数据有 1-2 天延迟，取昨天；数据未到 ⇒ 空结果也正常）。
    const d = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const totals = (await (
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ startDate: d, endDate: d, rowLimit: 1 }),
      })
    ).json().catch(() => ({}))) as { rows?: { impressions?: number; clicks?: number }[] };
    const top = (await (
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({
          startDate: d,
          endDate: d,
          dimensions: ["query"],
          rowLimit: 10,
        }),
      })
    ).json().catch(() => ({}))) as {
      rows?: { keys?: string[]; impressions?: number; clicks?: number }[];
    };
    const t = totals.rows?.[0];
    return {
      impressions: t?.impressions ?? 0,
      clicks: t?.clicks ?? 0,
      topQueries: (top.rows ?? [])
        .map((r) => ({
          query: r.keys?.[0] ?? "",
          impressions: r.impressions ?? 0,
          clicks: r.clicks ?? 0,
        }))
        .filter((q) => q.query),
    };
  } catch (err) {
    console.warn("[seo-gsc] fetch failed:", err);
    return null;
  }
}
