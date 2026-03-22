'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await apiRequest<{ text: string; fileName: string }>(
        '/projects/extract-text',
        {
          method: 'POST',
          body: formData,
        },
      );
      setSourceText(data.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const project = await apiRequest<{ id: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify({ title, sourceText }),
      });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Новый проект</h1>
            <p className="page-subtitle">
              Введите стенограмму вручную или загрузите файл `.txt` для автоматического
              извлечения текста.
            </p>
          </div>
        </div>

        <Card className="card-soft">
          <div className="section-head">
            <div>
              <h3 className="section-title">Карточка запроса</h3>
              <p className="section-subtitle">
                После сохранения можно запускать анализ LLM, редактировать письма и рассылать их
                подразделениям.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="stack-md">
            <div className="field">
              <label className="label">Название проекта</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Цифровой двойник производственной линии"
                required
              />
            </div>

            <div className="field">
              <label className="label">Текст запроса / стенограмма</label>
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Вставьте полный текст встречи с заказчиком..."
                required
              />
            </div>

            <div className="field">
              <label className="label">Загрузка файла (MVP: только .txt)</label>
              <Input type="file" accept=".txt,text/plain" onChange={onFile} />
              {uploading ? <span className="muted">Извлекаем текст...</span> : null}
            </div>

            {error ? <p className="message-danger">{error}</p> : null}

            <div className="form-actions">
              <Button type="submit" disabled={submitting || uploading}>
                {submitting ? 'Сохраняем...' : 'Создать проект'}
              </Button>
              <Button variant="secondary" onClick={() => router.push('/')}>
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedPage>
  );
}
