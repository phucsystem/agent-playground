"use client";

import { useState } from "react";

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "😝",
      "🤑", "🤗", "🤭", "🤫", "🤔", "😐", "😑", "😶", "😏", "😒",
      "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
      "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🥳",
      "🥸", "😎", "🤓", "🧐", "😱", "😨", "😰", "😥", "😢", "😭",
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "🫶", "👐",
      "🤲", "🤝", "🙏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈",
      "👉", "👆", "👇", "☝️", "👋", "🫡", "💪", "🦾", "🖕", "✋",
    ],
  },
  {
    name: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🔥", "⭐", "🌟", "💫",
      "✨", "💥", "💯", "🎯", "🚀", "💡", "🔔", "📌", "📎", "🔗",
      "💻", "📱", "⌨️", "🖥️", "🤖", "👾", "🎮", "🕹️", "📷", "🎵",
    ],
  },
  {
    name: "Animals",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦅", "🦄",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍰", "🎂", "🍩", "🍪",
      "☕", "🍵", "🧃", "🍺", "🍻", "🥂", "🍷", "🥤", "🧋", "🍜",
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap((category) => category.emojis).filter(() => true)
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg w-[320px] z-50">
      <div className="p-2 border-b border-neutral-100">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search emoji..."
          autoFocus
          className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-primary-400"
        />
      </div>

      {!search && (
        <div className="flex gap-1 px-2 pt-2">
          {EMOJI_CATEGORIES.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setActiveCategory(index)}
              className={`text-xs px-2 py-1 rounded-md transition ${
                activeCategory === index
                  ? "bg-primary-100 text-primary-600 font-medium"
                  : "text-neutral-400 hover:bg-neutral-100"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            onClick={() => onSelect(emoji)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition text-xl"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
