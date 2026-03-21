import { ResponsesService } from './responses.service';

describe('ResponsesService', () => {
  let service: ResponsesService;
  let prisma: {
    mailing: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { create: jest.Mock };
  let mailService: { sendNotification: jest.Mock };

  beforeEach(() => {
    prisma = {
      mailing: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    notifications = {
      create: jest.fn(),
    };
    mailService = {
      sendNotification: jest.fn(),
    };

    service = new ResponsesService(
      prisma as never,
      notifications as never,
      mailService as never,
    );
  });

  it('фиксирует отклик по токену и отправляет уведомление', async () => {
    prisma.mailing.findUnique.mockResolvedValue({
      id: 'm1',
      projectId: 'p1',
      departmentId: 'd1',
      tokenUsed: false,
      response: null,
      project: {
        title: 'Проект',
        authorId: 'u1',
        author: {
          id: 'u1',
          email: 'author@utmn.local',
          fullName: 'Author',
        },
      },
      department: {
        name: 'ШКН',
        code: 'ШКН',
      },
    });

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        response: {
          create: jest.fn().mockResolvedValue({ id: 'r1' }),
        },
        mailing: {
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.submitByToken(
      'token',
      {
        responderEmail: 'team@utmn.local',
        responderName: 'Иван Иванов',
      },
      {},
    );

    expect(result.ok).toBe(true);
    expect(result.alreadyResponded).toBe(false);
    expect(notifications.create).toHaveBeenCalled();
    expect(mailService.sendNotification).toHaveBeenCalled();
  });
});
