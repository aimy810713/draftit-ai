import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocType, GeneratedDoc, DocConfig, UserProfile } from './types';
import { DOCUMENT_CONFIGS } from './constants';
import { Button } from './components/Button';
import { generateDocument } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { authService } from './services/authService';

const FREE_LIMIT_ERROR = "You’ve used your free drafts. Please top up your account to continue.";
const GEN_FAILURE_ERROR = "We couldn’t generate your document. Don't worry, no credits were used. Please try again.";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'form' | 'records' | 'auth' | 'support' | 'privacy' | 'terms' | 'refund'>('home');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedDoc, setSelectedDoc] = useState<DocConfig | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [currentFormData, setCurrentFormData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const lastInputsHash = useRef<string>("");

  const claimDocument = async (userId: string, doc: GeneratedDoc) => {
    if (!isSupabaseConfigured || !doc || doc.id.length > 15) return;

    try {
      const { data: savedDoc, error: saveError } = await supabase
        .from('documents')
        .insert([{
          user_id: userId,
          document_type: doc.document_type,
          input_data: currentFormData,
          generated_text: doc.generated_text
        }])
        .select()
        .single();

      if (!saveError && savedDoc) {
        setGeneratedDoc({ ...doc, id: savedDoc.id });
        setHistory(prev => [{ ...doc, id: savedDoc.id }, ...prev]);
        await supabase.from('usage_logs').insert([{
          user_id: userId,
          action: 'claim_guest_document',
          credits_used: 1,
          doc_id: savedDoc.id
        }]);
        fetchProfile(userId);
      }
    } catch (err) {
      console.error("Failed to claim document:", err);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      const prevUser = user;
      setUser(currentUser);
      
      if (currentUser) {
        fetchProfile(currentUser.id);
        if (!prevUser && generatedDoc) claimDocument(currentUser.id, generatedDoc);
      } else {
        setProfile(null);
        setHistory([]);
        setGeneratedDoc(null);
        setSelectedDoc(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [generatedDoc]);

  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await authService.getUserProfile(userId);
      if (error) throw error;
      if (data) setProfile(data);
    } catch (err) {
      console.error("Profile Fetch Error:", err);
    }
  };

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setHistory(data.map((item: any) => ({
          id: item.id,
          document_type: item.document_type as DocType,
          generated_text: item.generated_text,
          created_at: item.created_at
        })));
      }
    } catch (e) {
      console.warn("History Sync Failure:", e);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setIsAuthLoading(true);
    setError(null);
    try {
      if (authMode === 'signup') {
        const { error } = await authService.signUp(authEmail, authPassword);
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      } else {
        const { error } = await authService.signIn(authEmail, authPassword);
        if (error) throw error;
        setCurrentPage('form');
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleDocSelect = (config: DocConfig) => {
    setSelectedDoc(config);
    setGeneratedDoc(null);
    setCurrentFormData(null);
    setError(null);
    setCurrentPage('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDoc || isGenerating) return;
    if (user && profile && profile.credits_remaining <= 0) {
      setError(FREE_LIMIT_ERROR);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const hash = JSON.stringify(data);

    if (generatedDoc && hash === lastInputsHash.current) {
      setError("This document is already generated with these details.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentFormData(data);

    try {
      const result = await generateDocument(selectedDoc.type, data);
      let savedId = Date.now().toString();

      if (user && isSupabaseConfigured) {
        const { data: savedDoc, error: saveError } = await supabase
          .from('documents')
          .insert([{
            user_id: user.id,
            document_type: selectedDoc.type,
            input_data: data,
            generated_text: result
          }])
          .select()
          .single();

        if (!saveError) savedId = savedDoc.id;
        const newCredits = Math.max(0, (profile?.credits_remaining ?? 0) - 1);
        await supabase.from('users_profile').update({ credits_remaining: newCredits }).eq('id', user.id);
        if (profile) setProfile({ ...profile, credits_remaining: newCredits });
      }

      lastInputsHash.current = hash;
      const newDoc: GeneratedDoc = {
        id: savedId,
        document_type: selectedDoc.type,
        generated_text: result,
        created_at: new Date().toISOString()
      };
      setGeneratedDoc(newDoc);
      if (user) setHistory(prev => [newDoc, ...prev]);
    } catch (err: any) {
      setError(err.message || GEN_FAILURE_ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    if (!user) { setShowLoginPrompt(true); return; }
    if (!generatedDoc) return;
    try {
      await navigator.clipboard.writeText(generatedDoc.generated_text);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) { console.error(err); }
  };

  const handleDownloadPDF = () => {
    if (!user) { setShowLoginPrompt(true); return; }
    window.print();
  };

  // Fix: Added missing renderAuth function to handle user login and registration UI
  const renderAuth = () => (
    <div className="max-w-md mx-auto py-20 px-6 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-xl">
        <h2 className="text-2xl font-bold mb-2 text-center">
          {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-500 text-xs text-center mb-8 uppercase tracking-widest font-bold">
          {authMode === 'signin' ? 'Sign in to access your drafts' : 'Get started for free'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
            <input 
              type="email" 
              required 
              value={authEmail} 
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none" 
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
            <input 
              type="password" 
              required 
              value={authPassword} 
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none" 
              placeholder="••••••••"
            />
          </div>
          
          <Button isLoading={isAuthLoading} className="w-full h-11 text-sm mt-4">
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </Button>

          {error && <p className="text-red-500 text-[10px] font-bold text-center mt-2">{error}</p>}
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <p className="text-xs text-slate-500">
            {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-600 font-bold ml-1 hover:underline"
            >
              {authMode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-6xl mx-auto px-6 pb-24 animate-fade-in">
      <section className="py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">
          Standard Indian office documents — generated in seconds.
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Professional drafting for resignation letters, bank complaints, and official applications. Correct format. Accepted by offices.
        </p>
        <div className="flex justify-center mb-16">
          <Button className="h-14 px-10 text-lg shadow-sm" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>
            Select Document Type
          </Button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 text-slate-500 font-semibold border-y border-slate-100 py-8">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            No monthly subscription
          </div>
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            Pay only for what you need
          </div>
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            Standard Indian formats
          </div>
        </div>
      </section>

      <section className="py-16 bg-white rounded-3xl border border-slate-100 mb-16 px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-800">How it works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold mx-auto mb-4">1</div>
            <p className="font-bold text-slate-800 mb-1">Pick a document</p>
            <p className="text-sm text-slate-500">Select the specific letter or application type from our catalog.</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold mx-auto mb-4">2</div>
            <p className="font-bold text-slate-800 mb-1">Enter your details</p>
            <p className="text-sm text-slate-500">Provide names, dates, and basic info through our simple form.</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold mx-auto mb-4">3</div>
            <p className="font-bold text-slate-800 mb-1">Download your draft</p>
            <p className="text-sm text-slate-500">Get a ready-to-print document formatted correctly for Indian offices.</p>
          </div>
        </div>
      </section>

      <div id="catalog" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(DOCUMENT_CONFIGS).map(config => (
          <div key={config.id} onClick={() => handleDocSelect(config)}
            className="group bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer flex flex-col h-full"
          >
            <h3 className="text-lg font-bold mb-2 text-slate-800">{config.title}</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-6 flex-grow">{config.description}</p>
            <div className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Select Template →</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderForm = () => {
    if (!selectedDoc) return null;
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in">
        <button onClick={() => setCurrentPage('home')} className="text-slate-400 text-xs font-bold mb-8 flex items-center gap-1 hover:text-blue-600 no-print uppercase tracking-tighter">
          ← Selection Catalog
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="no-print">
            <h2 className="text-2xl font-bold mb-6">{selectedDoc.title}</h2>
            <form onSubmit={handleGenerate} className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100">
              {selectedDoc.fields.map(field => (
                <div key={field.name}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea name={field.name} required={field.required} rows={3} defaultValue={currentFormData?.[field.name] || ''}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none" />
                  ) : (
                    <input name={field.name} type={field.type} required={field.required} defaultValue={currentFormData?.[field.name] || ''}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none" />
                  )}
                </div>
              ))}
              <Button isLoading={isGenerating} className="w-full h-11 text-sm">
                {isGenerating ? 'Drafting...' : 'Generate Document'}
              </Button>
              {error && <p className="text-red-500 text-[10px] font-bold text-center mt-2">{error}</p>}
            </form>
          </div>

          <div className="sticky top-24">
            {generatedDoc ? (
              <div id="printable-document" className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50 no-print">
                  <h3 className="text-sm font-bold text-slate-700">Ready-to-Print Draft</h3>
                </div>
                <div className="p-8">
                  <div className="document-text font-serif text-slate-800 text-[13px] leading-relaxed whitespace-pre-wrap bg-white p-4">
                    {generatedDoc.generated_text}
                  </div>
                  <div className="no-print mt-8 pt-6 border-t border-slate-50">
                    {showLoginPrompt && !user ? (
                      <div className="p-5 bg-slate-900 rounded-xl text-white">
                        <p className="text-xs font-bold mb-3">Save this document permanently?</p>
                        <div className="flex gap-2">
                          <Button onClick={() => setCurrentPage('auth')} className="bg-white text-slate-900 hover:bg-slate-100 flex-1 h-9 text-xs">Create Free Account</Button>
                          <Button onClick={() => setShowLoginPrompt(false)} variant="ghost" className="text-white hover:text-white/80 h-9 text-xs">Stay Guest</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleCopyText} variant="outline" className="flex-1 h-10 text-xs">
                          {copyStatus === 'copied' ? 'Copied to Clipboard' : 'Copy Text Content'}
                        </Button>
                        <Button onClick={handleDownloadPDF} className="flex-1 h-10 text-xs">Save as PDF / Print</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 no-print">
                <p className="text-slate-400 text-xs">Your generated draft will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 py-4 px-6 md:px-12 flex justify-between items-center no-print">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('home')}>
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-sm">D</div>
          <span className="text-lg font-black tracking-tight text-slate-900">DraftIt AI</span>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          <button onClick={() => setCurrentPage('home')} className={`hover:text-slate-900 ${currentPage === 'home' ? 'text-slate-900' : ''}`}>Catalog</button>
          {user && <button onClick={() => setCurrentPage('records')} className={`hover:text-slate-900 ${currentPage === 'records' ? 'text-slate-900' : ''}`}>My Documents</button>}
          <button onClick={() => setCurrentPage('support')} className={`hover:text-slate-900 ${currentPage === 'support' ? 'text-blue-600' : ''}`}>Support</button>
        </div>
        <div>
          {user ? (
            <Button variant="ghost" className="text-xs h-9 px-4" onClick={() => authService.signOut()}>Sign Out</Button>
          ) : (
            <Button className="h-9 px-6 text-[11px] uppercase tracking-wider font-bold" onClick={() => setCurrentPage('auth')}>Sign In</Button>
          )}
        </div>
      </nav>

      <main className="flex-grow">
        {currentPage === 'home' && renderHome()}
        {currentPage === 'auth' && renderAuth()}
        {currentPage === 'form' && renderForm()}
        {currentPage === 'records' && (user ? <History history={history} onSelect={(doc) => {
          setGeneratedDoc(doc);
          setSelectedDoc(Object.values(DOCUMENT_CONFIGS).find(c => c.type === doc.document_type) || null);
          setCurrentPage('form');
        }} onRefresh={fetchHistory} /> : renderAuth())}
        {currentPage === 'support' && <Support />}
        {currentPage === 'privacy' && <Privacy />}
        {currentPage === 'terms' && <Terms />}
        {currentPage === 'refund' && <Refund />}
      </main>

      <footer className="bg-white border-t border-slate-100 py-12 px-6 no-print">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="font-bold text-slate-900 text-sm">DraftIt AI</h3>
            <p className="text-slate-400 text-[10px] mt-1 font-medium">Standard Indian office documentation formats.</p>
            <div className="flex flex-wrap gap-4 mt-6 justify-center md:justify-start">
              <button onClick={() => { setCurrentPage('privacy'); window.scrollTo(0,0); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-900">Privacy Policy</button>
              <button onClick={() => { setCurrentPage('terms'); window.scrollTo(0,0); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-900">Terms of Service</button>
              <button onClick={() => { setCurrentPage('refund'); window.scrollTo(0,0); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-900">Refund Policy</button>
              <button onClick={() => { setCurrentPage('support'); window.scrollTo(0,0); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-900">Contact Support</button>
            </div>
          </div>
          <div className="text-slate-400 text-[10px] text-center md:text-right font-medium leading-loose max-w-sm">
            <p>No monthly subscription required. Pay only for the documents you need.</p>
            <p>© 2026 DraftIt AI. Commercial documentation service. Not a law firm and does not provide legal advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Internal Helper Components for cleaner code
const Support = () => (
  <div className="max-w-2xl mx-auto py-24 px-6 text-center animate-fade-in">
    <h2 className="text-2xl font-black mb-4">Customer Support</h2>
    <p className="text-slate-500 mb-12 text-sm">Email us for assistance with your account or billing.</p>
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm inline-block">
      <p className="text-slate-900 font-bold text-lg">support@draftit.ai</p>
      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">24-hour response time</p>
    </div>
  </div>
);

const History = ({ history, onSelect, onRefresh }: any) => (
  <div className="max-w-4xl mx-auto py-16 px-6 animate-fade-in min-h-[60vh]">
    <div className="flex justify-between items-center mb-10">
      <h2 className="text-2xl font-bold">Document History</h2>
      <Button variant="ghost" onClick={onRefresh} className="text-[10px] font-bold uppercase tracking-widest">Refresh List</Button>
    </div>
    {history.length === 0 ? (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <p className="text-slate-400 text-xs">Your generated documents will appear here.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map((doc: any) => (
          <div key={doc.id} className="bg-white p-6 rounded-xl border border-slate-100 hover:border-slate-300 transition-all flex flex-col">
            <h4 className="font-bold text-sm mb-1">{doc.document_type}</h4>
            <p className="text-[10px] text-slate-400 mb-6 italic">Created {new Date(doc.created_at).toLocaleDateString()}</p>
            <Button variant="outline" className="w-full text-[10px] h-9" onClick={() => onSelect(doc)}>Open Draft</Button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Privacy = () => (
  <div className="max-w-3xl mx-auto py-20 px-6 animate-fade-in">
    <h2 className="text-2xl font-bold mb-8">Privacy Policy</h2>
    <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
      <p>This policy details how DraftIt AI handles user information. We collect form data to generate documents and email addresses to manage accounts.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">1. Data Usage</h4>
      <p>Data entered into forms is used strictly to produce the requested draft. We do not sell user data to third parties.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">2. Payment Security</h4>
      <p>All financial transactions are handled by Razorpay. We do not store credit card or bank details on our servers.</p>
    </div>
  </div>
);

const Terms = () => (
  <div className="max-w-3xl mx-auto py-20 px-6 animate-fade-in">
    <h2 className="text-2xl font-bold mb-8">Terms of Service</h2>
    <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
      <p>By using DraftIt AI, you agree to these terms. We provide document drafting assistance; we are not a legal firm.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">1. Service Nature</h4>
      <p>Drafts are produced by an automated generator. Users are responsible for reviewing accuracy before official submission.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">2. Liability</h4>
      <p>We are not liable for the acceptance or rejection of documents by third-party authorities or employers.</p>
    </div>
  </div>
);

const Refund = () => (
  <div className="max-w-3xl mx-auto py-20 px-6 animate-fade-in">
    <h2 className="text-2xl font-bold mb-8">Refund Policy</h2>
    <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
      <p>Our service provides instant digital content. Refunds are processed under specific conditions.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">1. Eligibility</h4>
      <p>Refunds are only issued if a technical error prevents a paid document from being generated after successful payment.</p>
      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">2. Non-Refundable Items</h4>
      <p>Successful generations that do not meet personal stylistic preferences are not eligible for refund.</p>
    </div>
  </div>
);
