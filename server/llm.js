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
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => item.length > 1 && item.length < 40)
    .filter((item) => !previous.has(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function fallbackCandidates() {
  return [
    ...fallbackObjects,
    ...fallbackAdjectives.flatMap((adjective) => fallbackObjects.map((item) => `${adjective} ${item}`))
  ];
}

function shuffledFallback(count, previousItems = [], queuedItems = []) {
  const items = uniqueCleanItems(fallbackCandidates(), [...previousItems, ...queuedItems]);
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

function fallbackInitialItems(input, count, previousItems = [], queuedItems = []) {
  const parsedItems = uniqueCleanItems(parseCandidateList(input), [...previousItems, ...queuedItems]);
  const hasListDelimiter = /[\r\n,;]/.test(String(input || ""));
  const singleItemWordCount = parsedItems.length === 1 ? parsedItems[0].split(/\s+/).length : 0;
  if (parsedItems.length > 1 || hasListDelimiter || (parsedItems.length === 1 && singleItemWordCount <= 3)) {
    return parsedItems.slice(0, count);
  }
  return shuffledFallback(count, previousItems, queuedItems);
}

function itemList(items) {
  return items.length ? items.join(", ") : "none";
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
    async prepareInitialItems({ input = "", count = 20, previousItems = [], queuedItems = [] } = {}) {
      const seedText = String(input || "").trim().slice(0, 1600);
      if (!seedText) return [];
      const excludedItems = uniqueCleanItems([...previousItems, ...queuedItems]);
      if (!hasKey) return fallbackInitialItems(seedText, count, previousItems, queuedItems);

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
        return items.length > 0 ? items.slice(0, count) : fallbackInitialItems(seedText, count, previousItems, queuedItems);
      } catch (error) {
        logger.warn(`Initial item preparation failed (${error.message}). Using local fallback items.`);
        return fallbackInitialItems(seedText, count, previousItems, queuedItems);
      }
    },

    async generateItems({ count = 20, previousItems = [], queuedItems = [] } = {}) {
      const excludedItems = uniqueCleanItems([...previousItems, ...queuedItems]);
      if (!hasKey) return shuffledFallback(count, previousItems, queuedItems);

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
          : shuffledFallback(count, previousItems, queuedItems);
      } catch (error) {
        logger.warn(`Item generation failed (${error.message}). Using curated fallback items.`);
        return shuffledFallback(count, previousItems, queuedItems);
      }
    },

    async verifyPhoto({ item, imageDataUrl }) {
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
                  text: identityPrompt.replace('"xxxx"', `"${item}"`)
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
