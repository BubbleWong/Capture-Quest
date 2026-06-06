import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./runtimeConfig.js";

const fallbackObjects = [
  "water bottle",
  "book",
  "pillow",
  "shoe",
  "backpack",
  "pencil",
  "spoon",
  "chair",
  "towel",
  "mug",
  "notebook",
  "toy car",
  "eraser",
  "paper clip",
  "lunch box",
  "sticky note",
  "ruler",
  "tissue box",
  "hair brush",
  "board game",
  "folder",
  "crayon",
  "marker",
  "glue stick",
  "scissors with rounded tips",
  "calculator",
  "clock",
  "remote control",
  "keychain",
  "basket",
  "blanket",
  "hat",
  "sock",
  "plate",
  "bowl",
  "fork",
  "napkin",
  "desk lamp",
  "cushion",
  "stuffed toy",
  "block",
  "playing card",
  "envelope",
  "calendar",
  "whiteboard eraser",
  "binder",
  "index card",
  "pencil case",
  "hand sanitizer bottle",
  "plant pot",
  "bookmark",
  "stapler",
  "tape roll",
  "paper cup",
  "rubber band",
  "folder clip",
  "paint brush",
  "flash card",
  "doorstop"
];

const fallbackAdjectives = [
  "blue",
  "red",
  "green",
  "yellow",
  "small",
  "large",
  "soft",
  "fuzzy",
  "striped",
  "round",
  "long",
  "short"
];

const chineseFallbackObjects = {
  zhHansCmn: [
    "水瓶",
    "书",
    "枕头",
    "鞋子",
    "背包",
    "铅笔",
    "勺子",
    "椅子",
    "毛巾",
    "马克杯",
    "笔记本",
    "玩具车",
    "橡皮",
    "回形针",
    "午餐盒",
    "便利贴",
    "尺子",
    "纸巾盒",
    "梳子",
    "桌游",
    "文件夹",
    "蜡笔",
    "马克笔",
    "胶棒",
    "圆头剪刀",
    "计算器",
    "时钟",
    "遥控器",
    "钥匙扣",
    "篮子",
    "毯子",
    "帽子",
    "袜子",
    "盘子",
    "碗",
    "叉子",
    "餐巾纸",
    "台灯",
    "靠垫",
    "毛绒玩具",
    "积木",
    "扑克牌",
    "信封",
    "日历",
    "白板擦",
    "活页夹",
    "索引卡",
    "笔袋",
    "免洗洗手液瓶",
    "花盆",
    "书签",
    "订书机",
    "胶带卷",
    "纸杯",
    "橡皮筋",
    "长尾夹",
    "画笔",
    "闪卡",
    "门挡"
  ],
  zhHantCmn: [
    "水瓶",
    "書",
    "枕頭",
    "鞋子",
    "背包",
    "鉛筆",
    "湯匙",
    "椅子",
    "毛巾",
    "馬克杯",
    "筆記本",
    "玩具車",
    "橡皮擦",
    "迴紋針",
    "午餐盒",
    "便利貼",
    "尺子",
    "面紙盒",
    "梳子",
    "桌遊",
    "資料夾",
    "蠟筆",
    "麥克筆",
    "膠棒",
    "圓頭剪刀",
    "計算機",
    "時鐘",
    "遙控器",
    "鑰匙圈",
    "籃子",
    "毯子",
    "帽子",
    "襪子",
    "盤子",
    "碗",
    "叉子",
    "餐巾紙",
    "檯燈",
    "靠墊",
    "毛絨玩具",
    "積木",
    "撲克牌",
    "信封",
    "日曆",
    "白板擦",
    "活頁夾",
    "索引卡",
    "筆袋",
    "免洗洗手液瓶",
    "花盆",
    "書籤",
    "訂書機",
    "膠帶卷",
    "紙杯",
    "橡皮筋",
    "長尾夾",
    "畫筆",
    "閃卡",
    "門擋"
  ],
  zhHansYue: [
    "水樽",
    "书",
    "枕头",
    "鞋",
    "书包",
    "铅笔",
    "汤匙",
    "椅子",
    "毛巾",
    "杯",
    "笔记簿",
    "玩具车",
    "胶擦",
    "万字夹",
    "饭盒",
    "便利贴",
    "间尺",
    "纸巾盒",
    "梳",
    "桌上游戏",
    "文件夹",
    "蜡笔",
    "箱头笔",
    "胶水笔",
    "圆头铰剪",
    "计数机",
    "钟",
    "遥控器",
    "锁匙扣",
    "篮",
    "被",
    "帽",
    "袜",
    "碟",
    "碗",
    "叉",
    "餐巾",
    "台灯",
    "靠垫",
    "公仔",
    "积木",
    "啤牌",
    "信封",
    "月历",
    "白板擦",
    "活页夹",
    "索引卡",
    "笔袋",
    "搓手液樽",
    "花盆",
    "书签",
    "钉书机",
    "胶纸卷",
    "纸杯",
    "橡筋",
    "长尾夹",
    "画笔",
    "字卡",
    "门挡"
  ],
  zhHantYue: [
    "水樽",
    "書",
    "枕頭",
    "鞋",
    "書包",
    "鉛筆",
    "湯匙",
    "椅子",
    "毛巾",
    "杯",
    "筆記簿",
    "玩具車",
    "膠擦",
    "萬字夾",
    "飯盒",
    "便利貼",
    "間尺",
    "紙巾盒",
    "梳",
    "桌上遊戲",
    "文件夾",
    "蠟筆",
    "箱頭筆",
    "膠水筆",
    "圓頭鉸剪",
    "計數機",
    "鐘",
    "遙控器",
    "鎖匙扣",
    "籃",
    "被",
    "帽",
    "襪",
    "碟",
    "碗",
    "叉",
    "餐巾",
    "枱燈",
    "靠墊",
    "公仔",
    "積木",
    "啤牌",
    "信封",
    "月曆",
    "白板擦",
    "活頁夾",
    "索引卡",
    "筆袋",
    "搓手液樽",
    "花盆",
    "書籤",
    "釘書機",
    "膠紙卷",
    "紙杯",
    "橡筋",
    "長尾夾",
    "畫筆",
    "字卡",
    "門擋"
  ]
};

const chineseFallbackAdjectives = {
  zhHansCmn: ["蓝色", "红色", "绿色", "黄色", "小", "大", "柔软", "毛茸茸", "条纹", "圆形", "长", "短"],
  zhHantCmn: ["藍色", "紅色", "綠色", "黃色", "小", "大", "柔軟", "毛茸茸", "條紋", "圓形", "長", "短"],
  zhHansYue: ["蓝色", "红色", "绿色", "黄色", "细", "大", "软身", "毛茸茸", "间条", "圆形", "长", "短"],
  zhHantYue: ["藍色", "紅色", "綠色", "黃色", "細", "大", "軟身", "毛茸茸", "間條", "圓形", "長", "短"]
};

async function readPrompt(name) {
  return fs.readFile(path.join(projectRoot, "prompts", name), "utf8");
}

function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function uniqueCleanItems(items, previousItems = []) {
  const previous = new Set(previousItems.map((item) => item.toLowerCase()));
  const seen = new Set();
  return (items || [])
    .map((item) =>
      String(item || "")
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\p{M} -]/gu, "")
        .replace(/\s+/g, " ")
    )
    .filter((item) => item.length > 1 && item.length < 40)
    .filter((item) => !previous.has(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function chineseLanguageProfile(language) {
  const text = String(language || "").toLowerCase();
  if (!text.includes("chinese")) return "";
  const traditional = text.includes("traditional");
  const cantonese = text.includes("cantonese");
  if (traditional && cantonese) return "zhHantYue";
  if (traditional) return "zhHantCmn";
  if (cantonese) return "zhHansYue";
  return "zhHansCmn";
}

function fallbackObjectsForLanguage(language) {
  const profile = chineseLanguageProfile(language);
  return profile ? chineseFallbackObjects[profile] : fallbackObjects;
}

function fallbackAdjectivesForLanguage(language) {
  const profile = chineseLanguageProfile(language);
  return profile ? chineseFallbackAdjectives[profile] : fallbackAdjectives;
}

function fallbackCandidates(language = "English") {
  const objects = fallbackObjectsForLanguage(language);
  const adjectives = fallbackAdjectivesForLanguage(language);
  const profile = chineseLanguageProfile(language);
  return [
    ...objects,
    ...adjectives.flatMap((adjective) => objects.map((item) => (profile ? `${adjective}${item}` : `${adjective} ${item}`)))
  ];
}

function shuffledFallback(count, previousItems = [], queuedItems = [], language = "English") {
  const items = uniqueCleanItems(fallbackCandidates(language), [...previousItems, ...queuedItems]);
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, count);
}

function parseCandidateList(value) {
  return String(value || "")
    .split(/[\r\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function translateKnownFallbackItem(item, language = "English") {
  const profile = chineseLanguageProfile(language);
  if (!profile) return item;
  const cleaned = String(item || "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const objectIndex = fallbackObjects.indexOf(cleaned);
  if (objectIndex >= 0) return chineseFallbackObjects[profile][objectIndex];

  const [firstWord, ...restWords] = cleaned.split(" ");
  const adjectiveIndex = fallbackAdjectives.indexOf(firstWord);
  const objectPhrase = restWords.join(" ");
  const adjective = chineseFallbackAdjectives[profile][adjectiveIndex];
  const translatedObject = chineseFallbackObjects[profile][fallbackObjects.indexOf(objectPhrase)];
  if (adjective && translatedObject) return `${adjective}${translatedObject}`;
  return item;
}

function fallbackInitialItems(input, count, previousItems = [], queuedItems = [], language = "English") {
  const parsedItems = uniqueCleanItems(
    parseCandidateList(input).map((item) => translateKnownFallbackItem(item, language)),
    [...previousItems, ...queuedItems]
  );
  const hasListDelimiter = /[\r\n,;]/.test(String(input || ""));
  const singleItemWordCount = parsedItems.length === 1 ? parsedItems[0].split(/\s+/).length : 0;
  if (parsedItems.length > 1 || hasListDelimiter || (parsedItems.length === 1 && singleItemWordCount <= 3)) {
    return parsedItems.slice(0, count);
  }
  return shuffledFallback(count, previousItems, queuedItems, language);
}

function itemList(items) {
  return items.length ? items.join(", ") : "none";
}

function languageInstruction(language) {
  const targetLanguage = String(language || "English").trim().slice(0, 80) || "English";
  const chineseProfile = chineseLanguageProfile(targetLanguage);
  if (chineseProfile) {
    const traditional = chineseProfile === "zhHantYue" || chineseProfile === "zhHantCmn";
    const cantonese = chineseProfile === "zhHantYue" || chineseProfile === "zhHansYue";
    return [
      `Target challenge language: ${targetLanguage}.`,
      `Return every object phrase in ${traditional ? "Traditional" : "Simplified"} Chinese characters only.`,
      `Use ${cantonese ? "natural Cantonese object vocabulary and wording" : "standard Mandarin object vocabulary and wording"}.`,
      "Do not return English, pinyin, Jyutping, romanization, or mixed-language phrases.",
      "If the player seed text uses another language, translate and refine the final item phrases into the requested Chinese script and dialect style."
    ].join("\n");
  }
  return [
    `Target challenge language: ${targetLanguage}.`,
    `Return every object phrase in ${targetLanguage}.`,
    `Use short, natural everyday ${targetLanguage} object phrases that players can read and find at home or school.`,
    "If the player seed text uses another language, translate and refine the final item phrases into the target challenge language."
  ].join("\n");
}

export function createLlm(config, logger = console) {
  const openRouter = config.openRouter || {};
  const hasKey = Boolean(openRouter.apiKey);

  async function chat(messages, options = {}) {
    const body = {
      model: options.model || openRouter.model,
      messages,
      temperature: options.temperature ?? 0.7,
      response_format: { type: "json_object" }
    };
    const response = await fetch(`${openRouter.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouter.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": openRouter.referer || config.publicBaseUrl || "http://localhost",
        "X-Title": openRouter.appTitle || "Capture Quest"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter request failed: ${response.status} ${text.slice(0, 240)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  return {
    async prepareInitialItems({ input = "", count = 20, language = "English", previousItems = [], queuedItems = [] } = {}) {
      const seedText = String(input || "").trim().slice(0, 1600);
      if (!seedText) return [];
      const excludedItems = uniqueCleanItems([...previousItems, ...queuedItems]);
      if (!hasKey) return fallbackInitialItems(seedText, count, previousItems, queuedItems, language);

      try {
        const [systemPrompt, seedPrompt] = await Promise.all([
          readPrompt("system_prompt.md"),
          readPrompt("seed_items.md")
        ]);
        const content = await chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                seedPrompt,
                languageInstruction(language),
                `Return up to ${count} items.`,
                `Already presented challenges for this group: ${itemList(previousItems)}.`,
                `Already queued challenges for this group: ${itemList(queuedItems)}.`,
                "Player seed text:",
                seedText
              ].join("\n\n")
            }
          ],
          { temperature: 0.45 }
        );
        const parsed = tryParseJson(content);
        const items = uniqueCleanItems(parsed?.items, excludedItems);
        return items.length > 0 ? items.slice(0, count) : fallbackInitialItems(seedText, count, previousItems, queuedItems, language);
      } catch (error) {
        logger.warn(`Initial item preparation failed (${error.message}). Using local fallback items.`);
        return fallbackInitialItems(seedText, count, previousItems, queuedItems, language);
      }
    },

    async generateItems({ count = 20, language = "English", previousItems = [], queuedItems = [] } = {}) {
      const excludedItems = uniqueCleanItems([...previousItems, ...queuedItems]);
      if (!hasKey) return shuffledFallback(count, previousItems, queuedItems, language);

      try {
        const [systemPrompt, selectPrompt] = await Promise.all([
          readPrompt("system_prompt.md"),
          readPrompt("select_item.md")
        ]);
        const content = await chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                selectPrompt,
                languageInstruction(language),
                `Return exactly ${count} items.`,
                `Already presented challenges for this group: ${itemList(previousItems)}.`,
                `Already queued challenges for this group: ${itemList(queuedItems)}.`,
                "Do not return exact repeats of already presented or queued challenge phrases.",
                "You may use adjective-qualified variants when they create a meaningfully different visible target, such as blue shoes, fuzzy coat, or long pants.",
                "Keep each item short, concrete, and recognizable in a phone photo."
              ].join("\n\n")
            }
          ],
          { temperature: 0.9 }
        );
        const parsed = tryParseJson(content);
        const items = uniqueCleanItems(parsed?.items, excludedItems);
        return items.length >= Math.min(5, count)
          ? items.slice(0, count)
          : shuffledFallback(count, previousItems, queuedItems, language);
      } catch (error) {
        logger.warn(`Item generation failed (${error.message}). Using curated fallback items.`);
        return shuffledFallback(count, previousItems, queuedItems, language);
      }
    },

    async verifyPhoto({ item, language = "English", imageDataUrl }) {
      if (!hasKey && openRouter.mockWhenMissingKey) {
        return {
          match: true,
          confidence: 0.5,
          reason: "OpenRouter key is not configured; local mock vision accepted the capture."
        };
      }

      if (!hasKey) {
        return {
          match: false,
          confidence: 0,
          reason: "OpenRouter key is not configured."
        };
      }

      try {
        const [systemPrompt, identityPrompt] = await Promise.all([
          readPrompt("system_prompt.md"),
          readPrompt("identity.md")
        ]);
        const content = await chat(
          [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    identityPrompt.replace('"xxxx"', `"${item}"`),
                    `The target object phrase is in ${String(language || "English").trim().slice(0, 80) || "English"}.`,
                    "Translate the target phrase internally if needed and judge the physical object shown in the photo.",
                    "The photo does not need to contain written text in the target language."
                  ].join("\n\n")
                },
                {
                  type: "image_url",
                  image_url: { url: imageDataUrl }
                }
              ]
            }
          ],
          {
            temperature: 0.1,
            model: openRouter.visionModel || openRouter.model
          }
        );
        const parsed = tryParseJson(content);
        return {
          match: Boolean(parsed?.match),
          confidence: Number(parsed?.confidence ?? 0),
          reason: String(parsed?.reason || "")
        };
      } catch (error) {
        logger.warn(`Photo verification failed (${error.message}).`);
        return {
          match: false,
          confidence: 0,
          reason: "The photo could not be checked. Try again."
        };
      }
    }
  };
}
