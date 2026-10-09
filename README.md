# LinguaLab MVP v0.1

Запуск:

    npm install
    npm run dev        # фронтенд: http://localhost:5173, API: http://localhost:3001

Данные хранятся в `server/db.json` (создаётся автоматически).
Продакшн: `npm run build && npm start` (Express раздаёт `dist`).

ИИ-генерация: задайте `OPENAI_API_KEY` (и при желании `OPENAI_MODEL`, по умолчанию gpt-4o-mini):

    OPENAI_API_KEY=sk-... npm run dev
