# CustomCogs — Кастомные коги для бота «Управление Департаментами»

Данный репозиторий содержит пользовательские коги (модули) для Discord-бота **Управление Департаментами** — проекта сообщества **ER:LC Россия**.

## Назначение

Фракции и организации сообщества могут разрабатывать собственные коги для автоматизации внутрифракционных задач: модерация, логирование, выдача ролей, кастомные команды, фоновые задачи и т.д.

Готовые коги публикуются через Pull Request. После ревью код принимается или отклоняется.

## Требования

- **Node.js >= 18.17** (см. `engines` в `package.json`)
- **TypeScript 5.8+**, проект собирается в `dist/` (`npm run build`)
- **ESM** — в `package.json` установлено `"type": "module"`, используйте `import`/`export`

## Структура репозитория

```
CustomCogs/
├── <Фракция>/          # MVD, FSB, FSVNG, MCHS, Minzdrav, Pravo
│   ├── cogs/           # Слэш-команды (*.ts)
│   ├── events/         # Обработчики событий Discord (*.ts)
│   ├── tasks/          # Фоновые задачи (*.ts, { name, interval, execute })
│   ├── dataUtils/      # Файлы для работы с БД (Prisma)
│   ├── utils/          # Вспомогательные файлы фракции
│   ├── locales/        # Локализация фракции (ru.json, en.json)
│   └── config.ts       # Конфигурация кога (ICON_URL, цвета и т.д.)
├── Starter-Kit/        # Заготовка для новой фракции (эталон)
│   ├── cogs/hello.ts
│   ├── events/ready.ts
│   ├── tasks/statusTask.ts
│   ├── config.ts
│   └── locales/ utils/ dataUtils/
├── utils/
│   └── locale.ts       # Обёртка над основным t/getLang (прокси к Department-Oversight)
├── scripts/
│   └── checkLoad.js    # Верификация загрузки всех фракций из dist/
├── index.ts            # Тестовый запуск (ESM, компилируется в dist/index.js)
├── package.json        # type: module, scripts: build/typecheck/check:load
├── tsconfig.json       # target ES2022, module NodeNext, outDir dist/
├── .github/workflows/checks.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE.md
```

> **Примечание:** исходники — всегда `*.ts` в корне фракции, скомпилированные `*.js` попадают в `dist/<Фракция>/`. Не коммитьте `dist/` — он генерируется CI.

Полные требования и примеры — в [CONTRIBUTING.md](./CONTRIBUTING.md).

## Доступные пакеты

Бот предоставляет пакеты из `package.json` в корне репозитория. Актуальный список:

| Пакет | Назначение |
|-------|-----------|
| `discord.js` `^14.23.2` | Работа с Discord API (слэш-команды, события, компоненты) |
| `@prisma/client` / `prisma` `^7.4.0` | ORM для работы с базой данных |
| `winston` `^3.17.0` | Логирование |
| `luxon` `^3.7.2` | Работа с датой и временем |
| `axios` `^1.12.2` | HTTP-запросы |
| `dotenv` `^16.6.1` | Загрузка переменных из `.env` |

Добавление новых пакетов — только через тикет. Не редактируйте `package.json`/`package-lock.json` без ревью.

## Установка и сборка

```bash
npm ci              # установка зависимостей
npm run typecheck   # проверка типов (tsc --noEmit)
npm run build       # компиляция TS -> dist/
npm run check:load  # верификация загрузки всех фракций из dist/
```

## Тестирование

Исходный `index.ts` компилируется в `dist/index.js` и используется для локального запуска. Файл `index.ts` **нельзя редактировать** — для кастомной логики тестирования создайте отдельный скрипт.

```bash
npm run build

# Через npm-скрипты (рекомендуется):
npm run test:mvd
npm run test:fsb
npm run test:mchs
npm run test:minzdrav

# Или напрямую:
node dist/index.js MVD
node dist/index.js Minzdrav
# требует TEST_BOT_TOKEN или DISCORD_TOKEN в .env
```

Логи при успешном запуске:

```
[INFO] Загружена команда: /привет
[INFO] Загружена задача: status-changer
[INFO] Загружено событие: ready
[INFO] Тестовый бот <tag> запущен для фракции MVD
```

CI (`.github/workflows/checks.yml`) на каждый PR запускает `typecheck` → `build` → `check:load` и скан на `eval()` / `process.env` в `require()`.

## Список фракций

| Директория | Фракция | Статус |
|-----------|---------|--------|
| `FSB/` | Федеральная Служба Безопасности | заготовка (`config.ts` + `statusTask.ts`) |
| `FSVNG/` | Федеральная Служба Войск Национальной Гвардии | заготовка |
| `MCHS/` | МЧС России | заготовка |
| `Minzdrav/` | Министерство Здравоохранения (ЕМИАС) | реализовано — см. [Minzdrav/README.md](./Minzdrav/README.md) |
| `MVD/` | Министерство Внутренних Дел | заготовка |
| `Pravo/` | Право (юридический блок) | заготовка |
| `Starter-Kit/` | Шаблон для новой фракции | эталон (`hello.ts`, `ready.ts`, `statusTask.ts`) |

## Локализация

Локализация для каждой фракции вынесена в отдельную папку `<Фракция>/locales/` с JSON-файлами (`ru.json`, `en.json`). Основной бот автоматически обрабатывает загрузку локализаций. Прокси-модуль `utils/locale.ts` делегирует вызовы в основной бот (`Department-Oversight/utils/locale`).

### Как работает локализация

Ключи используют префикс фракции/неймспейса (например, `emias.help.title` или `erl.hello.greeting`). Основной бот определяет фракцию по ключу и грузит файл из `<Фракция>/locales/`.

Язык гильдии берётся из общей БД через `getLang(guildId)`. Язык автокомплита и интерфейса кастомного кога наследуется от языка основного бота — если на сервере выбран русский, кастомные коги тоже отвечают на русском.

### Добавление новой локализации

1. Создайте `locales/ru.json` и/или `locales/en.json` в папке вашей фракции:
   ```json
   {
     "emias": {
       "help": {
         "title": "ЕМИАС — помощь"
       }
     }
   }
   ```
2. Не дублируйте ключи в корневых `locales/` основного бота — они должны жить только в папке кога.

### Использование в коде кога (TypeScript + ESM)

> Важно: в ESM импортах указывайте расширение `.js` даже для `.ts` исходников.

```ts
import { SlashCommandBuilder } from 'discord.js';
import { t, getLang } from '../../utils/locale.js';

export default {
    data: new SlashCommandBuilder()
        .setName('привет')
        .setNameLocalizations({ 'en-US': 'hello', 'en-GB': 'hello' })
        .setDescription('Простое приветствие от бота.')
        .setDescriptionLocalizations({
            'en-US': 'A simple greeting from the bot.',
            'en-GB': 'A simple greeting from the bot.',
            'ru': 'Простое приветствие от бота.'
        }),

    async execute(interaction) {
        const lang = await getLang(interaction.guildId);
        await interaction.reply({
            content: t(lang, 'emias.help.title', interaction.user.username),
            allowedMentions: { parse: [] }
        });
    }
};
```

Эталон — `Starter-Kit/cogs/hello.ts:1`.

## Шаблоны кода

### Слэш-команда (`cogs/*.ts`)

```ts
import { SlashCommandBuilder } from 'discord.js';
import { t, getLang } from '../../utils/locale.js';

export default {
  data: new SlashCommandBuilder().setName('команда').setDescription('Описание'),
  async execute(interaction) { /* ... */ },
  // опционально для компонентов:
  async onInteraction(interaction, context) { return false; },
  async handleModal(interaction, context) { return false; }
};
```

### Событие (`events/*.ts`)

```ts
export default {
    name: 'ready',
    once: true,
    async execute(...args: any[]) {
        const logger = (global as any).logger || console;
        logger.info('Бот готов к работе!');
    }
};
```

См. `Starter-Kit/events/ready.ts:1`.

### Фоновая задача (`tasks/*.ts`)

```ts
import { ActivityType } from 'discord.js';

export default {
  name: 'status-changer',
  interval: 300000, // 5 минут
  execute: (client, logger) => {
    if (!client.user) return;
    client.user.setActivity('ER:LC Россия', { type: ActivityType.Watching });
    logger.info('Статус обновлён');
  }
};
```

См. `Starter-Kit/tasks/statusTask.ts:1`.

### Конфигурация (`config.ts`)

```ts
const ICON_URL = "https://cdn.erlcrussia.com/images/Moscow-RolePlay-Icon-Website.png";
const HEX_COLOR = 0x0063B0;

export default { ICON_URL, HEX_COLOR };
export { ICON_URL, HEX_COLOR };
```

## Лицензия

Распространяется под лицензией Creative Commons Attribution-NonCommercial 4.0 International. Подробнее — в файле [LICENSE.md](./LICENSE.md).
