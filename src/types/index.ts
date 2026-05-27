export interface Config {
  feishu: {
    appId: string;
    appSecret: string;
    configDocUrl: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  schedule: {
    cron: string;
    timezone: string;
  };
  concurrency: {
    maxCollectors: number;
    maxReminders: number;
  };
}

export interface Student {
  studentId: string;
  name: string;
  docUrl: string;
  feishuUserId?: string;
}

export interface StudentSummary {
  learned: string[];
  notLearned: string[];
  questions: string[];
}

export interface StudentResult {
  studentId: string;
  name: string;
  status: 'submitted' | 'not_submitted' | 'error';
  summary?: StudentSummary;
  error?: string;
}

export interface TaskData {
  taskId: string;
  type: 'collect' | 'remind';
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  input: {
    students?: Student[];
    studentIds?: string[];
  };
  output?: {
    results: StudentResult[] | ReminderResult[];
  };
  errors: string[];
}

export interface ReminderResult {
  studentId: string;
  name: string;
  success: boolean;
  error?: string;
}

export interface DailyReport {
  date: string;
  totalStudents: number;
  submitted: number;
  notSubmitted: number;
  students: StudentResult[];
  remindersSent: number;
  executionTime: string;
}

export interface FeishuAccessToken {
  token: string;
  expireAt: number;
}

export interface FeishuDocContent {
  content: string;
  lastModified: string;
}
