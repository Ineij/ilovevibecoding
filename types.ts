
export enum UserRole {
  ADMIN = 'ADMIN',
  EXPERT = 'EXPERT',
  VISITOR = 'VISITOR'
}

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  LIKERT_SCALE = 'LIKERT_SCALE',
  TEXT_AREA = 'TEXT_AREA',
  TRUE_FALSE = 'TRUE_FALSE'
}

export enum NodeType {
  SECTION = 'SECTION',
  QUESTION = 'QUESTION',
  TEXT = 'TEXT'
}

export interface Option {
  id: string;
  label: string;
}

export interface SurveyNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string; // Acts as "Explanation Pattern" or "Body Text" for TEXT nodes
  imageUrl?: string; // New: Supports Pattern Images
  children: SurveyNode[]; // Recursive children
  
  // Question specific fields (only used if type === QUESTION)
  questionType?: QuestionType;
  required?: boolean;
  options?: Option[];
  likertScale?: 5 | 7;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string; // New field for H2 Subtitle
  description: string; // Acts as Body Introduction
  round: number;
  totalRounds: number;
  deadline: string; // ISO Date
  nodes: SurveyNode[]; // Root level nodes (Tree structure)
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'WAITING';
  language?: 'en' | 'cn'; // New: Language of the survey
}

export interface ExpertProfile {
  name: string;
  institution: string;
  title: string;
  field: string;
  yearsOfExperience: number;
  isRegistered: boolean;
}

export interface Response {
  questionId: string;
  value: string | string[] | number;
}
