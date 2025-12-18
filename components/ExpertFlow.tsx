import React, { useState, useEffect } from 'react';
import { Project, SurveyNode, NodeType, QuestionType } from '../types';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle2, Save, Send, Loader2, User, Building, ChevronRight, ArrowLeft, LogIn, UserPlus } from 'lucide-react';

interface ExpertFlowProps {}

// 定义专家详细信息接口
interface ExpertProfile {
  name: string;
  institution: string;
  department: string; // 科室/部门
  job_title: string;  // 职称
  education: string;  // 学历
  major: string;      // 专业
  years_experience: string;
  phone: string;
  email: string;
}

const INITIAL_PROFILE: ExpertProfile = {
  name: '', institution: '', department: '', job_title: '', 
  education: '', major: '', years_experience: '', phone: '', email: ''
};

export const ExpertFlow: React.FC<ExpertFlowProps> = () => {
  // 步骤控制
  const [step, setStep] = useState<'AUTH_CHOICE' | 'AUTH_LOGIN' | 'AUTH_REGISTER' | 'PROJECT_SELECT' | 'SURVEY' | 'COMPLETED'>('AUTH_CHOICE');
  
  const [profile, setProfile] = useState<ExpertProfile>(INITIAL_PROFILE);
  const [expertId, setExpertId] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  const [loadingMsg, setLoadingMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // 1. 获取已发布的项目
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from('projects').select('*').eq('status', 'PUBLISHED').order('created_at', { ascending: false });
      if (data) setProjects(data);
    };
    fetchProjects();
  }, []);

  // --- 验证逻辑 ---

  // 2. 登录逻辑 (仅匹配 姓名 + 单位)
  const handleLogin = async () => {
    if (!profile.name || !profile.institution) {
      alert('Please enter your Name and Institution to login.');
      return;
    }
    setLoadingMsg('Verifying identity...');
    
    try {
      // 查询是否存在
      const { data: existingExperts, error } = await supabase
        .from('experts')
        .select('id, name, institution')
        .eq('name', profile.name.trim())
        .eq('institution', profile.institution.trim());

      if (error) throw error;

      if (existingExperts && existingExperts.length > 0) {
        // 登录成功
        setExpertId(existingExperts[0].id);
        setStep('PROJECT_SELECT');
      } else {
        alert('User not found. Please check your spelling or choose "New Expert Registration".');
      }
    } catch (error: any) {
      alert('Login Error: ' + error.message);
    } finally {
      setLoadingMsg('');
    }
  };

  // 3. 注册逻辑 (写入全量信息)
  const handleRegister = async () => {
    // 必填项校验
    if (!profile.name || !profile.institution || !profile.job_title || !profile.years_experience || !profile.major) {
      alert('Please fill in all required fields marked with *');
      return;
    }

    setLoadingMsg('Registering profile...');
    try {
      // 先检查是否已经注册过 (避免重复)
      const { data: existing } = await supabase
        .from('experts')
        .select('id')
        .eq('name', profile.name.trim())
        .eq('institution', profile.institution.trim())
        .maybeSingle();

      if (existing) {
        alert('You are already registered! Redirecting to login...');
        setExpertId(existing.id);
        setStep('PROJECT_SELECT');
        return;
      }

      // 插入新用户
      const { data: newExpert, error } = await supabase
        .from('experts')
        .insert([{
          name: profile.name.trim(),
          institution: profile.institution.trim(),
          department: profile.department,
          job_title: profile.job_title,
          education: profile.education,
          major: profile.major,
          years_experience: parseInt(profile.years_experience) || 0,
          phone: profile.phone,
          email: profile.email
        }])
        .select()
        .single();

      if (error) throw error;

      setExpertId(newExpert.id);
      setStep('PROJECT_SELECT'); // 注册成功直接进入

    } catch (error: any) {
      alert('Registration Error: ' + error.message);
    } finally {
      setLoadingMsg('');
    }
  };

  // 4. 进入项目 & 恢复进度
  const handleEnterProject = async (project: Project) => {
    setSelectedProject(project);
    setLoadingMsg('Loading survey...');
    try {
      const { data: existingResponse } = await supabase
        .from('responses')
        .select('answers')
        .eq('project_id', project.id)
        .eq('expert_id', expertId)
        .maybeSingle();

      if (existingResponse?.answers) {
        setAnswers(existingResponse.answers);
        alert(`Welcome back! Progress restored.`);
      } else {
        setAnswers({});
      }
      setStep('SURVEY');
    } catch (error) { console.error(error); } 
    finally { setLoadingMsg(''); }
  };

  // 5. 保存/提交 (包含详细报错弹窗)
  const saveOrSubmit = async (status: 'DRAFT' | 'SUBMITTED') => {
    // 检查关键ID
    if (!selectedProject) {
      alert("❌ Error: Project ID missing.");
      return;
    }
    if (!expertId) {
      alert("❌ Error: Expert ID missing. Please re-login.");
      return;
    }

    const isDraft = status === 'DRAFT';
    isDraft ? setIsSavingDraft(true) : setIsSubmitting(true);

    try {
      const payload = {
        project_id: selectedProject.id,
        expert_id: expertId,
        answers: answers,
        status: status,
        updated_at: new Date().toISOString()
      };

      console.log("Submitting payload:", payload);

      // 查询是否存在记录
      const { data: existingRow, error: fetchError } = await supabase
        .from('responses')
        .select('id')
        .eq('project_id', selectedProject.id)
        .eq('expert_id', expertId)
        .maybeSingle();

      if (fetchError) throw new Error("Check history failed: " + fetchError.message);

      let error;
      if (existingRow) {
        const { error: updateError } = await supabase.from('responses').update(payload).eq('id', existingRow.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('responses').insert([payload]);
        error = insertError;
      }

      if (error) throw new Error(error.message);

      if (isDraft) alert('✅ Progress saved!');
      else setStep('COMPLETED');

    } catch (e: any) {
      console.error("Submit Error:", e);
      alert(`❌ Failed: ${e.message}`);
    } finally {
      setIsSavingDraft(false);
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---

  // SCREEN 1: 身份选择 (入口)
  if (step === 'AUTH_CHOICE') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-academic-100 text-center">
          <div className="mb-8">
             <h1 className="text-2xl font-bold text-academic-900">Delphi Expert Portal</h1>
             <p className="text-academic-500 text-sm mt-2">Expert Consensus System</p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={() => setStep('AUTH_LOGIN')}
              className="w-full py-4 px-6 bg-white border-2 border-primary-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center gap-3 group"
            >
               <div className="p-2 bg-primary-100 text-primary-600 rounded-full group-hover:bg-primary-600 group-hover:text-white transition-colors">
                 <LogIn className="w-5 h-5"/>
               </div>
               <div className="text-left">
                 <div className="font-bold text-academic-900">I have an account</div>
                 <div className="text-xs text-academic-500">Log in with Name & Institution</div>
               </div>
            </button>

            <button 
              onClick={() => setStep('AUTH_REGISTER')}
              className="w-full py-4 px-6 bg-academic-900 text-white rounded-xl hover:bg-academic-800 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
            >
               <div className="p-2 bg-white/10 rounded-full">
                 <UserPlus className="w-5 h-5"/>
               </div>
               <div className="text-left">
                 <div className="font-bold">I am a new Expert</div>
                 <div className="text-xs text-academic-300">Register your profile</div>
               </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 2: 登录 (简易)
  if (step === 'AUTH_LOGIN') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-academic-100 relative">
          <button onClick={() => setStep('AUTH_CHOICE')} className="absolute top-4 left-4 text-academic-400 hover:text-academic-900"><ArrowLeft className="w-5 h-5"/></button>
          <div className="text-center mb-6 mt-2">
             <h2 className="text-xl font-bold text-academic-900">Expert Login</h2>
             <p className="text-xs text-academic-500 mt-1">Verify your identity to restore progress</p>
          </div>
          <div className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Full Name</label>
               <div className="flex items-center border rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-primary-100">
                  <User className="w-4 h-4 text-academic-400 mr-2"/>
                  <input className="w-full bg-transparent outline-none text-sm" placeholder="Your Name" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
               </div>
             </div>
             <div>
               <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Institution</label>
               <div className="flex items-center border rounded-lg px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-primary-100">
                  <Building className="w-4 h-4 text-academic-400 mr-2"/>
                  <input className="w-full bg-transparent outline-none text-sm" placeholder="Your Hospital / University" value={profile.institution} onChange={e => setProfile({...profile, institution: e.target.value})} />
               </div>
             </div>
             <Button className="w-full mt-2" size="lg" onClick={handleLogin} disabled={!!loadingMsg}>
               {loadingMsg || 'Log In'}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 3: 注册 (全字段)
  if (step === 'AUTH_REGISTER') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-lg border border-academic-100 relative max-h-[90vh] overflow-y-auto">
          <button onClick={() => setStep('AUTH_CHOICE')} className="absolute top-4 left-4 text-academic-400 hover:text-academic-900"><ArrowLeft className="w-5 h-5"/></button>
          <div className="text-center mb-6 mt-2">
             <h2 className="text-xl font-bold text-academic-900">Expert Registration</h2>
             <p className="text-xs text-academic-500 mt-1">Please provide complete information</p>
          </div>
          
          <div className="space-y-4">
             {/* 基本信息 */}
             <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Name *</label>
                  <input className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Education</label>
                  <select className="w-full border p-2 rounded text-sm bg-white outline-none" value={profile.education} onChange={e => setProfile({...profile, education: e.target.value})}>
                     <option value="">Select...</option>
                     <option value="Bachelor">Bachelor (学士)</option>
                     <option value="Master">Master (硕士)</option>
                     <option value="PhD">PhD (博士)</option>
                  </select>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Institution *</label>
                  <input className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" placeholder="Hospital/Univ" value={profile.institution} onChange={e => setProfile({...profile, institution: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Department</label>
                  <input className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" placeholder="e.g. Cardiology" value={profile.department} onChange={e => setProfile({...profile, department: e.target.value})} />
                </div>
             </div>

             {/* 专业信息 */}
             <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Job Title *</label>
                   <input className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" placeholder="e.g. Chief Physician" value={profile.job_title} onChange={e => setProfile({...profile, job_title: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Years Exp *</label>
                   <input type="number" className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" placeholder="e.g. 15" value={profile.years_experience} onChange={e => setProfile({...profile, years_experience: e.target.value})} />
                </div>
             </div>

             <div>
                <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Major / Specialty *</label>
                <input className="w-full border p-2 rounded text-sm outline-none focus:border-primary-500" placeholder="e.g. Nursing Management, Clinical Care" value={profile.major} onChange={e => setProfile({...profile, major: e.target.value})} />
             </div>

             {/* 联系方式 */}
             <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-[10px] font-bold text-academic-400 uppercase mb-1">Phone (Optional)</label>
                   <input className="w-full border p-2 rounded text-sm outline-none" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-[10px] font-bold text-academic-400 uppercase mb-1">Email (Optional)</label>
                   <input className="w-full border p-2 rounded text-sm outline-none" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
                </div>
             </div>

             <Button className="w-full mt-4" size="lg" onClick={handleRegister} disabled={!!loadingMsg}>
               {loadingMsg || 'Complete Registration'}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 4: 项目列表
  if (step === 'PROJECT_SELECT') {
    return (
      <div className="min-h-screen bg-academic-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6 px-1">
             <h2 className="text-xl font-bold text-academic-900">Surveys</h2>
             <button onClick={() => setStep('AUTH_CHOICE')} className="text-xs text-academic-500 underline">Logout</button>
          </div>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-academic-200 text-academic-500">
               No active surveys available.
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

  // SCREEN 5: 完成页面
  if (step === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-academic-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-academic-100">
           <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
           </div>
           <h2 className="text-2xl font-bold text-academic-900 mb-2">Thank You!</h2>
           <p className="text-academic-600 mb-6">Your expert opinion has been successfully recorded.</p>
           <Button variant="outline" onClick={() => setStep('PROJECT_SELECT')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  // SCREEN 6: 答题页面
  return (
    <div className="min-h-screen bg-academic-50 pb-24">
      <div className="bg-white border-b border-academic-200 sticky top-0 z-10 shadow-sm">
         <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
            <h1 className="font-bold text-academic-900 truncate pr-4 text-sm md:text-base">{selectedProject?.title}</h1>
            <button onClick={() => setStep('PROJECT_SELECT')} className="text-xs font-mono bg-academic-100 px-2 py-1 rounded text-academic-600 shrink-0">
               Exit
            </button>
         </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
         {selectedProject?.description && (
            <div className="bg-white p-5 rounded-xl border border-academic-200 shadow-sm">
               <h3 className="text-sm font-bold text-academic-500 uppercase mb-2">Instructions</h3>
               <p className="text-academic-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedProject.description}</p>
            </div>
         )}
         {selectedProject?.nodes?.map((node: SurveyNode, idx: number) => (
            <QuestionRenderer key={node.id} node={node} level={`${idx+1}`} answers={answers} setAnswers={setAnswers} />
         ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-academic-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
         <div className="max-w-3xl mx-auto flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => saveOrSubmit('DRAFT')} disabled={isSavingDraft || isSubmitting}>
               {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4 mr-2" />} Save Draft
            </Button>
            <Button className="flex-[2]" onClick={() => saveOrSubmit('SUBMITTED')} disabled={isSavingDraft || isSubmitting}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 mr-2" />} Submit
            </Button>
         </div>
      </div>
    </div>
  );
};

// --- Helper: Question Renderer (手机适配优化版) ---
const QuestionRenderer: React.FC<{ node: SurveyNode; level: string; answers: any; setAnswers: any; }> = ({ node, level, answers, setAnswers }) => {
   
   // 👇 辅助函数：渲染富文本标题/描述
   const renderRichText = (text?: string, isTitle?: boolean) => {
      if (!text) return isTitle ? 'Untitled' : null;
      // 标题用大字体，描述用小字体
      const baseClass = isTitle ? "" : "text-sm text-academic-600 leading-relaxed";
      return <span className={baseClass} dangerouslySetInnerHTML={{ __html: text }} />;
   };

   if (node.type === NodeType.SECTION) {
      return (
         <div className="space-y-6 mt-8 first:mt-0">
            <div className="border-l-4 border-primary-500 pl-4 py-1">
               <h2 className="text-lg md:text-xl font-bold text-academic-900">{renderRichText(node.title, true)}</h2>
               {node.description && <div className="mt-1">{renderRichText(node.description)}</div>}
               {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mt-3 border border-academic-200" alt="Section" />}
            </div>
            {node.children.map((child, idx) => <QuestionRenderer key={child.id} node={child} level={`${level}.${idx+1}`} answers={answers} setAnswers={setAnswers} />)}
         </div>
      );
   }
   if (node.type === NodeType.TEXT) {
      return (
         <div className="bg-white p-5 rounded-xl border border-academic-200 shadow-sm">
            <h3 className="font-bold text-academic-900 mb-2">{renderRichText(node.title, true)}</h3>
            {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mb-3 border border-academic-200" alt="Content" />}
            {renderRichText(node.description)}
         </div>
      );
   }
   const value = answers[node.id];
   return (
      <div className="bg-white p-5 md:p-6 rounded-xl border border-academic-200 shadow-sm transition-shadow hover:shadow-md">
         <div className="flex gap-3">
            <span className="text-xs font-mono text-academic-400 mt-1 shrink-0">{level}</span>
            <div className="flex-1 min-w-0">
               {/* 👇 这里修改了：使用 renderRichText 渲染标题 */}
               <h4 className="font-medium text-academic-900 text-base md:text-lg mb-2">{renderRichText(node.title, true)}</h4>
               
               {node.description && <div className="mb-4 text-academic-500">{renderRichText(node.description)}</div>}
               {node.imageUrl && <img src={node.imageUrl} className="w-full rounded-lg mb-4 border border-academic-200" alt="Question" />}
               <div className="mt-3">
                  {node.questionType === QuestionType.LIKERT_SCALE && (
                     <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center gap-1 md:gap-4 max-w-full overflow-x-auto pb-2">
                           <span className="text-[10px] text-academic-400 uppercase font-bold hidden md:inline">Disagree</span>
                           {Array.from({length: node.likertScale || 5}, (_, i) => i + 1).map(n => (
                              <button key={n} onClick={() => setAnswers({...answers, [node.id]: n})} className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center text-sm md:text-base font-bold transition-all shrink-0 ${value === n ? 'border-primary-500 bg-primary-50 text-primary-700 scale-110 shadow-sm' : 'border-academic-200 text-academic-400 hover:border-primary-300 hover:bg-gray-50'}`}>{n}</button>
                           ))}
                           <span className="text-[10px] text-academic-400 uppercase font-bold hidden md:inline">Agree</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-academic-400 px-1 md:hidden"><span>Strongly Disagree</span><span>Strongly Agree</span></div>
                     </div>
                  )}
                  {node.questionType === QuestionType.SINGLE_CHOICE && (
                     <div className="space-y-2">{node.options?.map(opt => (
                        <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${value === opt.label ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-academic-200 hover:bg-gray-50'}`}>
                           <input type="radio" name={node.id} value={opt.label} checked={value === opt.label} onChange={(e) => setAnswers({...answers, [node.id]: e.target.value})} className="w-4 h-4 text-primary-600 focus:ring-primary-500"/>
                           <span className="text-sm text-academic-700">{opt.label}</span>
                        </label>
                     ))}</div>
                  )}
                  {node.questionType === QuestionType.TEXT_AREA && (
                     <textarea value={value || ''} onChange={(e) => setAnswers({...answers, [node.id]: e.target.value})} className="w-full p-3 text-sm border border-academic-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[100px]" placeholder="Type answer..."/>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};