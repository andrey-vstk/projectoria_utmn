'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';

interface SettingItem {
  id: string;
  key: string;
  value: string;
}

export default function AdminSettingsPage() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<SettingItem[]>('/system-settings', {
        method: 'GET',
        withCsrf: false,
      });
      setItems(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upsert = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest('/system-settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
      setKey('');
      setValue('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ProtectedPage>
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Админка: системные настройки</h1>
            <p className="page-subtitle">Ключ-значение для технических параметров MVP.</p>
          </div>
        </div>

        <AdminOnly>
          <Card className="card-soft">
            <div className="section-head">
              <div>
                <h3 className="section-title">Добавить / обновить настройку</h3>
              </div>
            </div>

            <form onSubmit={upsert} className="grid-3">
              <div className="field">
                <label className="label">Ключ</label>
                <Input value={key} onChange={(e) => setKey(e.target.value)} required />
              </div>
              <div className="field" style={{ gridColumn: '2 / span 2' }}>
                <label className="label">Значение</label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} required />
              </div>
              <div>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="section-head">
              <div>
                <h3 className="section-title">Текущие настройки</h3>
              </div>
            </div>

            {loading ? <p className="muted">Загрузка...</p> : null}
            {error ? <p className="message-danger">{error}</p> : null}

            {!loading ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ключ</th>
                      <th>Значение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.key}</td>
                        <td>{item.value}</td>
                      </tr>
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="muted">
                          Нет настроек.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        </AdminOnly>
      </div>
    </ProtectedPage>
  );
}
