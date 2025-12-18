import React, { useState, useEffect, useRef } from 'react';
import { Project, QuestionType, SurveyNode, NodeType } from '../types';
import { Plus, Trash2, GripVertical, Save, Settings, FileText, BarChart3, Eye, Loader2, FolderPlus, FolderOpen, Image as ImageIcon, ChevronUp, Type, StopCircle, PlayCircle, Edit, Copy, Menu, Download, Bold, Underline, Highlighter, WrapText, Italic, X, UploadCloud } from 'lucide-react';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';

// --- 1. 简易富文本工具栏 ---
const SimpleEditorToolbar: React.FC<{ 
  textareaRef: React.RefObject<HTMLTextAreaElement>; 
  onUpdate: (newText: string) => void; 
  compact?: boolean; // 新增：紧凑模式（给标题用）
}> = ({ textareaRef, onUpdate, compact }) => {
  
  const insertTag = (tagStart: string, tagEnd: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const newText = before + tagStart + (selection || '') + tagEnd + after;
    onUpdate(newText);
    
    setTimeout(() => {
      el.focus();
      const newCursorPos = selection ? start + tagStart.length + selection.length + tagEnd.length : start + tagStart.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className={`flex gap-1 mb-1 p-1 bg-gray-50 border border-b-0 rounded-t border-academic-300 ${compact ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}`}>
       <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1 hover:bg-gray-200 rounded text-academic-700" title="Bold"><Bold className="w-3 h-3"/></button>
       <button type="button" onClick={() => insertTag('<i>', '</i>')} className="p-1 hover:bg-gray-200 rounded text-academic-700" title="Italic"><Italic className="w-3 h-3"/></button>
       <button type="button" onClick={() => insertTag('<u>', '</u>')} className="p-1 hover:bg-gray-200 rounded text-academic-700" title="Underline"><Underline className="w-3 h-3"/></button>
       <button type="button" onClick={() => insertTag('<mark>', '</mark>')} className="p-1 hover:bg-gray-200 rounded text-yellow-600" title="Highlight"><Highlighter className="w-3 h-3"/></button>
       {!compact && (
         <>
           <div className="w-px h-3 bg-gray-300 mx-1 self-center"></div>
           <button type="button" onClick={() => insertTag('<br/>\n', '')} className="p-1 hover:bg-gray-200 rounded text-blue-600" title="Line Break"><WrapText className="w-3 h-3"/></button>
           <span className="text-[10px] text-gray-400 self-center ml-auto mr-2">Select text to format</span>
         </>
       )}
    </div>
  );
};

// --- Helper Functions ---
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

const flattenQuestions = (nodes: SurveyNode[]): SurveyNode[] => {
  let flat: SurveyNode[] = [];
  nodes.forEach(node => {
    if (node.type === NodeType.QUESTION) flat.push(node);
    if (node.children && node.children.length > 0) flat = [...flat, ...flattenQuestions(node.children)];
  });
  return flat;
};

// --- Component: Builder Node Renderer (Editor) ---
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
  
  // Refs specifically for rich text editors
  const titleInputRef = useRef<HTMLTextAreaElement>(null); // New: Ref for Title
  const descInputRef = useRef<HTMLTextAreaElement>(null); 
  
  const isSection = node.type === NodeType.SECTION;
  const isText = node.type === NodeType.TEXT;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) throw new Error('No file selected');
      const fileExt = file.name.split('.').pop();
      const fileName = `${node.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('survey-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('survey-images').getPublicUrl(fileName);
      onUpdate(node.id, 'imageUrl', publicUrl);
    } catch (error: any) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`
      relative border border-academic-200 rounded-lg p-3 md:p-4 mb-4 transition-all
      ${isSection ? 'bg-academic-50 ml-2 md:ml-4' : 'bg-white ml-4 md:ml-8 shadow-sm'}
      ${level.length === 1 ? '!ml-0' : ''}
    `}>
      <div className="absolute -left-2 md:-left-4 top-0 bottom-0 w-px bg-academic-200" />
      <div className="absolute -left-2 md:-left-4 top-6 w-2 md:w-4 h-px bg-academic-200" />

      <div className="flex gap-2 md:gap-3">
        <div className="mt-2 text-academic-300 cursor-move hidden md:block"><GripVertical className="w-4 h-4" /></div>
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-academic-400 bg-academic-100 px-1.5 py-0.5 rounded">{level}</span>
                <span className="text-[10px] md:text-xs font-bold text-academic-600 uppercase truncate">
                  {isSection ? 'Section' : isText ? 'Text/Media' : 'Question'}
                </span>
              </div>
              
              {/* --- UPDATED: Title Rich Text Editor --- */}
              <div className="mt-1">
                <SimpleEditorToolbar textareaRef={titleInputRef} onUpdate={(val) => onUpdate(node.id, 'title', val)} compact={true} />
                <textarea
                  ref={titleInputRef}
                  value={node.title}
                  onChange={(e) => onUpdate(node.id, 'title', e.target.value)}
                  className={`w-full bg-transparent border-b border-academic-200 rounded-b focus:border-academic-300 focus:outline-none transition-all placeholder-academic-300 font-mono resize-y min-h-[40px] overflow-hidden ${isSection ? 'text-base md:text-lg font-bold' : 'text-sm md:text-base font-medium'}`}
                  placeholder={isSection ? "Section Title (HTML supported)" : "Question Text (HTML supported)"}
                  rows={1}
                  onInput={(e) => {
                     // Auto-grow
                     const target = e.target as HTMLTextAreaElement;
                     target.style.height = 'auto';
                     target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>

            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setShowDetails(!showDetails)} className={`p-1.5 rounded ${showDetails ? 'text-primary-600 bg-primary-50' : 'text-academic-400 hover:bg-academic-100'}`}>
                {showDetails ? <ChevronUp className="w-4 h-4"/> : <ImageIcon className="w-4 h-4"/>}
              </button>
              <button onClick={() => onDelete(node.id)} className="p-1.5 text-academic-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Description Editor (Existing) */}
          {isText && (
             <div className="mt-2">
                <SimpleEditorToolbar textareaRef={descInputRef} onUpdate={(val) => onUpdate(node.id, 'description', val)} />
                <textarea 
                  ref={descInputRef}
                  value={node.description || ''}
                  onChange={(e) => onUpdate(node.id, 'description', e.target.value)}
                  className="w-full text-sm p-2 border border-academic-200 rounded-b focus:ring-1 focus:ring-primary-500 outline-none min-h-[60px] font-mono leading-relaxed"
                  placeholder="Content here..."
                />
             </div>
          )}

          {showDetails && (
            <div className="p-3 md:p-4 bg-academic-100/50 rounded-lg border border-academic-200 space-y-4 animate-in slide-in-from-top-2">
               {!isText && (
                 <div>
                    <label className="block text-xs font-bold text-academic-500 uppercase tracking-wider mb-1">Description</label>
                    <SimpleEditorToolbar textareaRef={descInputRef} onUpdate={(val) => onUpdate(node.id, 'description', val)} />
                    <textarea 
                      ref={descInputRef}
                      value={node.description || ''}
                      onChange={(e) => onUpdate(node.id, 'description', e.target.value)}
                      className="w-full text-sm p-2 border border-academic-200 rounded-b outline-none font-mono" rows={3}
                      placeholder="Enter description..."
                    />
                 </div>
               )}
               
               <div>
                  <label className="block text-xs font-bold text-academic-500 uppercase tracking-wider mb-2">Image</label>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" disabled={uploading}/>
                  <div className="flex flex-col gap-3">
                    {node.imageUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-academic-200 bg-white">
                        <img src={node.imageUrl} alt="Preview" className="w-full h-auto max-h-[300px] object-contain" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Change</Button>
                             <Button size="sm" variant="destructive" onClick={() => onUpdate(node.id, 'imageUrl', '')}>Remove</Button>
                         </div>
                      </div>
                    ) : (
                      <div onClick={() => !uploading && fileInputRef.current?.click()} className="border-2 border-dashed border-academic-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-academic-200/50">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <UploadCloud className="w-5 h-5 text-academic-400"/>}
                        <span className="text-xs text-academic-500">Tap to upload</span>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          )}

          {!isSection && !isText && (
             <div className="pl-2 border-l-2 border-academic-100 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
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
                         <input key={opt.id} value={opt.label} onChange={(e) => {
                               const newOpts = [...(node.options || [])];
                               newOpts[idx].label = e.target.value;
                               onUpdate(node.id, 'options', newOpts);
                            }} className="block w-full text-sm border border-academic-200 rounded px-2 py-1" 
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
             <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.SECTION)} className="text-xs h-7 px-2"><FolderPlus className="w-3 h-3 mr-1" /> Sub</Button>
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.QUESTION)} className="text-xs h-7 px-2"><Plus className="w-3 h-3 mr-1" /> Q</Button>
                <Button size="sm" variant="secondary" onClick={() => onAddChild(node.id, NodeType.TEXT)} className="text-xs h-7 px-2"><Type className="w-3 h-3 mr-1" /> Txt</Button>
             </div>
          )}
        </div>
      </div>
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

// --- Component: Preview (支持 HTML 渲染) ---
const PreviewNodeRenderer: React.FC<{ node: SurveyNode; level: string }> = ({ node, level }) => {
  const imageStyleClass = "w-full h-auto object-contain rounded mb-4 border border-academic-200";

  // 渲染函数：解析 HTML
  const renderRichText = (text?: string, isTitle?: boolean) => {
    if (!text) return isTitle ? 'Untitled' : null;
    const baseClass = isTitle ? "" : "text-sm text-academic-600 whitespace-pre-wrap leading-relaxed";
    return <span className={baseClass} dangerouslySetInnerHTML={{ __html: text }} />;
  };

  if (node.type === NodeType.SECTION) {
    return (
      <div className="mb-6 border-l-2 border-academic-200 pl-3 md:pl-4 mt-4">
        <h3 className="text-base md:text-lg font-bold text-academic-800 mb-2 flex items-center gap-2">
          <span className="text-xs font-mono text-academic-400 shrink-0">{level}</span> 
          <span>{renderRichText(node.title, true)}</span>
        </h3>
        {node.description && <div className="mb-4 bg-academic-50 p-3 rounded">{renderRichText(node.description)}</div>}
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
          <h4 className="font-bold text-academic-900 mb-2">{renderRichText(node.title, true)}</h4>
          {node.imageUrl && <img src={node.imageUrl} className={imageStyleClass} alt="Content" />}
          {renderRichText(node.description)}
       </div>
    );
  }
  return (
    <div className="bg-white p-4 md:p-5 rounded-lg border border-academic-200 shadow-sm mb-4">
       <div className="flex gap-2 md:gap-3">
          <span className="text-xs font-mono text-academic-400 mt-1 shrink-0">{level}</span>
          <div className="flex-1 min-w-0">
             <h4 className="font-medium text-academic-900 mb-2">{renderRichText(node.title, true)}</h4>
             {node.description && <div className="mb-3 text-academic-500">{renderRichText(node.description)}</div>}
             {node.imageUrl && <img src={node.imageUrl} className={imageStyleClass} alt="Question" />}
             <div className="mt-2 pointer-events-none opacity-80">
                {node.questionType === QuestionType.LIKERT_SCALE && (
                   <div className="flex justify-between max-w-sm gap-1">
                      {Array.from({length: node.likertScale || 5}, (_, i) => i + 1).map(n => (
                         <div key={n} className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-academic-300 flex items-center justify-center text-xs md:text-sm text-academic-500 bg-gray-50">{n}</div>
                      ))}
                   </div>
                )}
                {node.questionType === QuestionType.SINGLE_CHOICE && (
                   <div className="space-y-2">
                      {node.options?.map(opt => (
                         <div key={opt.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded">
                            <div className="w-4 h-4 rounded-full border border-academic-400"></div>
                            <span className="text-sm text-academic-700">{opt.label}</span>
                         </div>
                      ))}
                   </div>
                )}
                {node.questionType === QuestionType.TEXT_AREA && <div className="h-20 border border-academic-200 rounded bg-academic-50"></div>}
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Builder State
  const [surveyTitle, setSurveyTitle] = useState('New Consensus Round');
  const [surveySubtitle, setSurveySubtitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyLanguage, setSurveyLanguage] = useState<'en' | 'cn'>('en');
  const [nodes, setNodes] = useState<SurveyNode[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [deadlineDate, setDeadlineDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
     if (!error && data) setExistingProjects(data.map((p: any) => ({ ...p, totalRounds: p.total_rounds })));
     setIsLoadingProjects(false);
  };

  const fetchResponses = async () => {
    setIsLoadingResponses(true);
    const { data: responseData, error } = await supabase.from('responses').select('*, experts(*), projects(title)');
    if (!error && responseData) {
      setResponses(responseData.map((r: any) => ({
        id: r.id, name: r.experts?.name || 'Unknown', institution: r.experts?.institution || 'Unknown',
        status: r.status || 'SUBMITTED', title: r.projects?.title || 'Untitled', details: r.answers,
        expertFull: r.experts 
      })));
    }
    setIsLoadingResponses(false);
  };

  useEffect(() => {
    if (activeTab === 'RESPONSES') fetchResponses();
    if (activeTab === 'PROJECTS') fetchProjectsList();
  }, [activeTab]);

  // CSV Export Logic
  const handleExportCSV = async (project: Project) => {
    try {
      setIsExporting(true);
      const { data: responseData, error } = await supabase.from('responses').select('*, experts(*), projects(access_code)').eq('project_id', project.id);
      if (error) throw error;
      if (!responseData || responseData.length === 0) { alert("No responses found."); return; }

      const questionNodes = flattenQuestions(project.nodes || []);
      const expertHeaders = ["Expert Name", "Institution", "Department", "Job Title", "Education", "Major", "Years Exp", "Phone", "Email", "Submit Status", "Submit Time"];
      const questionHeaders = questionNodes.map((q, idx) => `Q${idx + 1}: ${q.title}`);
      
      const csvRows = [];
      csvRows.push([...expertHeaders, ...questionHeaders].join(","));

      responseData.forEach((resp: any) => {
        const exp = resp.experts || {};
        const answers = resp.answers || {};
        const expertData = [
          exp.name, exp.institution, exp.department, exp.job_title, exp.education, exp.major, exp.years_experience, exp.phone, exp.email,
          resp.status || "SUBMITTED", new Date(resp.updated_at).toLocaleString()
        ].map(field => `"${String(field || "").replace(/"/g, '""')}"`);
        
        const answerData = questionNodes.map(q => {
          const val = answers[q.id];
          return `"${String(val !== undefined && val !== null ? val : "").replace(/"/g, '""')}"`;
        });
        csvRows.push([...expertData, ...answerData].join(","));
      });

      const csvString = '\uFEFF' + csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Delphi_Export_${project.title}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) { alert("Export failed: " + e.message); } finally { setIsExporting(false); }
  };

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
    setIsMobileMenuOpen(false);
  };

  const handleDuplicateProject = (project: any) => {
    if(!window.confirm(`Duplicate "${project.title}"?`)) return;
    setSurveyTitle(`Copy of ${project.title}`);
    setSurveySubtitle(project.subtitle || '');
    setSurveyDescription(project.description || '');
    setSurveyLanguage(project.language || 'en');
    setNodes(JSON.parse(JSON.stringify(project.nodes || [])));
    setCurrentRound((project.round || 1) + 1);
    setTotalRounds(project.total_rounds || 3);
    setDeadlineDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEditingProjectId(null); 
    setActiveTab('BUILDER');
    setIsMobileMenuOpen(false);
    alert(`Draft created for Round ${(project.round || 1) + 1}.`);
  };

  const saveProject = async () => {
    setIsSaving(true);
    const projectPayload = {
       title: surveyTitle, subtitle: surveySubtitle, description: surveyDescription,
       nodes: nodes, round: currentRound, total_rounds: totalRounds,
       deadline: new Date(deadlineDate).toISOString(), language: surveyLanguage, status: 'PUBLISHED'
    };

    let error;
    if (editingProjectId) {
      const { error: updateError } = await supabase.from('projects').update(projectPayload).eq('id', editingProjectId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('projects').insert([{ ...projectPayload, id: crypto.randomUUID() }]);
      error = insertError;
    }
    setIsSaving(false);

    if (error) alert(`Error saving: ${error.message}`);
    else {
       alert(editingProjectId ? 'Updated!' : 'Published!');
       setNodes([]); setSurveyTitle('New Consensus Round'); setEditingProjectId(null);
       if (onProjectPublished) onProjectPublished();
    }
  };

  const handleStatusChange = async (projectId: string, currentStatus: string) => {
     const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
     setUpdatingId(projectId);
     await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
     setExistingProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus as any } : p));
     setUpdatingId(null);
  };

  const handleUpdateNode = (id: string, field: keyof SurveyNode, val: any) => setNodes(prev => updateNodeInTree(prev, id, (n) => ({ ...n, [field]: val })));
  const handleAddRootNode = (type: NodeType) => {
    setNodes([...nodes, { id: Math.random().toString(36).substr(2, 9), type, title: '', children: [], ...(type === NodeType.QUESTION ? { questionType: QuestionType.LIKERT_SCALE, required: true, likertScale: 5 } : {}) }]);
  };
  const handleAddChildNode = (parentId: string, type: NodeType) => {
    setNodes(prev => addChildToNode(prev, parentId, { id: Math.random().toString(36).substr(2, 9), type, title: '', children: [], ...(type === NodeType.QUESTION ? { questionType: QuestionType.LIKERT_SCALE, required: true, likertScale: 5, options: [{id: '1', label: 'Option 1'}] } : {}) }));
  };
  const handleDeleteNode = (id: string) => setNodes(prev => deleteNodeFromTree(prev, id));

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-academic-50">
      
      {/* Mobile Header & Sidebar (Same as before) */}
      <div className="md:hidden bg-academic-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
         <span className="font-bold">ADMIN CONSOLE</span>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu /></button>
      </div>
      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-academic-900 text-academic-100 flex-col shadow-xl z-40 fixed md:sticky top-14 md:top-0 h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto`}>
        <div className="p-6 border-b border-academic-800 hidden md:block">
          <div className="font-bold text-lg tracking-wider text-white">ADMIN CONSOLE</div>
          <div className="text-xs text-academic-400 mt-1">Delphi Manager v2.5</div>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => {setActiveTab('BUILDER'); setEditingProjectId(null); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'BUILDER' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}><FileText className="w-5 h-5" /> <span className="font-medium">Form Builder</span></button>
          <button onClick={() => {setActiveTab('PROJECTS'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'PROJECTS' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}><FolderOpen className="w-5 h-5" /> <span className="font-medium">Projects</span></button>
          <button onClick={() => {setActiveTab('RESPONSES'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${activeTab === 'RESPONSES' ? 'bg-primary-700 text-white' : 'hover:bg-academic-800 text-academic-400'}`}><BarChart3 className="w-5 h-5" /> <span className="font-medium">Responses</span></button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto h-screen w-full">
        {activeTab === 'BUILDER' && (
          <div className="max-w-4xl mx-auto py-6 px-4 md:py-12 md:px-8">
            
            {/* Preview Modal */}
            {showPreview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-academic-900/60 backdrop-blur-sm">
                <div className="bg-white md:rounded-xl shadow-2xl w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-academic-50 rounded-t-xl shrink-0">
                    <h3 className="font-bold text-academic-800 flex items-center gap-2"><Eye className="w-4 h-4"/> Preview</h3>
                    <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-200 rounded"><X className="w-6 h-6"/></button>
                  </div>
                  <div className="p-4 md:p-8 overflow-y-auto flex-1">
                     <h1 className="text-xl md:text-2xl font-bold mb-2">{surveyTitle}</h1>
                     <p className="text-academic-600 mb-6 text-sm">{surveyDescription}</p>
                     {nodes.map((node, idx) => <PreviewNodeRenderer key={node.id} node={node} level={`${idx + 1}`} />)}
                  </div>
                </div>
              </div>
            )}

            {/* Config Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-academic-200 p-4 md:p-8 mb-8 sticky top-0 md:top-4 z-20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xs font-bold text-academic-400 uppercase tracking-widest hidden md:block">Configuration</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${editingProjectId ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span className="text-xs font-bold text-academic-500">{editingProjectId ? 'EDITING MODE' : 'NEW PROJECT'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                   <div className="flex bg-academic-100 rounded-md p-1">
                      <button onClick={() => setSurveyLanguage('en')} className={`px-2 py-1 text-xs font-bold rounded ${surveyLanguage === 'en' ? 'bg-white shadow' : 'text-academic-500'}`}>EN</button>
                      <button onClick={() => setSurveyLanguage('cn')} className={`px-2 py-1 text-xs font-bold rounded ${surveyLanguage === 'cn' ? 'bg-white shadow' : 'text-academic-500'}`}>CN</button>
                   </div>
                   <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-1 flex-1 md:flex-none justify-center"><Eye className="w-4 h-4"/> Preview</Button>
                   <Button size="sm" onClick={saveProject} disabled={isSaving} className="flex items-center gap-2 shadow-lg flex-1 md:flex-none justify-center">{isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} {editingProjectId ? 'UPDATE' : 'PUBLISH'}</Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-4 p-2 bg-academic-50 rounded border border-academic-100">
                 <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Round</label>
                    <input type="number" min="1" value={currentRound} onChange={e => setCurrentRound(parseInt(e.target.value))} className="w-full text-sm border rounded px-2 py-1"/>
                 </div>
                 <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Total</label>
                    <input type="number" min="1" value={totalRounds} onChange={e => setTotalRounds(parseInt(e.target.value))} className="w-full text-sm border rounded px-2 py-1"/>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-bold text-academic-500 uppercase mb-1">Deadline</label>
                    <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="w-full text-sm border rounded px-2 py-1"/>
                 </div>
              </div>

              <div className="space-y-3">
                 <input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} className="w-full text-xl md:text-2xl font-bold bg-transparent border-b border-academic-200 focus:outline-none placeholder-academic-300" placeholder="Round Title" />
                 <input value={surveySubtitle} onChange={(e) => setSurveySubtitle(e.target.value)} className="w-full text-base md:text-lg bg-transparent border-b border-academic-200 focus:outline-none placeholder-academic-300" placeholder="Subtitle" />
                 <textarea value={surveyDescription} onChange={(e) => setSurveyDescription(e.target.value)} className="w-full text-sm bg-academic-50 border border-academic-200 rounded p-2 focus:outline-none min-h-[60px]" placeholder="Introduction..." />
              </div>
            </div>

            {/* Builder List */}
            <div className="space-y-4 md:space-y-6 pb-32">
               {nodes.length === 0 && <div className="text-center py-12 border-2 border-dashed border-academic-300 rounded-xl bg-academic-50/50 text-academic-400">Add questions or sections below.</div>}
               {nodes.map((node, idx) => <BuilderNodeRenderer key={node.id} node={node} level={`${idx + 1}`} onUpdate={handleUpdateNode} onAddChild={handleAddChildNode} onDelete={handleDeleteNode} />)}
               
               <div className="flex flex-wrap gap-2 md:gap-4 justify-center mt-8 border-t border-academic-200 pt-8">
                  <Button variant="secondary" onClick={() => handleAddRootNode(NodeType.SECTION)}><FolderPlus className="w-4 h-4 mr-2"/> Add Section</Button>
                  <Button variant="outline" onClick={() => handleAddRootNode(NodeType.QUESTION)}><Plus className="w-4 h-4 mr-2"/> Add Question</Button>
                  <Button variant="outline" onClick={() => handleAddRootNode(NodeType.TEXT)}><Type className="w-4 h-4 mr-2"/> Add Text</Button>
               </div>
            </div>
          </div>
        )}

        {/* Projects & Responses Tabs */}
        {activeTab === 'PROJECTS' && (
           <div className="max-w-6xl mx-auto py-6 px-4 md:py-12 md:px-8">
              <h1 className="text-xl md:text-2xl font-bold text-academic-900 mb-6">Manage Projects</h1>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                 {existingProjects.map((proj) => (
                    <div key={proj.id} className="bg-white p-4 rounded-lg shadow border border-academic-200">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <h3 className="font-bold text-academic-900">{proj.title}</h3>
                             <p className="text-xs text-academic-500">Round {proj.round}/{proj.totalRounds}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${proj.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{proj.status}</span>
                       </div>
                       <div className="flex flex-wrap justify-end gap-2 mt-4 pt-3 border-t">
                          <Button size="sm" variant="secondary" onClick={() => handleExportCSV(proj)} disabled={isExporting}><Download className="w-3 h-3 mr-1"/> Data</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleDuplicateProject(proj)}><Copy className="w-3 h-3 mr-1"/> Copy</Button>
                          {proj.status === 'DRAFT' && <Button size="sm" variant="secondary" onClick={() => handleEditProject(proj)}><Edit className="w-3 h-3 mr-1"/> Edit</Button>}
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(proj.id, proj.status)}>{proj.status === 'PUBLISHED' ? 'Retract' : 'Publish'}</Button>
                       </div>
                    </div>
                 ))}
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border border-academic-200 overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-academic-50 border-b border-academic-200">
                       <tr>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Title</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Round</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-academic-500 uppercase text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-academic-100">
                       {existingProjects.map((proj) => (
                          <tr key={proj.id} className="hover:bg-academic-50">
                             <td className="px-6 py-4 font-medium">{proj.title}</td>
                             <td className="px-6 py-4 text-sm">{proj.round} / {proj.totalRounds}</td>
                             <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${proj.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{proj.status}</span></td>
                             <td className="px-6 py-4 text-right space-x-2">
                                <Button size="sm" variant="secondary" onClick={() => handleExportCSV(proj)} disabled={isExporting}><Download className="w-3 h-3 mr-1"/> Data</Button>
                                <Button size="sm" variant="secondary" onClick={() => handleDuplicateProject(proj)}><Copy className="w-3 h-3 mr-1"/> Duplicate</Button>
                                {proj.status === 'DRAFT' && <Button size="sm" variant="secondary" onClick={() => handleEditProject(proj)}><Edit className="w-3 h-3 mr-1"/> Edit</Button>}
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
           <div className="max-w-6xl mx-auto py-6 px-4 md:py-12 md:px-8">
              <h1 className="text-xl md:text-2xl font-bold text-academic-900 mb-6">Expert Responses</h1>
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
              {/* Responsive List */}
              <div className="space-y-2">
                {responses.map((resp) => (
                  <div key={resp.id} className="bg-white p-4 rounded border border-academic-200 flex justify-between items-center">
                     <div>
                        <div className="font-bold text-academic-900">{resp.name}</div>
                        <div className="text-xs text-academic-500">{resp.institution} • {resp.title}</div>
                     </div>
                     <Button size="sm" variant="outline" onClick={() => setSelectedResponse(resp)}><Eye className="w-3 h-3 mr-1"/> View</Button>
                  </div>
                ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};