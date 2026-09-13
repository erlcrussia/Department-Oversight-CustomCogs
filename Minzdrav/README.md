# ЕМИАС — Минздрав (CustomCogs)

Порт системы **ЕМИАС** в кастом-коги бота «Управление Департаментами» (ER:LC Россия). Чистая БД, минимум команд, современный визуал на Containers V2. Стек: **TypeScript + ESM**.

## Принципы

- **Чистая БД** — никаких фейков. PostgreSQL через Prisma (схема `emias`, см. `schema.txt`). Данные только реальные (создаются игроками/врачами). `/штаб` → Очистка.
- **Минимум команд** — вместо 18 слэш-команд — 3 панели с кнопками. Вся логика через компоненты (`customId` → `interactionCreate.ts`).
- **Containers V2** — вместо `EmbedBuilder` — `ContainerBuilder` с `accent_color`, секции, сепараторы, минимум эмодзи, аккуратная типографика. Флаг `MessageFlags.IsComponentsV2`.

## Команды (3)

| Команда | Описание | Доступ |
|---|---|---|
| `/емиас` | Главная панель ЕМИАС — кнопки: Записаться · Мои талоны · Привязать · Код для сайта · (для сотрудников) Очередь · Карта · Статус · Прием · Рецепт · Интеграции | Все |
| `/штаб` | Штаб персонала — кнопки: Добавить · Список · Статистика · Очистка · Блок · Разблок | Главврач (первый — админ сервера) |
| `/помощь` | Помощь — контейнер с гидом | Все |

Все действия — **кнопками** внутри панелей:
- **Записаться** → модалка (врач, дата, время) → `bookAppointment`
- **Мои талоны** → контейнер со списком
- **Привязать** → модалка (код 6 симв.) → `linkPatientByCode`
- **Код для сайта** → одноразовый код 10 минут для входа на сайт (`SiteAuthCode`)
- **Очередь** → контейнер очереди на сегодня (сотрудникам)
- **Карта** → модалка (ID) → контейнер карты (медданные только врачам)
- **Статус** → селект (Свободен/На приёме/Офф)
- **Прием / Рецепт** → модалки ЭМК/рецептов (врачи)
- **Интеграции** → канал записей + пинги врача/пациента (только главврач)
- **Добавить** → модалка (Discord ID, ФИО, роль, специальность) — только главврач
- **Список / Статистика / Очистка / Блок / Разблок** — через штаб

## Визуал

`Minzdrav/utils/embeds.ts` — все контейнеры (компилируется в `dist/Minzdrav/utils/embeds.js`):

```ts
import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { PRIMARY_COLOR, ICON_URL } from '../config.js';

new ContainerBuilder().setAccentColor(0x0063B0)
  .addSectionComponents(headerSection(...).setThumbnailAccessory(...))
  .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(...))
  // + ActionRow с кнопками
```
- Акцент `#0063B0` (`PRIMARY_COLOR` из `config.ts:3`), иконка `ICON_URL`, `TextDisplay` с markdown, `Section` с thumbnail, `Separator` с divider, `-#` дисклеймер.
- Нет лишних эмодзи — только текст и системные разделители.
- Флаг `MessageFlags.IsComponentsV2` (`FLAGS`) при отправке.

`Minzdrav/utils/panels.ts` — `mainRows(isStaff, isDoctor, isHead)` / `staffRows()` / `integrationSettingsRows()` возвращают `ActionRowBuilder` с кнопками и селектами.

## Структура

```
Minzdrav/
├── cogs/
│   ├── emias.ts   # /емиас (панель + onInteraction/handleModal)
│   ├── staff.ts   # /штаб
│   └── help.ts    # /помощь
├── events/
│   └── interactionCreate.ts # единый роутер кнопок/селектов/модалок (emias:*, staff:*, integ:*)
├── dataUtils/
│   ├── db.ts      # Prisma Client (PostgreSQL)
│   ├── emias.ts   # домен-логика (async/await, Prisma)
│   └── settings.ts# настройки интеграций (Settings модель)
├── utils/
│   ├── constants.ts
│   ├── embeds.ts  # контейнеры V2
│   ├── panels.ts  # ряды кнопок/селектов
│   └── permissions.ts
├── tasks/
│   ├── statusTask.ts  # ротация Watching (каждые 5 минут)
│   └── reminders.ts   # напоминания 24ч/1ч + 08:00 дайджест очереди
├── locales/
│   ├── ru.json
│   └── en.json
├── config.ts      # цвета, ICON_URL, BRAND_GRADIENT, FOOTER_TEXT
├── schema.txt     # Prisma-модели для вставки в основной schema.prisma (@@schema("emias"))
└── README.md
```

> ESM: все импорты с расширением `.js` (например, `from '../config.js'`), хотя исходники `.ts`. Сборка — `npm run build` → `dist/Minzdrav/`.

## Установка

1. Скопируй `Minzdrav` в форк `Department-Oversight-CustomCogs` (или работай в этом репо).
2. Добавь содержимое `Minzdrav/schema.txt:1` в основной `schema.prisma` проекта `Department-Oversight` (схема `emias`, PostgreSQL) → `npx prisma migrate dev --name emias` / `prisma db push`.
3. Задай `DATABASE_URL` в `.env` (PostgreSQL) и `TEST_BOT_TOKEN` для локального теста.
4. Собери и проверь:
   ```bash
   npm ci
   npm run build
   npm run check:load  # должен показать [Command] /емиас, /штаб, /помощь
   ```

## Первый запуск

- Админ сервера: `/штаб` → Добавить → Discord ID, ФИО, роль `Главный врач`.
- Далее главврач: `/штаб` → Добавить остальных.
- Граждане: `/емиас` → Привязать (код с сайта) или Код для сайта → Записаться.

## Тест

```bash
npm run build
npm run test:minzdrav
# или
node dist/index.js Minzdrav
# требует TEST_BOT_TOKEN в .env
# Логи: Загружена команда: /емиас, /штаб, /помощь
#       Загружена задача: status-changer, reminders
#       Загружено событие: interactionCreate
```

Локальная верификация без токена:

```bash
npm run typecheck
npm run check:load
```

## Локализация

Ключи — `emias.*` в `locales/ru.json:1` / `en.json`. Используются через `t(lang, key)` из `utils/locale.ts` (прокси к основному боту). Язык берётся через `getLang(guildId)`.

## Примечания по разработке

- Не коммить `dist/` — генерируется сборкой.
- Не меняй `index.ts` — тестовый раннер общий для всех фракций.
- Соблюдай `type: module` — только `import`/`export`, `require()` запрещён (ловит CI).
