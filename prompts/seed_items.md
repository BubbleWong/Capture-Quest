The player may provide either:

1. A word list of requested challenge objects.
2. A guide describing the kind of objects they want the AI to generate.

Decide which one it is from the player's seed text.

If it is a word list, refine it into clear camera-scavenger-hunt objects. Remove unsafe, private, living, fragile, brand-specific, too vague, or hard-to-photograph entries. Convert vague entries into concrete visible targets when safe. Keep the player's intent and order as much as possible.

If it is a guide, generate objects that follow the guide while still being common in a modern home or school, safe for kids, easy to recognize in a phone photo, and reasonable to find without leaving the play area.

Do not repeat any challenge phrase that the game says was already presented or queued. You may add simple visible adjectives when they create a meaningfully different target, such as "blue shoes", "fuzzy coat", or "long pants".

Return JSON only in this exact shape, with mode set to either "list" or "guide":
{"mode":"list","items":["water bottle","book","pillow"]}
