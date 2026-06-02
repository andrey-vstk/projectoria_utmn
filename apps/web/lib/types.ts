export interface UserShort {
  id: string;
  email: string;
  fullName: string;
}

export interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  queuedAt?: string | null;
  processingAt?: string | null;
  sendingAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserShort;
  analysis?: {
    id: string;
    summary: string;
    generationStatus: string;
    updatedAt: string;
  } | null;
  _count: {
    mailings: number;
    responses: number;
  };
}

export interface DepartmentRecipient {
  email: string;
  displayName?: string | null;
}

export interface ProjectSuggestion {
  id: string;
  departmentId: string;
  relevanceReason: string;
  problemFragment: string;
  adaptedPitch: string;
  emailSubject: string;
  emailBody: string;
  includeInMailing: boolean;
  customSubject?: string | null;
  customBody?: string | null;
  customRecipients?: string[] | null;
  department: {
    id: string;
    code: string;
    name: string;
    recipients: DepartmentRecipient[];
  };
}

export interface ProjectDetail {
  id: string;
  title: string;
  sourceText: string;
  status: string;
  queuedAt?: string | null;
  processingAt?: string | null;
  readyAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserShort;
  analysis?: {
    id: string;
    summary: string;
    tasksJson: Array<{ title: string; description: string; priority: string }>;
    rawJson: unknown;
    generationStatus: string;
    suggestions: ProjectSuggestion[];
  } | null;
  mailings: Array<{
    id: string;
    subject: string;
    status: string;
    sentAt?: string | null;
    department: { id: string; code: string; name: string };
    response?: { id: string; decision: string } | null;
  }>;
  responses: Array<{
    id: string;
    responderEmail?: string | null;
    responderName?: string | null;
    decision: string;
    respondedAt: string;
    department: { id: string; code: string; name: string };
  }>;
}
