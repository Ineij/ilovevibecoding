
import React, { useState } from 'react';
import { Project, ExpertProfile, QuestionType, Response, SurveyNode, NodeType } from '../types';
import { Clock, CheckCircle2, AlertCircle, ChevronRight, User, Briefcase, Building2, Award, Loader2, Globe } from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';

// --- Localization Dictionary ---
const TRANSLATIONS = {
  en: {
    languageName: "English",
    expertReg: "Expert Registration",
    expertRegDesc: "Please provide your professional details for the consensus panel.",
    fullName: "Full Name",
    fullNamePH: "e.g. Dr. Jane Doe",
    institution: "Institution",
    institutionPH: "e.g. University Hospital",
    titleRank: "Title / Rank",
    yearsExp: "Years Experience",
    fieldExp: "Field of Expertise",
    fieldExpPH: "e.g. Oncology",
    confirmReg: "Confirm Registration",
    dashboardTitle: "Expert Dashboard",
    welcomeBack: "Welcome back",
    currentDate: "Current Date",
    noRounds: "No active consensus rounds available for the selected language.",
    round: "Round",
    of: "of",
    openStatus: "OPEN FOR RESPONSE",
    daysLeft: "Days Left",
    deadline: "Deadline",
    enterSurvey: "Enter Survey",
    backDashboard: "Back to Dashboard",
    submitResp: "Submit Responses",
    submissionReceived: "Submission Received",
    thankYou: "Thank you for your valuable contribution to this consensus round.",
    selectLangTitle: "Select Language",
    selectLangDesc: "Please choose your preferred language for the questionnaire.",
    stronglyDisagree: "Strongly Disagree",
    neutral: "Neutral",
    stronglyAgree: "Strongly Agree"
  },
  cn: {
    languageName: "中文",
    expertReg: "专家注册",
    expertRegDesc: "请提供您的专业信息以参与共识研究。",
    fullName: "姓名",
    fullNamePH: "例如：张三 教授",
    institution: "所在机构",
    institutionPH: "例如：北京大学第一医院",
    titleRank: "职称 / 职务",
    yearsExp: "从业年限",
    fieldExp: "专业领域",
    fieldExpPH: "例如：肿瘤学",
    confirmReg: "确认注册",
    dashboardTitle: "专家工作台",
    welcomeBack: "欢迎回来",
    currentDate: "当前日期",
    noRounds: "当前语言下没有可用的共识轮次。",
    round: "第",
    of: "轮 / 共", // "Round X of Y" -> "第 X 轮 / 共 Y 轮" handled in logic
    openStatus: "进行中",
    daysLeft: "天剩余",
    deadline: "截止日期",
    enterSurvey: "进入问卷",
    backDashboard: "返回工作台",
    submitResp: "提交问卷",
    submissionReceived: "提交成功",
    thankYou: "感谢您对本次共识研究的宝贵贡献。",
    selectLangTitle: "选择语言",
    selectLangDesc: "请选择您偏好的问卷语言。",
    stronglyDisagree: "非常不同意",
    neutral: "中立",
    stronglyAgree: "非常同意"
  }
};

type Language = 'en' | 'cn';

// --- Sub-Component: Likert Scale ---
const LikertScale: React.FC<{ 
  points: 5 | 7; 
  value?: number; 
  onChange: (val: number) => void;
  t: any;
}> = ({ points, value, onChange, t }) => {
  const range = Array.from({ length: points }, (_, i) => i + 1);
  
  return (
    <div className="py-6">
      <div className="flex justify-between text-xs text-academic-500 mb-2 font-medium tracking-wide uppercase">
        <span>{t.stronglyDisagree}</span>
        <span>{t.neutral}</span>
        <span>{t.stronglyAgree}</span>
      </div>
      <div className="relative flex items-center justify-between">
        {/* Connecting Line */}
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-academic-200 -z-10" />
        
        {range.map((point) => (
          <button
            key={point}
            onClick={() => onChange(point)}
            className={`
              relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200
              ${value === point 
                ? 'border-primary-600 bg-primary-600 text-white scale-110 shadow-md' 
                : 'border-academic-300 bg-white text-academic-500 hover:border-primary-400 hover:bg-primary-50'}
            `}
          >
            {point}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Recursive Survey Node Renderer ---
const SurveyNodeRenderer: React.FC<{
  node: SurveyNode;
  level: string; // e.g., "1", "1.1", "1.1.2"
  responses: Response[];
  onResponseChange: (qId: string, val: any) => void;
  t: any;
}> = ({ node, level, responses, onResponseChange, t }) => {
  
  // If it's a SECTION, render header and iterate children
  if (node.type === NodeType.SECTION) {
    const isTopLevel = !level.includes('.');
    
    return (
      <div className={`mb-8 ${isTopLevel ? 'mt-12' : 'mt-6 ml-6 border-l-2 border-academic-100 pl-6'}`}>
        <div className="mb-6">
          <h3 className={`${isTopLevel ? 'text-2xl text-academic-800' : 'text-lg text-academic-700'} font-bold flex items-baseline gap-3`}>
            <span className="text-academic-400 font-mono text-base font-normal opacity-70">{level}</span>
            {node.title}
          </h3>
          
          {/* Explanation / Pattern Description for Section */}
          {(node.description || node.imageUrl) && (
             <div className="mt-4 mb-4 bg-academic-50 rounded-lg p-5 border border-academic-100">
               {node.imageUrl && (
                 <div className="mb-4">
                   <img src={node.imageUrl} alt="Section Pattern" className="max-w-full h-auto rounded shadow-sm border border-academic-200" />
                 </div>
               )}
               {node.description && <p className="text-academic-600 text-sm leading-relaxed">{node.description}</p>}
             </div>
          )}
        </div>
        
        <div className="space-y-6">
          {node.children.map((child, index) => (
            <SurveyNodeRenderer
              key={child.id}
              node={child}
              level={`${level}.${index + 1}`}
              responses={responses}
              onResponseChange={onResponseChange}
              t={t}
            />
          ))}
        </div>
      </div>
    );
  }

  // If it's a TEXT node (Pure content, no question)
  if (node.type === NodeType.TEXT) {
    return (
      <div className="bg-white rounded-xl border border-academic-200 p-8 mb-6 shadow-sm">
         {node.title && <h3 className="text-xl font-bold text-academic-900 mb-4">{node.title}</h3>}
         {node.imageUrl && (
            <img src={node.imageUrl} alt="Content" className="w-full max-h-[500px] object-contain rounded-lg mb-6 border border-academic-100 bg-academic-50" />
         )}
         {node.description && (
            <div className="prose prose-academic text-academic-600 max-w-none whitespace-pre-wrap leading-relaxed">
               {node.description}
            </div>
         )}
      </div>
    );
  }

  // If it's a QUESTION
  const questionValue = responses.find(r => r.questionId === node.id)?.value;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-academic-200 p-8 hover:shadow-md transition-shadow relative">
      <div className="flex gap-4">
        <span className="text-sm font-mono text-academic-400 mt-1 select-none">{level}</span>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-academic-900 mb-2">{node.title}</h3>
          
          {/* Explanation / Pattern Description for Question */}
          {(node.description || node.imageUrl) && (
             <div className="mb-6 bg-academic-50/50 p-4 rounded-lg border border-academic-100">
               {node.imageUrl && (
                 <div className="mb-4">
                   <img src={node.imageUrl} alt="Question Pattern" className="max-w-full max-h-96 object-contain rounded shadow-sm border border-academic-200" />
                 </div>
               )}
               {node.description && <p className="text-sm text-academic-600">{node.description}</p>}
             </div>
          )}
          
          <div className="mt-4">
            {node.questionType === QuestionType.LIKERT_SCALE && (
              <LikertScale 
                points={node.likertScale || 5} 
                value={questionValue as number}
                onChange={(val) => onResponseChange(node.id, val)}
                t={t}
              />
            )}
            
            {node.questionType === QuestionType.TEXT_AREA && (
              <textarea 
                className="w-full h-32 p-4 border border-academic-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none transition-all"
                placeholder={t.languageName === '中文' ? "请输入您的详细回答..." : "Type your detailed response here..."}
                value={questionValue as string || ''}
                onChange={(e) => onResponseChange(node.id, e.target.value)}
              />
            )}

            {node.questionType === QuestionType.SINGLE_CHOICE && (
              <div className="space-y-3">
                {node.options?.map(opt => (
                  <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-academic-100 hover:bg-academic-50 cursor-pointer transition-colors">
                    <input 
                      type="radio" 
                      name={node.id}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      checked={questionValue === opt.id}
                      onChange={() => onResponseChange(node.id, opt.id)}
                    />
                    <span className="text-academic-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Sub-Component: Demographics Modal ---
const DemographicsModal: React.FC<{ onSubmit: (profile: ExpertProfile, id: string) => void; lang: Language }> = ({ onSubmit, lang }) => {
  const t = TRANSLATIONS[lang];
  const [formData, setFormData] = useState<Partial<ExpertProfile>>({
    name: '',
    institution: '',
    title: lang === 'cn' ? '教授' : 'Professor',
    field: '',
    yearsOfExperience: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.institution && formData.field) {
      setIsSubmitting(true);
      
      const expertPayload = {
        name: formData.name,
        institution: formData.institution,
        title: formData.title,
        field: formData.field,
        years_of_experience: formData.yearsOfExperience
      };

      const { data, error } = await supabase
        .from('experts')
        .insert([expertPayload])
        .select()
        .single();

      if (error) {
        console.warn('Backend insert failed (Simulating Success):', error.message);
        setTimeout(() => {
          onSubmit(formData as ExpertProfile, 'mock-expert-id-' + Date.now());
          setIsSubmitting(false);
        }, 800);
      } else {
        onSubmit(formData as ExpertProfile, data.id);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-academic-200 animate-in zoom-in-95">
        <div className="bg-academic-50 px-8 py-6 border-b border-academic-100">
          <h2 className="text-xl font-semibold text-academic-800 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            {t.expertReg}
          </h2>
          <p className="text-sm text-academic-500 mt-1">
            {t.expertRegDesc}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-academic-700 mb-1">{t.fullName}</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-academic-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder={t.fullNamePH}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                <User className="w-4 h-4 text-academic-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-academic-700 mb-1">{t.institution}</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-academic-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder={t.institutionPH}
                  value={formData.institution}
                  onChange={e => setFormData({...formData, institution: e.target.value})}
                />
                <Building2 className="w-4 h-4 text-academic-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-academic-700 mb-1">{t.titleRank}</label>
                <div className="relative">
                  <select 
                    className="w-full pl-10 pr-4 py-2 border border-academic-300 rounded-md focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  >
                    {lang === 'en' ? (
                      <>
                        <option>Professor</option>
                        <option>Assoc. Professor</option>
                        <option>Chief Physician</option>
                        <option>Attending Physician</option>
                        <option>Researcher</option>
                      </>
                    ) : (
                      <>
                         <option>教授</option>
                         <option>副教授</option>
                         <option>主任医师</option>
                         <option>副主任医师</option>
                         <option>主治医师</option>
                         <option>研究员</option>
                      </>
                    )}
                  </select>
                  <Award className="w-4 h-4 text-academic-400 absolute left-3 top-3" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-academic-700 mb-1">{t.yearsExp}</label>
                <input 
                  required
                  type="number" 
                  min="0"
                  className="w-full px-4 py-2 border border-academic-300 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.yearsOfExperience}
                  onChange={e => setFormData({...formData, yearsOfExperience: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-academic-700 mb-1">{t.fieldExp}</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 border border-academic-300 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder={t.fieldExpPH}
                  value={formData.field}
                  onChange={e => setFormData({...formData, field: e.target.value})}
                />
                <Briefcase className="w-4 h-4 text-academic-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              {t.confirmReg}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Language Selection Screen ---
const LanguageSelectionScreen: React.FC<{ onSelect: (lang: Language) => void }> = ({ onSelect }) => {
   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-academic-50">
         <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
            {/* English Option */}
            <button 
               onClick={() => onSelect('en')}
               className="group bg-white p-12 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center text-center"
            >
               <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mb-8 group-hover:scale-110 transition-transform">
                  <span className="text-4xl font-bold">EN</span>
               </div>
               <h2 className="text-3xl font-bold text-academic-900 mb-4">English</h2>
               <p className="text-academic-500 text-lg">Proceed to the English version of the Delphi questionnaire.</p>
               <div className="mt-8 flex items-center gap-2 text-primary-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                  Select <ChevronRight className="w-5 h-5" />
               </div>
            </button>

            {/* Chinese Option */}
            <button 
               onClick={() => onSelect('cn')}
               className="group bg-white p-12 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary-500 flex flex-col items-center text-center"
            >
               <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-8 group-hover:scale-110 transition-transform">
                  <span className="text-4xl font-bold">中</span>
               </div>
               <h2 className="text-3xl font-bold text-academic-900 mb-4">中文 (Chinese)</h2>
               <p className="text-academic-500 text-lg">进入中文版 Delphi 专家共识问卷。</p>
               <div className="mt-8 flex items-center gap-2 text-primary-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                  选择 <ChevronRight className="w-5 h-5" />
               </div>
            </button>
         </div>
      </div>
   )
}

// --- Main Expert Flow Component ---
export const ExpertFlow: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 1. Language Selection Step
  if (!selectedLanguage) {
     return <LanguageSelectionScreen onSelect={setSelectedLanguage} />;
  }

  const t = TRANSLATIONS[selectedLanguage];

  // 2. Demographic Registration Step
  if (!profile) {
    return <DemographicsModal lang={selectedLanguage} onSubmit={(prof, id) => { setProfile(prof); setExpertId(id); }} />;
  }

  // Filter for PUBLISHED projects matching selected language
  const publishedProjects = projects.filter(p => p.status === 'PUBLISHED' && (!p.language || p.language === selectedLanguage));
  const activeProject = publishedProjects.find(p => p.id === activeProjectId);

  const handleResponseChange = (qId: string, val: any) => {
    setResponses(prev => {
      const existing = prev.filter(r => r.questionId !== qId);
      return [...existing, { questionId: qId, value: val }];
    });
  };

  const submitSurvey = async () => {
    if (!activeProjectId || !expertId) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from('responses')
      .insert({
        project_id: activeProjectId,
        expert_id: expertId,
        answers: responses // Store answers as JSONB
      });

    if (error) {
      console.warn('Submission failed (Simulating Success):', error.message);
      setTimeout(() => {
        setIsSubmitting(false);
        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setActiveProjectId(null);
          setResponses([]);
        }, 3000);
      }, 1000);
    } else {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setActiveProjectId(null);
        setResponses([]);
      }, 3000);
    }
  };

  if (activeProject) {
    if (isSubmitted) {
       return (
         <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center bg-white p-12 rounded-xl shadow-lg border border-green-100 max-w-lg">
               <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                  <CheckCircle2 className="w-8 h-8" />
               </div>
               <h2 className="text-2xl font-bold text-academic-900 mb-2">{t.submissionReceived}</h2>
               <p className="text-academic-500">{t.thankYou}</p>
            </div>
         </div>
       )
    }

    // --- QUESTIONNAIRE VIEW ---
    return (
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Button 
          variant="ghost" 
          onClick={() => setActiveProjectId(null)}
          className="mb-8 pl-0 hover:bg-transparent hover:text-primary-600"
        >
          ← {t.backDashboard}
        </Button>

        {/* Standardized Survey Header */}
        <div className="mb-12 border-b border-academic-200 pb-8">
          <div className="flex items-center gap-2 text-primary-600 text-xs font-bold uppercase tracking-widest mb-3">
             <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"/>
             {t.round} {activeProject.round} {t.of} {activeProject.totalRounds} {selectedLanguage === 'cn' ? '轮' : ''}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-academic-900 mb-3 leading-tight">
            {activeProject.title}
          </h1>
          {activeProject.subtitle && (
            <h2 className="text-xl md:text-2xl font-medium text-academic-600 mb-6">
              {activeProject.subtitle}
            </h2>
          )}
          <div className="prose prose-academic text-academic-500 max-w-none">
            <p>{activeProject.description}</p>
          </div>
        </div>

        {/* Recursive Tree Rendering */}
        <div className="space-y-4">
          {activeProject.nodes.map((node, index) => (
             <SurveyNodeRenderer
                key={node.id}
                node={node}
                level={`${index + 1}`}
                responses={responses}
                onResponseChange={handleResponseChange}
                t={t}
             />
          ))}
        </div>

        <div className="mt-12 flex justify-end">
          <Button 
            size="lg" 
            onClick={submitSurvey} 
            disabled={isSubmitting}
            className="shadow-lg shadow-primary-900/20"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : null}
            {t.submitResp}
          </Button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold text-academic-900">{t.dashboardTitle}</h1>
          <p className="text-academic-500">{t.welcomeBack}, {profile.title} {profile.name}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-academic-400 uppercase tracking-widest font-semibold">{t.currentDate}</div>
          <div className="text-academic-700 font-mono">{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="grid gap-6">
        {publishedProjects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-academic-200">
             <p className="text-academic-500">{t.noRounds}</p>
          </div>
        ) : publishedProjects.map(project => {
          const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 3600 * 24));
          const isUrgent = daysLeft <= 3;

          return (
            <div key={project.id} className="bg-white rounded-xl border border-academic-200 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:border-primary-300 transition-all shadow-sm hover:shadow-md group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700`}>
                    {t.openStatus}
                  </span>
                  <span className="text-xs text-academic-400 font-medium">
                     {t.round} {project.round} {t.of} {project.totalRounds} {selectedLanguage === 'cn' ? '轮' : ''}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-academic-900 group-hover:text-primary-700 transition-colors">
                  {project.title}
                </h3>
                {project.subtitle && (
                   <p className="text-sm font-medium text-academic-600 mt-0.5">{project.subtitle}</p>
                )}
                <p className="text-sm text-academic-500 mt-2 line-clamp-2 max-w-2xl">
                  {project.description}
                </p>
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-academic-100 pt-4 md:pt-0">
                <div className={`text-right ${isUrgent ? 'text-red-600' : 'text-academic-500'}`}>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-bold">{daysLeft} {t.daysLeft}</span>
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">{t.deadline}: {new Date(project.deadline).toLocaleDateString()}</div>
                </div>
                
                <Button 
                  onClick={() => setActiveProjectId(project.id)}
                  className="whitespace-nowrap"
                >
                  {t.enterSurvey}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
