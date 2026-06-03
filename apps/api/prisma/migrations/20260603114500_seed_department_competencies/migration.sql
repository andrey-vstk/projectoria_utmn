-- Seed initial competencies without overwriting later administrator changes.
UPDATE "Department"
SET "competencies" = ARRAY['Программная инженерия', 'Data Science', 'Искусственный интеллект']
WHERE "code" = 'ШКН' AND cardinality("competencies") = 0;

UPDATE "Department"
SET "competencies" = ARRAY['Естественно-научные исследования', 'Лабораторные исследования']
WHERE "code" = 'ШЕН' AND cardinality("competencies") = 0;

UPDATE "Department"
SET "competencies" = ARRAY['Прототипирование', 'Инженерные решения', 'Промышленная автоматизация']
WHERE "code" = 'ПИШ' AND cardinality("competencies") = 0;

UPDATE "Department"
SET "competencies" = ARRAY['Экономика', 'Управление', 'Бизнес-процессы']
WHERE "code" = 'ФЭИ' AND cardinality("competencies") = 0;
