import { ProjectStatus, Role } from '@prisma/client';
import { AnalysisService } from '../analysis/analysis.service';
import { MailingsService } from '../mailings/mailings.service';
import { N8nService } from '../n8n/n8n.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    project: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    analysisResult: {
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let analysisService: { enqueueAnalysis: jest.Mock };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      analysisResult: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    analysisService = {
      enqueueAnalysis: jest.fn(),
    };

    service = new ProjectsService(
      prisma as unknown as PrismaService,
      analysisService as unknown as AnalysisService,
      { createDraftMailings: jest.fn() } as unknown as MailingsService,
      { notifyProjectCreated: jest.fn() } as unknown as N8nService,
    );
  });

  it('ставит проект в очередь на анализ', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'u1',
      status: ProjectStatus.DRAFT,
      author: { id: 'u1' },
      _count: { mailings: 0 },
    });
    prisma.project.updateMany.mockResolvedValue({ count: 1 });

    await service.queueAnalysis('p1', {
      sub: 'u1',
      email: 'u@u.ru',
      role: Role.INITIATOR,
    });

    expect(prisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'p1' }),
        data: expect.objectContaining({ status: ProjectStatus.QUEUED }),
      }),
    );
    expect(analysisService.enqueueAnalysis).toHaveBeenCalledWith('p1');
  });

  it('восстанавливает job, если анализ уже стоит в QUEUED', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'u1',
      status: ProjectStatus.QUEUED,
      author: { id: 'u1' },
      _count: { mailings: 0 },
    });

    const result = await service.queueAnalysis('p1', {
      sub: 'u1',
      email: 'u@u.ru',
      role: Role.INITIATOR,
    });

    expect(result).toEqual({ ok: true, alreadyQueued: true });
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
    expect(analysisService.enqueueAnalysis).toHaveBeenCalledWith('p1');
  });

  it('не добавляет второй job при гонке параллельных запусков анализа', async () => {
    prisma.project.findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        authorId: 'u1',
        status: ProjectStatus.DRAFT,
        author: { id: 'u1' },
        _count: { mailings: 0 },
      })
      .mockResolvedValueOnce({
        status: ProjectStatus.QUEUED,
      });
    prisma.project.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.queueAnalysis('p1', {
      sub: 'u1',
      email: 'u@u.ru',
      role: Role.INITIATOR,
    });

    expect(result).toEqual({ ok: true, alreadyQueued: true });
    expect(analysisService.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('сбрасывает анализ после изменения исходного текста', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'u1',
      sourceText: 'Исходный текст запроса заказчика',
      status: ProjectStatus.READY_FOR_REVIEW,
      _count: { mailings: 0 },
    });
    prisma.analysisResult.deleteMany.mockReturnValue('delete-analysis');
    prisma.project.update.mockReturnValue('update-project');
    prisma.$transaction.mockResolvedValue([]);

    const result = await service.updateSourceText(
      'p1',
      { sourceText: 'Обновленный текст запроса заказчика для повторного анализа' },
      {
        sub: 'u1',
        email: 'u@u.ru',
        role: Role.INITIATOR,
      },
    );

    expect(result).toEqual({ ok: true, analysisReset: true });
    expect(prisma.analysisResult.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        sourceText: 'Обновленный текст запроса заказчика для повторного анализа',
        status: ProjectStatus.DRAFT,
        queuedAt: null,
        readyAt: null,
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'delete-analysis',
      'update-project',
    ]);
  });
});
