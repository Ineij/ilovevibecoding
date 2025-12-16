import React, { useState, useEffect, useRef } from 'react';
import { Project, QuestionType, SurveyNode, NodeType } from '../types';
import { Plus, Trash2, GripVertical, Save, Settings, FileText, BarChart3, Eye, Loader2, FolderPlus, FolderOpen, Image as ImageIcon, ChevronUp, Type, StopCircle, PlayCircle, Edit, Calendar, Hash, X, UploadCloud } from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';

// --- Recursive Builder Node Component (编辑模式组件) ---
const updateNodeInTree = (nodes: SurveyNode[], nodeId: string, updateFn: (n: SurveyNode) => SurveyNode): SurveyNode[] => {
  return nodes.map(node => {
    if (node.id === nodeId) return updateFn(node);
    if (node.children) return { ...node, children: updateNodeInTree(node.children, nodeId, updateFn) };
    return node;
  });
};

const deleteNodeFromTree = (nodes: SurveyNode[], nodeId: string): SurveyNode[] => {
  return nodes.filter(node => node.id !== nodeId).map(node => ({
    ...node,
    children: deleteNodeFromTree(node.children, nodeId)
  }));
};

const addChildToNode = (nodes: SurveyNode[], parentId: string, newNode: SurveyNode): SurveyNode[] => {
  return nodes.map(node => {
    if (node.id === parentId) return { ...node, children: [...node.children, newNode] };
    if (node.children) return { ...node, children: addChildToNode(node.children, parentId, newNode) };
    return node;
  });
};

// 构建器节点渲染
const BuilderNodeRenderer: React.FC<{
  node: SurveyNode;
  level: string;
  onUpdate: (id: string, field: keyof SurveyNode, val: any) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onDelete: (id: string) => void;
}> = ({ node, level, onUpdate, onAddChild, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSection = node.type === NodeType.SECTION;
  const isText = node.type === NodeType.TEXT;

  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) throw new Error('You must select an image to upload.');

      const fileExt = file.name.split('.').pop();
      // 生成唯一文件名：节点ID + 时间戳
      const fileName = `${node.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. 上传到 Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('survey-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 2. 获取公开访问链接
      const { data: { publicUrl } } = supabase.storage
        .from('survey-images')
        .getPublicUrl(filePath);

      // 3. 更新节点数据
      onUpdate(node.id, 'imageUrl', publicUrl);

    } catch (error: any) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
      // 清空 input防止重复选择同一文件不触发 onChange
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`
      relative border border-academic-200 rounded-lg p-4 mb-4 transition-all
      ${isSection ? 'bg-academic-50 ml-4' : 'bg-white ml-8 shadow-sm hover:shadow-md'}
      ${level.length === 1 ? '!ml-0' : ''}
    `}>
      <div className="absolute -left-4 top-0 bottom-0 w-px bg-academic-200" />
      <div className="absolute -left-4 top-6 w-4 h-px bg-academic-200" />

      <div className="flex gap-3">
        <div className="mt-2 text-academic-300 cursor-move"><GripVertical className="w-4 h-4" /></div>
        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-academic-400 bg-academic-100 px-1.5 py-0.5 rounded">{level}</span>
                {isSection ? (
                  <span className="text-xs font-bold text-academic-600 uppercase flex items-center gap-1"><FolderOpen className="w-3 h-3"/> Section</span>
                ) : isText ? (
                  <span className="text-xs font-bold text-academic-600 uppercase flex items-center gap-1"><Type className="w-3 h-3"/> Text / Media</span>
                ) : (
                  <span className="text-xs font-bold text-primary-600 uppercase">Question</span>
                )}
              </div>
              <input 
                value={node.title}
                onChange={(e) => onUpdate(node.id, 'title', e.target.value)}
                className={`w-full bg-transparent border-b border-transparent focus:border-academic-300 focus:outline-none transition-all placeholder-academic-300 ${isSection ? 'text-lg font-bold text-academic-800' : 'text-base font-medium text-academic-900'}`}
                placeholder={isSection ? "Section Title" : isText ? "Header (Optional)" : "Question Text"}
              />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowDetails(!showDetails)} className={`p-1.5 rounded transition-colors ${showDetails ? 'text-primary-600 bg-primary-50' : 'text-academic-400 hover:bg-academic-100'}`}>
                {showDetails ? <ChevronUp className="w-4 h-4"/> : <ImageIcon className="w-4 h-4"/>}
              </button>
              <button onClick={() => onDelete(node.id)} className="p-1.5 text-academic-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          {isText && (
             <div className="mt-2">
                <textarea 
                  value={node.description || ''}
                  onChange={(e) => onUpdate(node.id, 'description', e.target.value)}
                  className="w-full text-sm p-3 border border-academic-200 rounded focus:ring-1 focus:ring-primary-500 outline-none min-h-[80px]"
                  placeholder="Enter content text here..."
                />
             </div>
          )}

          {showDetails && (
            <div className="p-4 bg-academic-100/50 rounded-lg border border-academic-200 space-y-4 animate-in slide-in-from-top-2">
               {!isText && (
                 <div>
                    <label className="block text-xs font-bold text-academic-500 uppercase tracking-wider mb-1">Context / Description</label>
                    <textarea 
                      value={node.description || ''}
                      onChange={(e) => onUpdate(node.id, 'description', e.target.value)}
                      className="w-full text-sm p-2 border border-academic-200 rounded outline-none" rows={3}
                    />
                 </div>
               )}
               
               {/* --- Image Upload Section --- */}
               <div>
                  <label className="block text-xs font-bold text-academic-500 uppercase tracking-wider mb-2">Attached Image</label>
                  
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                  />

                  <div className="flex flex-col gap-3">
                    {/* Image Preview Area */}
                    {node.imageUrl && (
                      <div className="relative group rounded-lg overflow-hidden border border-academic-200 bg-white">
                        <img 
                          src={node.imageUrl} 
                          alt="Preview" 
                          className="w-full h-auto max-h-[400px] object-contain" 
                        />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Change</Button>
                             <Button size="sm" variant="destructive" onClick={() => onUpdate(node.id, 'imageUrl', '')}>Remove</Button>
                         </div>
                      </div>
                    )}

                    {/* Upload Button Area */}
                    {!node.imageUrl && (
                      <div 
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-academic-300 rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-academic-500 transition-colors ${!uploading ? 'cursor-pointer hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/50' : 'opacity-60 cursor-not-allowed'}`}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                            <span className="text-sm font-medium">Uploading to cloud...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-6 h-6" />
                            <span className="text-sm font-medium">Click to upload image</span>
                            <span className="text-xs text-academic-400">(JPG, PNG, GIF up to 5MB)</span>
                          </>
                        )}
                      </div>
                    )}
                     
                     {/* Optional URL fallback */}
                     {node.imageUrl && (
                        <div className="text-xs text-academic-400 truncate px-1">
                           Source: {node.imageUrl}
                        </div>
                     )}
                  </div>
               </div>

            </div>
          )}

          {!isSection && !isText && (
             <div className="pl-2 border-l-2 border-academic-100 space-y-3">
                <div className="flex items-center gap-2">
                   <select 
                      value={node.questionType} 
                      onChange={(e) => onUpdate(node.id, 'questionType', e.target.value)}
                      className="text-sm border border-academic-200 rounded px-2 py-1 bg-white"
                   >
                      <option value={QuestionType.LIKERT_SCALE}>Likert Scale</option>
                      <option value={QuestionType.SINGLE_CHOICE}>Multiple Choice</option>
                      <option value={QuestionType.TEXT_AREA}>Open Text</option>
                   </select>
                </div>
                {node.questionType === QuestionType.LIKERT_SCALE && (
                   <div className="flex gap-2">
                      <Button size="sm" variant={node.likertScale === 5 ? 'primary' : 'outline'} onClick={() => onUpdate(node.id, 'likertScale', 5)}>5-Point</Button>
                      <Button size="sm" variant={node.likertScale === 7 ? 'primary' : 'outline'} onClick={() => onUpdate(node.id, 'likertScale', 7)}>7-Point</Button>
                   </div>
                )}
                {node.questionType === QuestionType.SINGLE_CHOICE && (
                   <div className="space-y-2">
                      {node.options?.map((opt, idx) => (
                         <input 
                            key={opt.id}
                            value={opt.label}
                            onChange={(e) => {
                               const newOpts = [...(node.options || [])];
                               newOpts[idx].label = e.target.value;
                               onUpdate(node.id, 'options', newOpts);
                            }}
                            className="block w-full text-sm border border-academic-200 rounded px-2 py-1" 
                         />
                      ))}
                      <button className="text-xs text-primary-600 font-medium hover:underline" onClick={() => {
                         const newOpts = [...(node.options || []), { id: Date.now().toString(), label: 'New Option' }];
                         onUpdate(node.id, 'options', newOpts);
                      }}>+ Add Option</button>
                   </div>
                )}
             </div>
          )}

          {isSection && (
             <div className="flex gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.SECTION)} className="text-xs h-7 px-2"><FolderPlus className="w-3 h-3 mr-1" /> Sub-Section</Button>
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.QUESTION)} className="text-xs h-7 px-2"><Plus className="w-3 h-3 mr-1" /> Question</Button>
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.TEXT)} className="text-xs h-7 px-2"><Type className="w-3 h-3 mr-1" /> Text</Button>
             </div>
          )}
        </div>
      </div>
      {/* 递归渲染子节点 - 修复了之前的 bug，正确传递了 onUpdate */}
      {isSection && node.children.length > 0 && (
         <div className="mt-4">
            {node.children.map((child, idx) => (
               <BuilderNodeRenderer key={child.id} node={child} level={`${level}.${idx + 1}`} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} />
            ))}
         </div>
      )}
    </div>
  );
};

// --- Preview Node Renderer (预览模式组件) ---
const PreviewNodeRenderer: React.FC<{ node: SurveyNode; level: string }> = ({ node, level }) => {
  // 预览样式：宽度铺满，高度自适应
  const imageStyleClass = "w-full h-auto object-contain rounded mb-4 border border-academic-200";

  if (node.type === NodeType.SECTION) {
    return (
      <div className="mb-6 border-l-2 border-academic-200 pl-4 mt-4">
        <h3 className="text-lg font-bold text-academic-800 mb-2 flex items-center gap-2">
          <span className="text-sm font-mono text-academic-400">{level}</span> {node.title || 'Untitled Section'}
        </h3>
        {node.description && <p className="text-sm text-academic-600 mb-4 bg-academic-50 p-3 rounded">{node.description}</p>}
        {node.imageUrl && <img src={node.imageUrl} className={imageStyleClass} alt="Section" />}
        <div className="space-y-4">
          {node.children.map((child, idx) => <PreviewNodeRenderer key={child.id} node={child} level={`${level}.${idx+1}`} />)}
        </div>
      </div>
    );
  }
  if (node.type === NodeType.TEXT) {
    return (
       <div className="bg-white p-4 rounded border border-academic-100 mb-4">
          <h4 className="font-bold text-academic-900">{node.title}</h4>
          {node.imageUrl && <img src={node.imageUrl} className={imageStyleClass} alt="Content" />}
          <p className="text-sm text-academic-600 whitespace-pre-wrap">{node.description}</p>
       </div>
    );
  }
  // Question
  return (
    <div className="bg-white p-5 rounded-lg border border-academic-200 shadow-sm mb-4">
       <div className="flex gap-3">
          <span className="text-xs font-mono text-academic-400 mt-1">{level}</span>
          <div className="flex-1">
             <h4 className="font-medium text-academic-900 mb-2">{node.title || 'Untitled Question'}</h4>
             {node.description && <p className="text-sm text-academic-500 mb-3">{node.description}</p>}
             {node.imageUrl && <img src={node.imageUrl} className={imageStyleClass} alt="Question" />}
             
             {/* Mock Inputs */}
             <div className="mt-2 pointer-events-none opacity-80">
                {node.questionType === QuestionType.LIKERT_SCALE && (
                   <div className="flex justify-between max-w-xs">
                      {Array.from({length: node.likertScale || 5}, (_, i) => i + 1).map(n => (
                         <div key={n} className="w-8 h-8 rounded-full border border-academic-300 flex items-center justify-center text-xs text-academic-500">{n}</div>
                      ))}
                   </div>
                )}
                {node.questionType === QuestionType.SINGLE_CHOICE && (
                   <div className="space-y-2">
                      {node.options?.map(opt => (
                         <div key={opt.id} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-academic-400"></div>
                            <span className="text-sm text-academic-700">{opt.label}</span>
                         </div>
                      ))}
                   </div>
                )}
                {node.questionType === QuestionType.TEXT_AREA && (
                   <div className="h-20 border border-academic-200 rounded bg-academic-50"></div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}

// --- MAIN ADMIN COMPONENT ---
interface AdminFlowProps {
  onProjectPublished?: () => void;
}

export const AdminFlow: React.FC<AdminFlowProps> = ({ onProjectPublished }) => {
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'PROJECTS' | 'RESPONSES'>('BUILDER');
  
  // Builder State
  const [surveyTitle, setSurveyTitle] = useState('New Consensus Round');
  const [surveySubtitle, setSurveySubtitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyLanguage, setSurveyLanguage] = useState<'en' | 'cn'>('en');
  const [nodes, setNodes] = useState<SurveyNode[]>([]);
  
  // New Features State
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [deadlineDate, setDeadlineDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Projects View State
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Response View State
  const [responses, setResponses] = useState<any[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  // --- Functions ---

  const fetchProjectsList = async () => {
     setIsLoadingProjects(true);
     const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
     if (error) console.error('Fetch error:', error);
     else if (data) {
        setExistingProjects(data.map((p: any) => ({ ...p, totalRounds: p.total_rounds })));
     }
     setIsLoadingProjects(false);
  };

  const fetchResponses = async () => {
    setIsLoadingResponses(true);
    const { data: responseData, error } = await supabase.from('responses').select('*, experts(name, institution), projects(title)');
    if (error) console.error('Response fetch error:', error);
    else if (responseData) {
      const formatted = responseData.map((r: any) => ({
        id: r.id,
        name: r.experts?.name || 'Unknown',
        institution: r.experts?.institution || 'Unknown',
        status: 'SUBMITTED',
        title: r.projects?.title || 'Untitled Project',
        details: r.answers
      }));
      setResponses(formatted);
    }
    setIsLoadingResponses(false);
  };

  useEffect(() => {
    if (activeTab === 'RESPONSES') fetchResponses();
    if (activeTab === 'PROJECTS') fetchProjectsList();
  }, [activeTab]);

  // --- Handlers ---

  const handleEditProject = (project: any) => {
    setSurveyTitle(project.title);
    setSurveySubtitle(project.subtitle || '');
    setSurveyDescription(project.description || '');
    setSurveyLanguage(project.language || 'en');
    setNodes(project.nodes || []);
    setCurrentRound(project.round || 1);
    setTotalRounds(project.total_rounds || 3);
    setDeadlineDate(project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '');
    setEditingProjectId(project.id);
    setActiveTab('BUILDER');
  };

  const saveProject = async () => {
    setIsSaving(true);
    
    const projectPayload = {
       title: surveyTitle,
       subtitle: surveySubtitle,
       description: surveyDescription,
       nodes: nodes,
       round: currentRound,
       total_rounds: totalRounds,
       deadline: new Date(deadlineDate).toISOString(),
       language: surveyLanguage,
       status: 'PUBLISHED'
    };

    let error;

    if (editingProjectId) {
      const { error: updateError } = await supabase
        .from('projects')
        .update(projectPayload)
        .eq('id', editingProjectId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('projects')
        .insert([{ ...projectPayload, id: crypto.randomUUID() }]);
      error = insertError;
    }

    setIsSaving(false);

    if (error) {
       console.error('Save failed:', error.message);
       alert(`Error saving: ${error.message}`);
    } else {
       alert(editingProjectId ? 'Project UPDATED successfully!' : 'Project PUBLISHED successfully!');
       setNodes([]);
       setSurveyTitle('New Consensus Round');
       setEditingProjectId(null);
       if (onProjectPublished) onProjectPublished();
    }
  };

  const handleStatusChange = async (projectId: string, currentStatus: string) => {
     const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
     setUpdatingId(projectId);
     const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
     if (!error) {
        setExistingProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus as any } : p));
        if (onProjectPublished) onProjectPublished();
     }
     setUpdatingId(null);
  };

  const handleDeadlineChange = async (projectId: string, newDate: string) => {
     if (!newDate) return;
     const isoDate = new Date(newDate).toISOString();
     setUpdatingId(projectId);
     const { error } = await supabase.from('projects').update({ deadline: isoDate }).eq('id', projectId);
     if (!error) {
        setExistingProjects(prev => prev.map(p => p.id === projectId ? { ...p, deadline: isoDate } : p));
        if (onProjectPublished) onProjectPublished();
     }
     setUpdatingId(null);
  };

  const handleUpdateNode = (id: string, field: keyof SurveyNode, val: any) => setNodes(prev => updateNodeInTree(prev, id, (n) => ({ ...n, [field]: val })));
  const handleAddRootNode = (type: NodeType) => {
    const newNode: SurveyNode = {
      id: Math.random().toString(36).substr(2, 9),
      type, title: '', children: [],
      ...(type === NodeType.QUESTION ? { questionType: QuestionType.LIKERT_SCALE, required: true, likertScale: 5 } : {})
    };
    setNodes([...nodes, newNode]);
  };
  const handleAddChildNode = (parentId: string, type: NodeType) => {
     const newNode: SurveyNode = {
      id: Math.random().toString(36).substr(2, 9),
      type, title: '', children: [],
      ...(type === NodeType.QUESTION ? { questionType: QuestionType.LIKERT_SCALE, required: true, likertScale: 5, options: [{id: '1', label: 'Option 1'}] } : {})
    };
    setNodes(prev => addChildToNode(prev, parentId, newNode));
  };
  const handleDeleteNode = (id: string) => setNodes(prev => deleteNodeFromTree(prev, id));

  return (
    <div className="flex min-h-screen bg-academic-50">
      {/* Sidebar */}
      <div className="w-64 bg-academic-900 text-academic-100 flex flex-col shadow-xl z-10 sticky top-0 h-screen">
        <div className="p-6 border-b border-academic-800">
          <div className="font-bold text-lg tracking-wider text-white">ADMIN CONSOLE</div>
          <div className="text-xs text-academic-400 mt-1">Delphi Manager v2.1</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => {setActiveTab('BUILDER'); setEditingProjectId(null);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'BUILDER' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}>
            <FileText className="w-5 h-5" /> <span className="font-medium">Form Builder</span>
          </button>
          <button onClick={() => setActiveTab('PROJECTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'PROJECTS' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}>
            <FolderOpen className="w-5 h-5" /> <span className="font-medium">Manage Projects</span>
          </button>
          <button onClick={() => setActiveTab('RESPONSES')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'RESPONSES' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}>
            <BarChart3 className="w-5 h-5" /> <span className="font-medium">Responses</span>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto h-screen">
        {activeTab === 'BUILDER' && (
          <div className="max-w-4xl mx-auto py-12 px-8">
            
            {/* Preview Modal */}
            {showPreview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-academic-50 rounded-t-xl">
                    <h3 className="font-bold text-academic-800 flex items-center gap-2"><Eye className="w-4 h-4"/> Preview: Expert View</h3>
                    <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-8 overflow-y-auto">
                     <h1 className="text-2xl font-bold mb-2">{surveyTitle}</h1>
                     <p className="text-academic-600 mb-6">{surveyDescription}</p>
                     {nodes.map((node, idx) => <PreviewNodeRenderer key={node.id} node={node} level={`${idx + 1}`} />)}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-academic-200 p-8 mb-8 sticky top-4 z-20">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xs font-bold text-academic-400 uppercase tracking-widest">Configuration</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${editingProjectId ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span className="text-xs font-bold text-academic-500">{editingProjectId ? 'EDITING MODE' : 'NEW PROJECT'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex bg-academic-100 rounded-md p-1">
                      <button onClick={() => setSurveyLanguage('en')} className={`px-3 py-1 text-xs font-bold rounded ${surveyLanguage === 'en' ? 'bg-white text-primary-700 shadow-sm' : 'text-academic-500'}`}>EN</button>
                      <button onClick={() => setSurveyLanguage('cn')} className={`px-3 py-1 text-xs font-bold rounded ${surveyLanguage === 'cn' ? 'bg-white text-primary-700 shadow-sm' : 'text-academic-500'}`}>CN</button>
                   </div>
                   <Button variant="outline" onClick={() => setShowPreview(true)} className="gap-2">
                     <Eye className="w-4 h-4"/> Preview
                   </Button>
                   <Button size="lg" onClick={saveProject} disabled={isSaving} className="flex items-center gap-2 shadow-lg shadow-primary-900/20">
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />} 
                      {editingProjectId ? 'UPDATE PROJECT' : 'PUBLISH'}
                   </Button>
                </div>
              </div>
              
              {/* Round & Deadline Config */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-academic-50 rounded-lg border border-academic-100">
                 <div>
                    <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Current Round</label>
                    <div className="flex items-center bg-white border border-academic-200 rounded px-2">
                       <Hash className="w-4 h-4 text-academic-400 mr-2"/>
                       <input type="number" min="1" value={currentRound} onChange={e => setCurrentRound(parseInt(e.target.value))} className="w-full py-1.5 outline-none text-sm"/>
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Total Rounds</label>
                    <div className="flex items-center bg-white border border-academic-200 rounded px-2">
                       <BarChart3 className="w-4 h-4 text-academic-400 mr-2"/>
                       <input type="number" min="1" value={totalRounds} onChange={e => setTotalRounds(parseInt(e.target.value))} className="w-full py-1.5 outline-none text-sm"/>
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-academic-500 uppercase mb-1">Deadline</label>
                    <div className="flex items-center bg-white border border-academic-200 rounded px-2">
                       <Calendar className="w-4 h-4 text-academic-400 mr-2"/>
                       <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="w-full py-1.5 outline-none text-sm"/>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} className="w-full text-2xl font-bold bg-transparent border-b border-academic-200 focus:outline-none placeholder-academic-300" placeholder="Round Title" />
                 <input value={surveySubtitle} onChange={(e) => setSurveySubtitle(e.target.value)} className="w-full text-lg bg-transparent border-b border-academic-200 focus:outline-none placeholder-academic-300" placeholder="Subtitle" />
                 <textarea value={surveyDescription} onChange={(e) => setSurveyDescription(e.target.value)} className="w-full text-sm bg-academic-50 border border-academic-200 rounded p-2 focus:outline-none min-h-[60px]" placeholder="Introduction/Description..." />
              </div>
            </div>

            <div className="space-y-6 pb-32">
               {nodes.length === 0 && <div className="text-center py-16 border-2 border-dashed border-academic-300 rounded-xl bg-academic-50/50 text-academic-400">Add a Section or Question to begin.</div>}
               {nodes.map((node, idx) => <BuilderNodeRenderer key={node.id} node={node} level={`${idx + 1}`} onUpdate={handleUpdateNode} onAddChild={handleAddChildNode} onDelete={handleDeleteNode} />)}
               
               <div className="flex gap-4 justify-center mt-8 border-t border-academic-200 pt-8">
                  <Button variant="secondary" onClick={() => handleAddRootNode(NodeType.SECTION)}><FolderPlus className="w-5 h-5 mr-2"/> Add Section</Button>
                  <Button variant="outline" onClick={() => handleAddRootNode(NodeType.QUESTION)}><Plus className="w-5 h-5 mr-2"/> Add Question</Button>
                  <Button variant="outline" onClick={() => handleAddRootNode(NodeType.TEXT)}><Type className="w-5 h-5 mr-2"/> Add Text</Button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'PROJECTS' && (
           <div className="max-w-6xl mx-auto py-12 px-8">
              <h1 className="text-2xl font-bold text-academic-900 mb-6">Manage Projects</h1>
              <div className="bg-white rounded-xl shadow-sm border border-academic-200 overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-academic-50 border-b border-academic-200">
                       <tr>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Title</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Round</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Deadline</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-academic-100">
                       {existingProjects.map((proj) => (
                          <tr key={proj.id} className="hover:bg-academic-50">
                             <td className="px-6 py-4 font-medium">
                                {proj.title}
                                <div className="text-xs text-academic-400">{proj.subtitle}</div>
                             </td>
                             <td className="px-6 py-4 text-sm">{proj.round} / {proj.totalRounds}</td>
                             <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${proj.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{proj.status}</span></td>
                             <td className="px-6 py-4">
                                <input type="date" className="text-sm border rounded px-2 py-1" value={proj.deadline ? new Date(proj.deadline).toISOString().split('T')[0] : ''} onChange={(e) => handleDeadlineChange(proj.id, e.target.value)} disabled={updatingId === proj.id} />
                             </td>
                             <td className="px-6 py-4 text-right space-x-2">
                                {proj.status === 'DRAFT' && (
                                   <Button size="sm" variant="secondary" onClick={() => handleEditProject(proj)} className="text-xs">
                                      <Edit className="w-3 h-3 mr-1"/> Edit
                                   </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => handleStatusChange(proj.id, proj.status)} disabled={updatingId === proj.id}>
                                   {updatingId === proj.id ? <Loader2 className="w-3 h-3 animate-spin"/> : (proj.status === 'PUBLISHED' ? <StopCircle className="w-3 h-3 mr-1"/> : <PlayCircle className="w-3 h-3 mr-1"/>)}
                                   {proj.status === 'PUBLISHED' ? 'Retract' : 'Publish'}
                                </Button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'RESPONSES' && (
           <div className="max-w-6xl mx-auto py-12 px-8">
              <h1 className="text-2xl font-bold text-academic-900 mb-6">Expert Responses</h1>
              {selectedResponse && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                       <div className="p-6 border-b flex justify-between">
                          <h2 className="text-xl font-bold">{selectedResponse.name}</h2>
                          <button onClick={() => setSelectedResponse(null)}><Settings className="w-5 h-5 rotate-45"/></button>
                       </div>
                       <div className="p-8 overflow-y-auto bg-gray-50 flex-1">
                          <pre className="text-xs bg-white p-4 rounded border overflow-auto">{JSON.stringify(selectedResponse.details, null, 2)}</pre>
                       </div>
                    </div>
                 </div>
              )}
              <div className="bg-white rounded-xl shadow-sm border border-academic-200">
                 <table className="w-full text-left">
                    <thead className="bg-academic-50 border-b">
                       <tr><th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Name</th><th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Project</th><th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase text-right">View</th></tr>
                    </thead>
                    <tbody className="divide-y divide-academic-100">
                       {responses.map((resp) => (
                          <tr key={resp.id} className="hover:bg-academic-50">
                             <td className="px-6 py-4">{resp.name} <span className="text-xs text-gray-400 block">{resp.institution}</span></td>
                             <td className="px-6 py-4 text-sm">{resp.title}</td>
                             <td className="px-6 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelectedResponse(resp)}><Eye className="w-3 h-3 mr-1"/> View</Button></td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};