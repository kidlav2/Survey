# Skeleton Loading Components

Набор готовых skeleton loading компонентов для отображения во время загрузки данных в админке и опросном приложении.

## Компоненты

### 1. SkeletonCard
**Файл:** `src/components/common/SkeletonCard.tsx`

Базовая карточка-скелет для одного вопроса в конструкторе опросов.

**Использование:**
```tsx
import SkeletonCard from '../common/SkeletonCard';

function SurveyBuilder() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        // Содержимое
      )}
    </div>
  );
}
```

### 2. SkeletonQuestion
**Файл:** `src/components/common/SkeletonQuestion.tsx`

Расширенная карточка-скелет с полным содержимым вопроса (текст, тип, опции, кнопки).

**Использование:**
```tsx
import SkeletonQuestion from '../common/SkeletonQuestion';

function SurveyBuilder() {
  const [loading, setLoading] = useState(true);

  return loading ? (
    <div className="space-y-4">
      <SkeletonQuestion />
      <SkeletonQuestion />
    </div>
  ) : (
    // Содержимое
  );
}
```

### 3. SkeletonQuestionFlow
**Файл:** `src/components/common/SkeletonQuestionFlow.tsx`

Скелет для страницы прохождения опроса - отображает загрузку вопроса с прогрессбаром и опциями ответов.

**Использование:**
```tsx
import SkeletonQuestionFlow from '../common/SkeletonQuestionFlow';

function SurveyFlow() {
  const [loading, setLoading] = useState(true);

  return loading ? (
    <SkeletonQuestionFlow />
  ) : (
    // Вопрос и ответы
  );
}
```

### 4. SkeletonSurveyCard
**Файл:** `src/components/common/SkeletonSurveyCard.tsx`

Карточка-скелет опроса для списка в тестовом режиме (название, описание, статистика, кнопки).

**Использование:**
```tsx
import SkeletonSurveyCard from '../common/SkeletonSurveyCard';

function Surveys() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {loading ? (
        <>
          <SkeletonSurveyCard />
          <SkeletonSurveyCard />
          <SkeletonSurveyCard />
          <SkeletonSurveyCard />
        </>
      ) : (
        // Карточки опросов
      )}
    </div>
  );
}
```

### 5. SkeletonResponseTable
**Файл:** `src/components/common/SkeletonResponseTable.tsx`

Таблица-скелет для отображения ответов респондентов (список ответов на вопросы).

**Использование:**
```tsx
import SkeletonResponseTable from '../common/SkeletonResponseTable';

function Responses() {
  const [loading, setLoading] = useState(true);

  return loading ? (
    <SkeletonResponseTable />
  ) : (
    // Таблица ответов
  );
}
```

### 6. SkeletonDashboard
**Файл:** `src/components/common/SkeletonDashboard.tsx`

Полный скелет для главной страницы админки (статистика + сетка опросов).

**Использование:**
```tsx
import SkeletonDashboard from '../common/SkeletonDashboard';

function Dashboard() {
  const [loading, setLoading] = useState(true);

  return loading ? (
    <SkeletonDashboard />
  ) : (
    // Содержимое всей страницы
  );
}
```

## Особенности

- ✅ **Responsive** - адаптивны для всех размеров экрана
- ✅ **Анимация** - плавная пульсирующая анимация (`animate-pulse`)
- ✅ **Соответствие дизайну** - совпадают с реальными компонентами
- ✅ **Многоязычные** - не содержат текста, только структуру
- ✅ **Легко интегрируются** - просто замените на скелет во время загрузки

## Пример интеграции

```tsx
import { useState, useEffect } from 'react';
import SkeletonQuestion from '../common/SkeletonQuestion';

function SurveyBuilder() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await fetchQuestions();
      setQuestions(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <>
          <SkeletonQuestion />
          <SkeletonQuestion />
          <SkeletonQuestion />
        </>
      ) : (
        questions.map(q => <QuestionCard key={q.id} question={q} />)
      )}
    </div>
  );
}
```

## Стили

Все компоненты используют Tailwind CSS классы:
- `animate-pulse` - пульсирующая анимация
- `bg-gray-200`, `bg-gray-300` - разные уровни яркости для эффекта глубины
- `rounded` - скругленные углы
- Стандартные padding и margin значения

Вы можете кастомизировать цвета, скорость анимации и размеры, отредактировав Tailwind конфиг или встроенные стили.
