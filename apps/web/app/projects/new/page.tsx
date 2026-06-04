'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/protected-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/api';

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recorderSupported, setRecorderSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setRecorderSupported(typeof window !== 'undefined' && 'MediaRecorder' in window);
    const speechApi =
      typeof window !== 'undefined'
        ? (window as Window & {
            SpeechRecognition?: BrowserSpeechRecognitionConstructor;
            webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
          }).SpeechRecognition ??
          (window as Window & {
            SpeechRecognition?: BrowserSpeechRecognitionConstructor;
            webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
          }).webkitSpeechRecognition
        : undefined;
    setSpeechSupported(Boolean(speechApi));

    return () => {
      recognitionRef.current?.abort();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

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

  const appendTranscript = (text: string) => {
    const transcript = text.trim();
    if (!transcript) {
      return;
    }
    setSourceText((current) => {
      const separator = current.trim() ? '\n\n' : '';
      return `${current}${separator}${transcript}`;
    });
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as Window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      }).SpeechRecognition ??
      (window as Window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setLiveTranscript('Браузер записывает аудио, но не поддерживает распознавание речи.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText.trim()) {
        appendTranscript(finalText);
      }
      setLiveTranscript(interimText.trim());
    };
    recognition.onerror = (event) => {
      setLiveTranscript(
        event.error
          ? `Распознавание остановлено: ${event.error}`
          : 'Распознавание речи временно недоступно.',
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const startRecording = async () => {
    if (!recorderSupported) {
      setRecordingError('Браузер не поддерживает запись аудио.');
      return;
    }

    setRecordingError(null);
    setLiveTranscript('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(URL.createObjectURL(audioBlob));
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };
      recorder.start();
      setRecording(true);
      startSpeechRecognition();
    } catch {
      setRecordingError('Не удалось получить доступ к микрофону.');
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecording(false);
    setLiveTranscript('');
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

        <section className="new-project-tool">
          <div className="new-project-tool-head">
            <div>
              <h3 className="section-title">Карточка запроса</h3>
              <p className="section-subtitle">
                После сохранения можно запускать анализ LLM, редактировать письма и рассылать их
                подразделениям.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="new-project-form">
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
                className="new-project-textarea"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Вставьте полный текст встречи с заказчиком..."
                required
              />
            </div>

            <div className="field">
              <label className="label">Загрузка файла</label>
              <label className="file-upload-control">
                <span className="file-upload-title">Выбрать TXT-файл</span>
                <span className="file-upload-hint">Текст из файла будет вставлен в стенограмму</span>
                <Input type="file" accept=".txt,text/plain" onChange={onFile} />
              </label>
              {uploading ? <span className="muted">Извлекаем текст...</span> : null}
            </div>

            <div className="recording-panel">
              <div className="recording-panel-head">
                <div className={recording ? 'recording-mic recording-mic-active' : 'recording-mic'}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M18 10.5A6 6 0 0 1 6 10.5M12 16.5V21m-3 0h6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="recording-title">Запись разговора</h4>
                  <p className="recording-description">
                    Запишите встречу с заказчиком: аудио останется в браузере, а поддерживаемые
                    браузеры сразу добавят расшифровку в стенограмму.
                  </p>
                </div>
              </div>
              <div className="recording-controls">
                <span className={recording ? 'recording-indicator recording-indicator-active' : 'recording-indicator'}>
                  {recording ? 'Идет запись' : 'Готово к записи'}
                </span>
                {!recording ? (
                  <Button type="button" onClick={startRecording} disabled={!recorderSupported}>
                    Начать запись
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="danger"
                    className="recording-stop-button"
                    onClick={stopRecording}
                    aria-label="Остановить запись"
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                    </svg>
                  </Button>
                )}
              </div>
              {!speechSupported ? (
                <p className="muted recording-note">
                  Распознавание речи недоступно в этом браузере. Рекомендуемый вариант: Chrome.
                </p>
              ) : null}
              {liveTranscript ? <p className="recording-live">{liveTranscript}</p> : null}
              {recordingError ? <p className="message-danger">{recordingError}</p> : null}
              {audioUrl ? (
                <audio className="recording-audio" src={audioUrl} controls>
                  Ваш браузер не поддерживает прослушивание записи.
                </audio>
              ) : null}
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
        </section>
      </div>
    </ProtectedPage>
  );
}
