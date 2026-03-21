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
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let analysisService: { enqueueAnalysis: jest.Mock };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
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
    });
    prisma.project.update.mockResolvedValue({});

    await service.queueAnalysis('p1', {
      sub: 'u1',
      email: 'u@u.ru',
      role: Role.INITIATOR,
    });

    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: ProjectStatus.QUEUED }),
      }),
    );
    expect(analysisService.enqueueAnalysis).toHaveBeenCalledWith('p1');
  });
});
