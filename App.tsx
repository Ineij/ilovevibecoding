import React, { useState, useEffect, useCallback } from 'react';
import { ExpertFlow } from './components/ExpertFlow';
import { AdminFlow } from './components/AdminFlow';
import { Button } from './components/ui/Button';
import { UserRole, Project } from './types';
import { ShieldCheck, Users, ArrowRight, Lock, X, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabaseClient';

// --- LANDING PAGE COMPONENT ---
const LandingPage: React.FC<{ onSelectRole: (role: UserRole) => void }> = ({ onSelectRole }) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '697302') {
      onSelectRole(UserRole.ADMIN);
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-academic-50 flex items-center justify-center p-6 relative">
      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 relative scale-100 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAdminLogin(false)} 
              className="absolute top-4 right-4 text-academic-400 hover:text-academic-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 ring-4 ring-primary-50/50">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-academic-900">Admin Access</h2>
              <p className="text-sm text-academic-500 mt-1">Please enter your secure passcode.</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <input 
                  autoFocus 
                  type="password" 
                  value={password}
                  onChange={(e) => {setPassword(e.target.value); setError(false);}}
                  className={`w-full text-center text-lg tracking-[0.2em] px-4 py-3 border rounded-lg outline-none transition-all ${error ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-academic-200 focus:border-primary-500'}`}
                  placeholder="••••••"
                />
                {error && <p className="text-xs text-red-600 text-center mt-3 font-medium">Incorrect passcode.</p>}
              </div>
              <Button type="submit" className="w-full justify-center py-2.5">Access Dashboard</Button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl w-full grid md:grid-cols-2 bg-white rounded-2xl shadow-xl overflow-hidden min-h-[600px]">
        {/* Left: Branding */}
        <div className="bg-academic-900 p-12 text-white flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary-600 opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-blue-400 opacity-10 blur-3xl"></div>
          
          <div className="z-10 mb-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Delphi Consensus Platform</h1>
            <p className="text-academic-400 font-light text-lg">Advancing medical knowledge through expert collaboration.</p>
          </div>
          
          <div className="z-10 text-xs text-academic-600">
             &copy; 2024 Research Institute. <br/>
             <span className="text-academic-500 font-medium">Secure. Anonymous. Academic.</span>
          </div>
        </div>

        {/* Right: Role Selection */}
        <div className="p-12 flex flex-col justify-center bg-white relative">
          <h2 className="text-2xl font-bold text-academic-900 mb-2">Welcome</h2>
          <p className="text-academic-500 mb-10">Please select your portal to continue.</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => onSelectRole(UserRole.EXPERT)} 
              className="w-full group p-5 rounded-xl border border-academic-200 hover:border-primary-500 hover:shadow-lg transition-all text-left flex items-start gap-4 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-academic-900 group-hover:text-primary-700">Invited Expert</h3>
                <p className="text-sm text-academic-500 mt-1">Access assigned consensus rounds.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-academic-300 ml-auto self-center group-hover:text-primary-500" />
            </button>

            <button 
              onClick={() => setShowAdminLogin(true)} 
              className="w-full group p-5 rounded-xl border border-academic-200 hover:border-academic-800 hover:shadow-lg transition-all text-left flex items-start gap-4 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-academic-100 text-academic-600 flex items-center justify-center group-hover:bg-academic-800 group-hover:text-white transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-academic-900">Admin / Author</h3>
                <p className="text-sm text-academic-500 mt-1">Manage projects and analyze data.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-academic-300 ml-auto self-center group-hover:text-academic-800" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch from Supabase
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('projects').select('*');
    
    if (error) {
      console.warn('Error fetching projects:', error.message);
    } else if (data) {
      const mappedProjects = data.map((p: any) => ({
         ...p,
         totalRounds: p.total_rounds
      }));
      setProjects(mappedProjects as Project[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (userRole) fetchProjects();
  }, [userRole, fetchProjects]);

  if (!userRole) {
    return <LandingPage onSelectRole={setUserRole} />;
  }

  return (
    <div className="min-h-screen bg-academic-50 font-sans">
      <nav className="bg-white border-b border-academic-200 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setUserRole(null)}>
          <div className="w-8 h-8 bg-academic-900 rounded-md flex items-center justify-center text-white font-bold">D</div>
          <span className="font-semibold text-academic-800 tracking-tight hidden sm:block">Delphi Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-academic-500 bg-academic-50 px-3 py-1 rounded-full">
            {userRole === UserRole.ADMIN ? 'Administrator View' : 'Expert View'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setUserRole(null)}>Logout</Button>
        </div>
      </nav>

      <main>
        {loading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : (
          userRole === UserRole.EXPERT ? (
            <ExpertFlow projects={projects} />
          ) : (
            <AdminFlow onProjectPublished={fetchProjects} />
          )
        )}
      </main>
    </div>
  );
}

export default App;