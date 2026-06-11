// National-team name handling for the World Cup special.
//
// Polymarket uses inconsistent English names across its own markets (the
// Winner market says "South Korea" while match markets say "Korea Republic"),
// so we (1) normalize to one canonical key for cross-market matching, and
// (2) translate to Simplified Chinese for display/push. Unknown names fall
// back to the original English — never block on a missing entry.

const ALIASES: Record<string, string> = {
  "korea republic": "south korea",
  "republic of korea": "south korea",
  "ir iran": "iran",
  "usa": "united states",
  "us": "united states",
  "türkiye": "turkey",
  "czech republic": "czechia",
  "cape verde": "cabo verde",
  "ivory coast": "cote d'ivoire",
  "côte d'ivoire": "cote d'ivoire",
  "dr congo": "congo dr",
  "democratic republic of the congo": "congo dr",
  "bosnia and herzegovina": "bosnia-herzegovina",
};

/** Canonical lowercase key for matching the same nation across markets. */
export function teamKey(name: string): string {
  const k = name.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

/** Same nation despite Polymarket's naming drift between markets? */
export function sameTeam(a: string, b: string): boolean {
  return teamKey(a) === teamKey(b);
}

// Chinese display names, keyed by canonical key (see teamKey).
const ZH: Record<string, string> = {
  "argentina": "阿根廷",
  "australia": "澳大利亚",
  "austria": "奥地利",
  "algeria": "阿尔及利亚",
  "belgium": "比利时",
  "bolivia": "玻利维亚",
  "bosnia-herzegovina": "波黑",
  "brazil": "巴西",
  "cabo verde": "佛得角",
  "cameroon": "喀麦隆",
  "canada": "加拿大",
  "chile": "智利",
  "colombia": "哥伦比亚",
  "congo dr": "刚果民主共和国",
  "costa rica": "哥斯达黎加",
  "cote d'ivoire": "科特迪瓦",
  "croatia": "克罗地亚",
  "curaçao": "库拉索",
  "curacao": "库拉索",
  "czechia": "捷克",
  "denmark": "丹麦",
  "ecuador": "厄瓜多尔",
  "egypt": "埃及",
  "england": "英格兰",
  "france": "法国",
  "germany": "德国",
  "ghana": "加纳",
  "greece": "希腊",
  "haiti": "海地",
  "honduras": "洪都拉斯",
  "iran": "伊朗",
  "iraq": "伊拉克",
  "ireland": "爱尔兰",
  "italy": "意大利",
  "jamaica": "牙买加",
  "japan": "日本",
  "jordan": "约旦",
  "mexico": "墨西哥",
  "morocco": "摩洛哥",
  "netherlands": "荷兰",
  "new zealand": "新西兰",
  "nigeria": "尼日利亚",
  "norway": "挪威",
  "panama": "巴拿马",
  "paraguay": "巴拉圭",
  "peru": "秘鲁",
  "poland": "波兰",
  "portugal": "葡萄牙",
  "qatar": "卡塔尔",
  "saudi arabia": "沙特阿拉伯",
  "scotland": "苏格兰",
  "senegal": "塞内加尔",
  "serbia": "塞尔维亚",
  "slovakia": "斯洛伐克",
  "slovenia": "斯洛文尼亚",
  "south africa": "南非",
  "south korea": "韩国",
  "spain": "西班牙",
  "sweden": "瑞典",
  "switzerland": "瑞士",
  "tunisia": "突尼斯",
  "turkey": "土耳其",
  "ukraine": "乌克兰",
  "united states": "美国",
  "uruguay": "乌拉圭",
  "uzbekistan": "乌兹别克斯坦",
  "venezuela": "委内瑞拉",
  "wales": "威尔士",
};

/** Chinese display name; falls back to the original English when unmapped. */
export function teamZh(name: string): string {
  return ZH[teamKey(name)] ?? name;
}
