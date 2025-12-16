import React, { useState, useEffect } from 'react';
import { Project, SurveyNode, NodeType, QuestionType } from '../types';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle2, AlertCircle, Save, Send, Loader2, User, Building, Clock, ChevronRight } from 'lucide-react';

interface ExpertFlowProps {
  // no props needed as it fetches its own data usually, but for simplicity keeping it self-contained
}

export const ExpertFlow: React.FC<ExpertFlowProps> = () => {
  const [step, setStep] = useState<'LOGIN' | 'PROJECT_SELECT' | 'SURVEY' | 'COMPLETED'>('LOGIN');
  const [expertInfo, setExpertInfo] = useState({ name: '', institution: '', years: '' });
  const [expertId, setExpertId] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // 1. 获取已发布的项目
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
    };
    fetchProjects();
  }, []);

  // 2. 智能登录/注册逻辑 (支持断点续传)
  const handleLogin = async () => {
    if (!expertInfo.name || !expertInfo.institution) {
      alert('Please fill in your Name and Institution.');
      return;
    }
    setLoadingMsg('Verifying identity...');
    
    try {
      // A. 先检查专家是否存在 (通过 姓名 + 机构 匹配)
      const { data: existingExperts, error: fetchError } = await supabase
        .from('experts')
        .select('id')
        .eq('name', expertInfo.name.trim())
        .eq('institution', expertInfo.institution.trim());

      let currentExpertId = null;

      if (existingExperts && existingExperts.length > 0) {
        // B. 老用户：直接使用现有 ID
        currentExpertId = existingExperts[0].id;
        console.log("Found existing expert:", currentExpertId);
      } else {
        // C. 新用户：创建新记录
        const { data: newExpert, error: createError } = await supabase
          .from('experts')
          .insert([{
            name: expertInfo.name.trim(),
            institution: expertInfo.institution.trim(),
            years_experience: parseInt(expertInfo.years) || 0
          }])
          .select()
          .single();
          
        if (createError) throw createError;
        currentExpertId = newExpert.id;
      }

      setExpertId(currentExpertId);
      setStep('PROJECT_SELECT');

    } catch (error: any) {
      alert('Login failed: ' + error.message);
    } finally {
      setLoadingMsg('');
    }
  };

  // 3. 进入问卷 (检查是否有历史存档)
  const handleEnterProject = async (project: Project) => {
    setSelectedProject(project);
    setLoadingMsg('Loading survey...');
    
    try {
      // 检查是否已有作答记录 (包括草稿)
      const { data: existingResponse } = await supabase
        .from('responses')
        .select('answers')
        .eq('project_id', project.id)
        .eq('expert_id', expertId)
        .maybeSingle();

      if (existingResponse && existingResponse.answers) {
        // 恢复历史答案
        setAnswers(existingResponse.answers);
        alert(`Welcome back, ${expertInfo.name}! We have restored your previous answers.`);
      } else {
        // 新开始
        setAnswers({});
      }
      setStep('SURVEY');
    } catch (error) {
      console.error("Error loading progress", error);
      setStep('SURVEY');
    } finally {
      setLoadingMsg('');
    }
  };

  // 4. 保存/提交逻辑 (Upsert)
  const saveOrSubmit = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedProject || !expertId) return;
    
    const isDraft = status === 'DRAFT';
    if (isDraft) setIsSavingDraft(true);
    else setIsSubmitting(true);

    try {
      // 准备数据
      const payload = {
        project_id: selectedProject.id,
        expert_id: expertId,
        answers: answers,
        status: status, // 可以用来区分是草稿还是正式提交
        updated_at: new Date().toISOString()
      };

      // 使用 upsert：如果存在记录则更新，不存在则插入
      // 需要确保数据库 responses 表有 (project_id, expert_id) 的唯一约束，或者我们手动查一下 ID
      
      // 为了保险，我们先查一下有没有 ID
      const { data: existingRow } = await supabase
        .from('responses')
        .select('id')
        .eq('project_id', selectedProject.id)
        .eq('expert_id', expertId)
        .maybeSingle();

      let error;
      if (existingRow) {
        // 更新
        const { error: updateError } = await supabase
           .from('responses')
           .update(payload)
           .eq('id', existingRow.id);
        error = updateError;
      } else {
        // 插入
        const { error: insertError } = await supabase
           .from('responses')
           .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      if (isDraft) {
        alert('Progress saved! You can close the page and continue later with the same Name and Institution.');
      } else {
        setStep('COMPLETED');
      }

    } catch (error: any) {
      alert('Failed to save: ' + error.message);
    } finally {
      setIsSavingDraft(false);
      setIsSubmitting(false);
    }
  };

  // --- 渲染组件 ---

  // 1. 登录界面 (手机适配)
  if (step === 'LOGIN') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-md border border-academic-100">
          <div className="text-center mb-8">
             <h1 className="text-2xl font-bold text-academic-900">Delphi Expert Portal</h1>
             <p className="text-academic-500 text-sm mt-2">Welcome to the consensus platform</p>
          </div>
          
          <div className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Full Name</label>
               <div className="flex items-center border rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-primary-100 transition-all">
                  <User className="w-4 h-4 text-academic-400 mr-2"/>
                  <input className="w-full bg-transparent outline-none text-sm" placeholder="e.g. Dr. Zhang" value={expertInfo.name} onChange={e => setExpertInfo({...expertInfo, name: e.target.value})} />
               </div>
               <p className="text-[10px] text-orange-500 mt-1">* Used to restore your progress later.</p>
             </div>
             <div>
               <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Institution / Hospital</label>
               <div className="flex items-center border rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-primary-100 transition-all">
                  <Building className="w-4 h-4 text-academic-400 mr-2"/>
                  <input className="w-full bg-transparent outline-none text-sm" placeholder="e.g. HIT Shenzhen" value={expertInfo.institution} onChange={e => setExpertInfo({...expertInfo, institution: e.target.value})} />
               </div>
             </div>
             <div>
               <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Years of Experience</label>
               <div className="flex items-center border rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-primary-100 transition-all">
                  <Clock className="w-4 h-4 text-academic-400 mr-2"/>
                  <input type="number" className="w-full bg-transparent outline-none text-sm" placeholder="e.g. 5" value={expertInfo.years} onChange={e => setExpertInfo({...expertInfo, years: e.target.value})} />
               </div>
             </div>
             <Button className="w-full mt-4" size="lg" onClick={handleLogin} disabled={!!loadingMsg}>
               {loadingMsg || 'Enter Platform'}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 项目列表 (手机适配)
  if (step === 'PROJECT_SELECT') {
    return (
      <div className="min-h-screen bg-academic-50 p-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-academic-900 mb-4 px-1">Available Surveys</h2>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-academic-200 text-academic-500">
               No active surveys at the moment.
            </div>
          ) : (
            <div className="space-y-4">
               {projects.map(p => (
                  <div key={p.id} onClick={() => handleEnterProject(p)} className="bg-white p-5 rounded-xl shadow-sm border border-academic-200 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                     <div className="flex justify-between items-center">
                        <div>
                           <h3 className="font-bold text-lg text-academic-900">{p.title}</h3>
                           <p className="text-sm text-academic-500 mt-1">{p.subtitle}</p>
                           <div className="mt-3 flex gap-2">
                              <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded font-medium">Round {p.round}/{p.total_rounds}</span>
                              {p.deadline && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Due: {new Date(p.deadline).toLocaleDateString()}</span>}
                           </div>
                        </div>
                        <ChevronRight className="text-academic-300" />
                     </div>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. 完成页面
  if (step === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-academic-100">
           <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
           </div>
           <h2 className="text-2xl font-bold text-academic-900 mb-2">Thank You!</h2>
           <p className="text-academic-600 mb-6">Your expert opinion has been successfully recorded. You may close this page now.</p>
           <Button variant="outline" onClick={() => setStep('PROJECT_SELECT')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  // 4. 问卷答题页面 (重点优化手机适配)
  return (
    <div className="min-h-screen bg-academic-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-academic-200 sticky top-0 z-10 shadow-sm">
         <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
            <h1 className="font-bold text-academic-900 truncate pr-4 text-sm md:text-base">{selectedProject?.title}</h1>
            <div className="text-xs font-mono bg-academic-100 px-2 py-1 rounded text-academic-600 shrink-0">
               {expertInfo.name}
            </div>
         </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
         {/* Introduction Card */}
         {selectedProject?.description && (
            <div className="bg-white p-5 rounded-xl border border-academic-200 shadow-sm">
               <h3 className="text-sm font-bold text-academic-500 uppercase mb-2">Instructions</h3>
               <p className="text-academic-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedProject.description}</p>
            </div>
         )}

         {/* Recursive Question Renderer */}
         {selectedProject?.nodes?.map((node: SurveyNode, idx: number) => (
            <QuestionRenderer 
               key={node.id} 
               node={node} 
               level={`${idx+1}`} 
               answers={answers} 
               setAnswers={setAnswers} 
            />
         ))}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-academic-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
         <div className="max-w-3xl mx-auto flex gap-3">
            <Button 
               variant="secondary" 
               className="flex-1" 
               onClick={() => saveOrSubmit('DRAFT')}
               disabled={isSavingDraft || isSubmitting}
            >
               {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4 mr-2" />}
               Save Draft
            </Button>
            <Button 
               className="flex-[2]" 
               onClick={() => saveOrSubmit('SUBMITTED')}
               disabled={isSavingDraft || isSubmitting}
            >
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 mr-2" />}
               Submit Survey
            </Button>
         </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Question Renderer (手机适配版) ---
const QuestionRenderer: React.FC<{
   node: SurveyNode; 
   level: string; 
   answers: any; 
   setAnswers: any;
}> = ({ node, level, answers, setAnswers }) => {
   
   // 递归处理 Section
   if (node.type === NodeType.SECTION) {
      return (
         <div className="space-y-6 mt-8 first:mt-0">
            <div className="border-l-4 border-primary-500 pl-4 py-1">
               <h2 className="text-lg md:text-xl font-bold text-academic-900">{node.title}</h2>
               {node.description && <p className="text-sm text-academic-600 mt-1">{node.description}</p>}
               {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mt-3 border border-academic-200" alt="Section" />}
            </div>
            {node.children.map((child, idx) => (
               <QuestionRenderer key={child.id} node={child} level={`${level}.${idx+1}`} answers={answers} setAnswers={setAnswers} />
            ))}
         </div>
      );
   }

   if (node.type === NodeType.TEXT) {
      return (
         <div className="bg-white p-5 rounded-xl border border-academic-200 shadow-sm">
            <h3 className="font-bold text-academic-900 mb-2">{node.title}</h3>
            {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mb-3 border border-academic-200" alt="Content" />}
            <p className="text-sm text-academic-600 leading-relaxed whitespace-pre-wrap">{node.description}</p>
         </div>
      );
   }

   // --- Questions ---
   const value = answers[node.id];

   return (
      <div className="bg-white p-5 md:p-6 rounded-xl border border-academic-200 shadow-sm transition-shadow hover:shadow-md">
         <div className="flex gap-3">
            <span className="text-xs font-mono text-academic-400 mt-1 shrink-0">{level}</span>
            <div className="flex-1 min-w-0">
               <h4 className="font-medium text-academic-900 text-base md:text-lg mb-2">{node.title}</h4>
               {node.description && <p className="text-sm text-academic-500 mb-4">{node.description}</p>}
               {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mb-4 border border-academic-200" alt="Question" />}
               
               {/* Inputs */}
               <div className="mt-3">
                  {node.questionType === QuestionType.LIKERT_SCALE && (
                     <div className="flex flex-col gap-2">
                        {/* Mobile Optimized Likert: 换行显示或者水平滚动 */}
                        <div className="flex justify-between items-center gap-1 md:gap-4 max-w-full overflow-x-auto pb-2">
                           <span className="text-[10px] text-academic-400 uppercase font-bold hidden md:inline">Disagree</span>
                           {Array.from({length: node.likertScale || 5}, (_, i) => i + 1).map(n => (
                              <button
                                 key={n}
                                 onClick={() => setAnswers({...answers, [node.id]: n})}
                                 className={`
                                    w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center text-sm md:text-base font-bold transition-all shrink-0
                                    ${value === n 
                                       ? 'border-primary-500 bg-primary-50 text-primary-700 scale-110 shadow-sm' 
                                       : 'border-academic-200 text-academic-400 hover:border-primary-300 hover:bg-gray-50'}
                                 `}
                              >
                                 {n}
                              </button>
                           ))}
                           <span className="text-[10px] text-academic-400 uppercase font-bold hidden md:inline">Agree</span>
                        </div>
                        {/* Mobile Labels */}
                        <div className="flex justify-between text-[10px] text-academic-400 px-1 md:hidden">
                           <span>Strongly Disagree</span>
                           <span>Strongly Agree</span>
                        </div>
                     </div>
                  )}

                  {node.questionType === QuestionType.SINGLE_CHOICE && (
                     <div className="space-y-2">
                        {node.options?.map(opt => (
                           <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${value === opt.label ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-academic-200 hover:bg-gray-50'}`}>
                              <input 
                                 type="radio" 
                                 name={node.id} 
                                 value={opt.label}
                                 checked={value === opt.label}
                                 onChange={(e) => setAnswers({...answers, [node.id]: e.target.value})}
                                 className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-academic-700">{opt.label}</span>
                           </label>
                        ))}
                     </div>
                  )}

                  {node.questionType === QuestionType.TEXT_AREA && (
                     <textarea 
                        value={value || ''}
                        onChange={(e) => setAnswers({...answers, [node.id]: e.target.value})}
                        className="w-full p-3 text-sm border border-academic-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none min-h-[100px]"
                        placeholder="Type your answer here..."
                     />
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};