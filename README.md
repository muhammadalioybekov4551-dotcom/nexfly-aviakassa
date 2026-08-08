# NexFly Aviakassa

React + Vite asosidagi aviachipta qidirish/bron qilish interfeysi.

## Ishga tushirish

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Vercel

Bu loyiha Vite sifatida deploy qilinadi:
- Build command: `npm run build`
- Output directory: `dist`

## Muhim

`src/App.jsx` ichidagi Travelpayouts API tokeni client-side kodda ko‘rinadi. Agar bu token maxfiy bo‘lishi kerak bo‘lsa, uni frontendga qo‘ymasdan server-side/Vercel Function orqali ishlatish kerak.
