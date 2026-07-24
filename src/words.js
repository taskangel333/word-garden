// Starter vocabulary: everyday words a child encounters, each with an emoji
// "picture", a display color, and its pre-generated voice clips.
export const WORDS = [
  { id: 'apple',  word: 'Apple',  emoji: '🍎', category: 'food',    color: '#e8756a' },
  { id: 'banana', word: 'Banana', emoji: '🍌', category: 'food',    color: '#e8d06a' },
  { id: 'cookie', word: 'Cookie', emoji: '🍪', category: 'food',    color: '#c9995e' },
  { id: 'milk',   word: 'Milk',   emoji: '🥛', category: 'food',    color: '#eef2f5' },
  { id: 'cup',    word: 'Cup',    emoji: '🥤', category: 'food',    color: '#9fc7e8' },
  { id: 'dog',    word: 'Dog',    emoji: '🐶', category: 'animals', color: '#d8b98a' },
  { id: 'cat',    word: 'Cat',    emoji: '🐱', category: 'animals', color: '#e8c58a' },
  { id: 'fish',   word: 'Fish',   emoji: '🐟', category: 'animals', color: '#8ab8d8' },
  { id: 'bird',   word: 'Bird',   emoji: '🐦', category: 'animals', color: '#8ad8b8' },
  { id: 'duck',   word: 'Duck',   emoji: '🦆', category: 'animals', color: '#a8d88a' },
  { id: 'bear',   word: 'Bear',   emoji: '🧸', category: 'toys',    color: '#d8a88a' },
  { id: 'ball',   word: 'Ball',   emoji: '⚽', category: 'toys',    color: '#c8cdd2' },
  { id: 'car',    word: 'Car',    emoji: '🚗', category: 'toys',    color: '#e88a8a' },
  { id: 'book',   word: 'Book',   emoji: '📖', category: 'toys',    color: '#b8a8d8' },
  { id: 'shoe',   word: 'Shoe',   emoji: '👟', category: 'clothes', color: '#98b8d8' },
  { id: 'hat',    word: 'Hat',    emoji: '🎩', category: 'clothes', color: '#a898c8' },
  { id: 'flower', word: 'Flower', emoji: '🌸', category: 'nature',  color: '#e8a8c8' },
  { id: 'tree',   word: 'Tree',   emoji: '🌳', category: 'nature',  color: '#88c888' },
  { id: 'sun',    word: 'Sun',    emoji: '☀️', category: 'nature',  color: '#e8d078' },
  { id: 'star',   word: 'Star',   emoji: '⭐', category: 'nature',  color: '#e8d898' },
];

export const wordById = (id) => WORDS.find((w) => w.id === id);
