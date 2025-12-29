// src/types.ts

export enum NodeType {
  SECTION = 'SECTION',
  QUESTION = 'QUESTION',
  TEXT = 'TEXT' // 纯文本/媒体节点
}

export enum QuestionType {
  LIKERT_SCALE = 'LIKERT_SCALE',
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  TEXT_AREA = 'TEXT_AREA'
}

export interface Option {
  id: string;
  label: string;
}

export interface SurveyNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  imageUrl?: string; // 支持图片
  
  // 👇 新增这一行：自定义编号
  customId?: string; 

  required?: boolean;
  children: SurveyNode[]; // 嵌套结构

  // 问题特定字段
  questionType?: QuestionType;
  likertScale?: number; // 5 or 7
  options?: Option[]; // for Single Choice
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  nodes: SurveyNode[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_at: string;
  round: number;
  total_rounds: number;
  deadline?: string;
  language: 'en' | 'cn';
  access_code?: string; // Access code for experts
}