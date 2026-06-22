export type TaskPriority = 'high' | 'medium' | 'low';

export interface LlmTask {
  title: string;
  description: string;
  priority: TaskPriority;
}

export interface LlmDepartmentSuggestion {
  departmentCode: string;
  relevanceReason: string;
  problemFragment: string;
  adaptedPitch: string;
  emailSubject: string;
  emailBody: string;
}

export interface LlmStructuredResult {
  summary: string;
  tasks: LlmTask[];
  departmentSuggestions: LlmDepartmentSuggestion[];
}

export interface LlmAnalysisInput {
  projectId?: string;
  projectTitle: string;
  sourceText: string;
  departments: Array<{
    code: string;
    name: string;
    competencies: string[];
    employeeCompetencies: string[];
  }>;
}
