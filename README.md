# CustomCogs — Кастомные коги для бота «Управление Департаментами»

Данный репозиторий содержит пользовательские коги (модули) для Discord-бота **Управление Департаментами** — проекта сообщества **ER:LC Россия**.

## Назначение

Фракции и организации сообщества могут разрабатывать собственные коги для автоматизации внутрифракционных задач: модерация, логирование, выдача ролей, кастомные команды, фоновые задачи и т.д.

Готовые коги публикуются через Pull Request. После ревью код принимается или отклоняется.

## Структура репозитория

```
CustomCogs/
├── <Фракция>/
│   ├── cogs/       # Слэш-команды
│   ├── events/     # Обработчики событий Discord
│   ├── tasks/      # Фоновые задачи
│   ├── dataUtils/  # Файлы для работы с БД (Prisma)
│   ├── utils/      # Вспомогательные файлы
│   └── config.js   # Конфигурация кога
├── Starter-Kit/    # Заготовка для новой фракции
├── index.js        # Тестовый запуск (node index.js <фракция>)
├── README.md
├── CONTRIBUTING.md
└── LICENSE.md
```

Полные требования и примеры — в [CONTRIBUTING.md](./CONTRIBUTING.md).

## Доступные пакеты

Бот предоставляет `discord.js`, `@prisma/client`, `winston`, `axios`, `luxon` и другие. Добавление новых пакетов — только через тикет.

## Тестирование

```bash
node index.js MVD
```

Файл `index.js` **нельзя редактировать**. Для изменения логики тестирования создайте отдельный скрипт.

## Список фракций

| Директория | Фракция |
|-----------|---------|
| `FSB/` | Федеральная Служба Безопасности |
| `MCHS/` | МЧС России |
| `Minzdrav/` | Министерство Здравоохранения |
| `MVD/` | Министерство Внутренних Дел |

## Локализация

Локализация для каждого кастомного бота вынесена в отдельную папку `/locales` с JSON-файлами. Основной бот автоматически обрабатывает загрузку локализаций для каждого кога.

### Как работает локализация

Ключи в локализации когов используют префикс имени кога (например, `erl.sessions.durMinutes` для бота `erlcrussia`). Основной бот автоматически определяет, к какому когу относится ключ, и загружает локализацию из соответствующей папки.

Основной бот использует язык гильдии из общей базы данных. Язык автокомплита и интерфейса кастомного бота зависит от языка основного бота — то есть если на сервере выбран русский язык, все кастомные боты тоже будут отвечать на русском.

### Добавление новой локализации

1. Создайте файл `locales/ru.json` и/или `en.json` в папке вашего кога
2. Структура JSON-файла — объект с ключами в формате `namespace.command.key`:
   ```json
   {
     "erl": {
       "hello": {
         "greeting": "Привет, {0}!"
       }
     }
   }
   ```
3. Уберите соответствующие ключи из основных файлов `locales/ru.json` и `locales/en.json` — они теперь живут в папке кога.

### Использование в коде кога

Импортируйте `t` и `getLang` из основного модуля локализации:

```js
const { SlashCommandBuilder } = require('discord.js');
const { t, getLang } = require('../../../utils/locale');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('команда')
        .setNameLocalizations({ 'en-US': 'command', 'en-GB': 'command' })
        .setDescription('Описание команды.')
        .setDescriptionLocalizations({
            'en-US': 'Command description.',
            'en-GB': 'Command description.',
            'ru': 'Описание команды.'
        })
        .addStringOption(opt =>
            opt.setName('никнейм')
                .setNameLocalizations({ 'en-US': 'nickname', 'en-GB': 'nickname' })
                .setDescription('Описание параметра.')
                .setDescriptionLocalizations({
                    'en-US': 'Parameter description.',
                    'en-GB': 'Parameter description.',
                    'ru': 'Описание параметра.'
                })
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        const lang = await getLang(interaction.guildId);
        await interaction.reply({ content: t(lang, 'erl.hello.greeting', interaction.user.username) });
    }
};
```

> **Важно:** язык бота определяется языком основного бота. Язык гильдии берётся из общей базы данных через `getLang(interaction.guildId)`.

## Лицензия

Распространяется под лицензией Creative Commons Attribution-NonCommercial 4.0 International. Подробнее — в файле [LICENSE.md](./LICENSE.md).
