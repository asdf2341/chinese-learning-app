export type User = { id: string; name: string; email: string; role: 'TEACHER' | 'STUDENT'; bio?: string; subscription?: 'FREE' | 'PREMIUM' };
export type Act = { id: string; type: ActType; [key: string]: any };
export type ActType = 'text' | 'vocab' | 'choice' | 'find' | 'builder' | 'repeat';

export const TYPES: Record<ActType, string> = {
  text: '📖 Текст',
  vocab: '🧠 Слово',
  choice: '❓ Выбор ответа',
  find: '🔎 Найди слово',
  builder: '🧩 Собери предложение',
  repeat: '🎤 Повторяй за мной',
};

// [ключ, подпись]
const QUIZ: [string, string][] = [
  ['question', 'Вопрос'],
  ['options', 'Варианты (каждый с новой строки)'],
  ['correct', 'Номер верного варианта'],
  ['explanation', 'Объяснение (показывается после ответа)'],
];
export const FIELDS: Record<ActType, [string, string][]> = {
  text: [['title', 'Заголовок'], ['content', 'Текст']],
  vocab: [['word', 'Слово'], ['pinyin', 'Пиньинь'], ['translation', 'Перевод']],
  choice: QUIZ,
  find: QUIZ,
  builder: [
    ['prompt', 'Задание'],
    ['answer', 'Верное предложение (слова через пробел)'],
    ['extra', 'Лишние слова (необязательно)'],
    ['explanation', 'Объяснение (показывается после ответа)'],
  ],
  repeat: [['phrase', 'Фраза'], ['pinyin', 'Пиньинь'], ['translation', 'Перевод']],
};
export const LONG = ['content', 'options'];
