/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  FileText, 
  Code, 
  Table, 
  Copy, 
  Check, 
  Loader2, 
  History,
  Trash2,
  FileSearch,
  LogIn,
  LogOut,
  FolderOpen,
  Filter,
  Info,
  Calendar,
  Layers,
  Database,
  CloudLightning,
  ChevronRight,
  ExternalLink,
  Tag,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, query, where, orderBy, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';

import VercelGuide from './components/VercelGuide';
import DocumentResultView from './components/DocumentResultView';

interface DigitizeResponse {
  plainText: string;
  json: string;
  csv: string;
}

interface FirestoreDocumentItem extends DigitizeResponse {
  id: string;
  userId: string;
  fileName: string;
  category: string;
  date: string;
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // File processing state
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plainText' | 'json' | 'csv'>('plainText');
  const [copied, setCopied] = useState<string | null>(null);

  // Active result state (unsaved result)
  const [result, setResult] = useState<DigitizeResponse | null>(null);
  const [selectedFileForViewing, setSelectedFileForViewing] = useState<{
    id: string;
    fileName: string;
    category: string;
    date: string;
    isSaved: boolean;
  } | null>(null);

  const [savingToFirebase, setSavingToFirebase] = useState(false);

  // Filter & History state
  const [history, setHistory] = useState<FirestoreDocumentItem[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('todos');

  // UI state overlays
  const [showVercelGuide, setShowVercelGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth subscriber
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // Reset active views when switching users or logging out
      if (!currentUser) {
        setResult(null);
        setHistory([]);
        setSelectedFileForViewing(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore history subscriber
  useEffect(() => {
    if (!user) return;

    const path = 'documents';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: FirestoreDocumentItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        let formattedDate = '';
        if (data.createdAt) {
          try {
            formattedDate = data.createdAt.toDate().toLocaleString();
          } catch (e) {
            formattedDate = new Date().toLocaleString();
          }
        } else {
          formattedDate = new Date().toLocaleString();
        }

        return {
          id: docSnap.id,
          userId: data.userId || '',
          fileName: data.fileName || 'Documento sin nombre',
          plainText: data.plainText || '',
          json: data.json || '{}',
          csv: data.csv || '',
          category: data.category || 'otros',
          date: formattedDate
        };
      });
      setHistory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  // Google Login popup
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      alert('Error al iniciar sesión con Google. Revisa la consola o las configuraciones de dominio.');
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Upload/Digitize document via Gemini API server relay
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDigitize = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setSelectedFileForViewing(null); // Clear viewing historical items so they see the fresh outcome

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/digitize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Error al procesar el archivo en el servidor');
      }

      const data: DigitizeResponse = await response.json();
      setResult(data);
      setSelectedFileForViewing({
        id: '',
        fileName: file.name,
        category: 'otros',
        date: new Date().toLocaleString(),
        isSaved: false
      });
    } catch (error) {
      console.error(error);
      alert('Hubo un error al digitalizar el documento: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // Save active digitalized document to Firebase Firestore
  const handleSaveToFirebase = async (category: string) => {
    if (!user || !result || !selectedFileForViewing || selectedFileForViewing.isSaved) return;

    setSavingToFirebase(true);
    const path = 'documents';
    
    // Create clean compliant custom document ID
    const docId = crypto.randomUUID().replace(/[^a-zA-Z0-9_\-]/g, '');

    try {
      const docRef = doc(db, path, docId);
      
      const payload = {
        id: docId,
        userId: user.uid,
        fileName: selectedFileForViewing.fileName,
        plainText: result.plainText,
        json: result.json,
        csv: result.csv,
        category: category,
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, payload);

      // Successfully saved! We mark the currently displayed document as Saved.
      setSelectedFileForViewing({
        id: docId,
        fileName: selectedFileForViewing.fileName,
        category: category,
        date: new Date().toLocaleString(),
        isSaved: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${path}/${docId}`);
    } finally {
      setSavingToFirebase(false);
    }
  };

  // Delete saved document from Firebase Firestore
  const handleDeleteFromFirebase = async (docId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento de tu historial persistente?')) return;

    const path = `documents/${docId}`;
    try {
      await deleteDoc(doc(db, 'documents', docId));
      // If the deleted document is currently viewed, reset active views
      if (selectedFileForViewing?.id === docId) {
        setResult(null);
        setSelectedFileForViewing(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Load a save document item into visualizer panels
  const loadFromHistory = (item: FirestoreDocumentItem) => {
    setResult({
      plainText: item.plainText,
      json: item.json,
      csv: item.csv
    });
    setSelectedFileForViewing({
      id: item.id,
      fileName: item.fileName,
      category: item.category,
      date: item.date,
      isSaved: true
    });
    setFile(null); // Clear current uploaded files to indicate we are now examining history
  };

  // Category list filter handler
  const filteredHistory = history.filter(item => {
    if (selectedFilterCategory === 'todos') return true;
    return item.category === selectedFilterCategory;
  });

  // Filter Categories UI configs
  const filterCategories = [
    { key: 'todos', label: 'Todos' },
    { key: 'facturas', label: 'Facturas' },
    { key: 'remitos', label: 'Remitos' },
    { key: 'presupuestos', label: 'Presupuestos' },
    { key: 'notas', label: 'Notas' },
    { key: 'informes', label: 'Informes' },
    { key: 'otros', label: 'Otros' }
  ];

  // Specific badges for card rows
  const categoryBadgeMap: Record<string, string> = {
    facturas: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    remitos: 'bg-blue-50 text-blue-700 border border-blue-200',
    presupuestos: 'bg-amber-50 text-amber-700 border border-amber-200',
    notas: 'bg-purple-50 text-purple-700 border border-purple-200',
    informes: 'bg-sky-50 text-sky-700 border border-sky-300',
    otros: 'bg-slate-100 text-slate-700 border border-slate-200'
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
        <div className="text-center p-8 space-y-3">
          <Loader2 size={40} className="text-[#E30613] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Iniciando portal Crucianelli AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] text-[#1D1D1B] font-sans selection:bg-red-50 selection:text-red-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E30613] rounded-lg flex items-center justify-center text-white shadow-sm">
              <FileSearch size={22} id="logo-icon" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#1D1D1B]" id="app-title">
                Crucianelli <span className="text-[#E30613]">Scan</span>
              </h1>
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Potenciado por Firebase & Gemini 3 Flash</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-1.5 rounded-full">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full shadow-inner border border-slate-200"
                  />
                )}
                <div className="hidden sm:block text-left text-[10px] uppercase font-bold text-slate-600 px-1">
                  {user.displayName || 'Profesor de Clases'}
                  <span className="block text-[8px] font-medium text-slate-400 normal-case">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-full p-1.5 transition-all text-xs flex items-center gap-1.5"
                  title="Cerrar Sesión"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-[#1D1D1B] hover:bg-[#E30613] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow"
              >
                <LogIn size={14} /> Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <AnimatePresence mode="wait">
          {!user ? (
            /* Auth Login Box screen */
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 shadow-xl border border-slate-200 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -z-10"></div>
              
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-[#E30613] rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto transform rotate-3 hover:rotate-0 transition-transform">
                  <Database size={28} />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight text-[#1D1D1B]">
                    Digitalización Inteligente AI
                  </h2>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto uppercase font-bold tracking-wider">
                    Conexión Directa a la base de datos Firebase
                  </p>
                </div>

                <div className="border-t border-b border-slate-100 py-6 my-4 space-y-4 text-left max-w-sm mx-auto">
                  <p className="text-[11px] uppercase text-slate-400 font-extrabold tracking-widest">Beneficios de clase:</p>
                  <ul className="space-y-3 text-xs text-slate-600">
                    <li className="flex gap-2 items-start">
                      <span className="text-[#E30613] mt-0.5">✔</span>
                      <span><strong>Persistencia Instantánea:</strong> Almacená de forma segura cada documento categorizado en el proyecto <code className="bg-slate-100 text-[#E30613] px-1 rounded font-mono font-bold text-[10px]">integral-grail-pwh20</code>.</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-[#E30613] mt-0.5">✔</span>
                      <span><strong>Catalogo y Orden:</strong> Filtros directos para Facturas, Remitos, Presupuestos, Informes y Notas.</span>
                    </li>
                    <li className="flex gap-2 items-start">
                      <span className="text-[#E30613] mt-0.5">✔</span>
                      <span><strong>Seguridad Hardened:</strong> Reglas de Firebase de tipo ABAC (Zero-Trust) para que cada usuario vea únicamente su información.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-[#1D1D1B] hover:bg-[#c10510] text-white py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 shadow-md active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Continuar con Google
                  </button>
                  
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    Inicie sesión con su casilla institucional o personal para comenzar
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Dashboard View when Logged In */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Actions and lists */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Upload Section */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileUp size={14} className="text-[#E30613]" /> Digitalizar Documento
                  </h2>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center
                      ${file ? 'border-[#E30613] bg-red-50/10' : 'border-slate-200 hover:border-[#E30613]/50 hover:bg-slate-50'}
                    `}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                    {file ? (
                      <div className="space-y-1">
                        <div className="w-10 h-10 bg-[#E30613]/10 rounded-full flex items-center justify-center mx-auto mb-2 text-[#E30613]">
                          <Check size={20} />
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate max-w-[200px] mx-auto">{file.name}</p>
                        <p className="text-[9px] font-extrabold text-slate-450 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center mb-4 text-slate-400">
                          <FileUp size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-750">Arrastra o haz clic para subir</p>
                        <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-tight">Imágenes o PDF (Máx 20MB)</p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {file && (
                      <button
                        onClick={() => {
                          setFile(null);
                        }}
                        className="p-3 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-xl"
                        title="Quitar archivo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={handleDigitize}
                      disabled={!file || loading}
                      className={`
                        flex-1 py-3.5 rounded-xl font-bold uppercase tracking-widest text-2xs transition-all flex items-center justify-center gap-2 shadow-sm
                        ${!file || loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#E30613] text-white hover:bg-[#c10510] active:scale-[0.98]'}
                      `}
                    >
                      {loading ? <Loader2 className="animate-spin" size={14} /> : 'Procesar con IA'}
                    </button>
                  </div>
                </section>

                {/* Firestore History with filters */}
                <section className="bg-white rounded-2xl flex flex-col shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <History size={14} className="text-[#E30613]" /> Historial (Firebase)
                      </h2>
                      <span className="bg-slate-150 text-slate-600 px-2.5 py-0.5 rounded-full text-[9px] font-bold">
                        {filteredHistory.length} docs
                      </span>
                    </div>

                    {/* Category Filter Selector pills */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {filterCategories.map((fCat) => (
                        <button
                          key={fCat.key}
                          onClick={() => setSelectedFilterCategory(fCat.key)}
                          className={`
                            px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all border
                            ${selectedFilterCategory === fCat.key 
                              ? 'bg-[#1D1D1B] border-[#1D1D1B] text-white' 
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                            }
                          `}
                        >
                          {fCat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto custom-scrollbar">
                    {filteredHistory.length === 0 ? (
                      <div className="p-12 text-center space-y-2">
                        <History size={24} className="mx-auto text-slate-200" />
                        <p className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">
                          {selectedFilterCategory !== 'todos' ? `Sin ${selectedFilterCategory}` : 'Historial vacío'}
                        </p>
                      </div>
                    ) : (
                      filteredHistory.map((item) => {
                        const isCurrent = selectedFileForViewing?.id === item.id;
                        return (
                          <motion.div 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            key={item.id}
                            className={`
                              group relative flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer border-l-4
                              ${isCurrent ? 'bg-red-50/10 border-[#E30613]' : 'border-transparent'}
                            `}
                            onClick={() => loadFromHistory(item)}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${categoryBadgeMap[item.category] || 'bg-slate-100 text-slate-700'}`}>
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-700 truncate">{item.fileName}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{item.date}</p>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFromFirebase(item.id);
                              }}
                              className="p-2 text-slate-350 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              title="Eliminar de Firestore"
                            >
                              <Trash2 size={13} />
                            </button>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Integration Help Banner */}
                <div 
                  onClick={() => setShowVercelGuide(true)}
                  className="bg-gradient-to-br from-[#1D1D1B] to-slate-800 rounded-2xl p-5 text-white shadow-sm hover:scale-[1.01] transition-transform cursor-pointer border-l-4 border-indigo-400"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CloudLightning size={16} className="text-indigo-300" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#E30613]">Despliegue Vercel</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <h4 className="text-xs font-bold mb-1.5">¿Vas a desplegar en Vercel?</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Hacé clic acá para ver las instrucciones y dejar todo preparado para autorizar tu dominio de Vercel en la base de datos hoy mismo.
                  </p>
                </div>
              </div>

              {/* Right Column: Visualizer panel */}
              <div className="lg:col-span-8">
                <AnimatePresence mode="wait">
                  {!result && !loading ? (
                    <motion.div 
                      key="empty-state"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white/40 border border-slate-200 rounded-3xl h-full min-h-[520px] flex flex-col items-center justify-center p-8 text-center"
                    >
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6 text-slate-300">
                        <FolderOpen size={30} />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mb-2">Panel de Operaciones de Clase</h3>
                      <p className="text-slate-500 max-w-sm text-xs leading-relaxed">
                        Sube una factura, remito o nota arriba para extraer información estructurada mediante Gemini, o elige un elemento del historial cargado en Firebase.
                      </p>
                    </motion.div>
                  ) : loading ? (
                    <motion.div 
                      key="loading-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-white rounded-3xl h-full min-h-[520px] flex flex-col items-center justify-center p-8 text-center shadow-sm border border-slate-200"
                    >
                      <div className="relative mb-6">
                        <div className="w-16 h-16 border-4 border-indigo-50 rounded-full"></div>
                        <Loader2 size={32} className="absolute inset-0 m-auto text-[#E30613] animate-spin" />
                      </div>
                      <h3 className="text-base font-bold text-slate-850 mb-1">Extrayendo texto y metadatos...</h3>
                      <p className="text-slate-500 text-xs animate-pulse">Gemini 3 Flash está mapeando campos y estructurando salidas.</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      key="result-state"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <DocumentResultView
                        result={result}
                        fileName={selectedFileForViewing?.fileName}
                        date={selectedFileForViewing?.date}
                        category={selectedFileForViewing?.category}
                        isSaved={selectedFileForViewing?.isSaved}
                        isSaving={savingToFirebase}
                        onSave={handleSaveToFirebase}
                        onDelete={selectedFileForViewing?.isSaved ? () => handleDeleteFromFirebase(selectedFileForViewing.id) : undefined}
                        canSave={!selectedFileForViewing?.isSaved}
                      />

                      {/* Technical accuracy report */}
                      <div className="bg-[#1D1D1B] rounded-2xl p-6 shadow-md text-white border-l-4 border-[#E30613]">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-[#E30613]/20 rounded-lg">
                            <FileSearch size={18} className="text-[#E30613]" />
                          </div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-[#E30613]">Análisis de Ingeniería AI</h3>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                          Procesamiento de precisión Crucianelli. Se han extraído tablas y metadatos con alta fiabilidad estructural listos para la sincronización clase Firestore.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Confianza</div>
                            <div className="text-xs font-bold font-mono text-[#E30613]">RELIABLE SYSTEM</div>
                          </div>
                          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Database Sync</div>
                            <div className="text-xs font-bold font-mono uppercase">
                              {selectedFileForViewing?.isSaved ? "PERSISTIDO" : "PENDIENTE GUARDADO"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vercel instructions Modal overlay */}
      <AnimatePresence>
        {showVercelGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
            <VercelGuide 
              onClose={() => setShowVercelGuide(false)} 
              projectId={db.app.options.projectId || "integral-grail-pwh20"}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="w-full bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-[0.12em] gap-4">
          <div className="flex gap-6">
            <span>Crucianelli Scan v1.5</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Conexión Firebase: Activa ({db.app.options.projectId})
            </span>
          </div>
          <div>
            © 2026 • Tecnología de Precisión para el Agro & Clases Estudiantiles
          </div>
        </div>
      </footer>

      {/* CSS for custom scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(227, 6, 19, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(227, 6, 19, 0.4);
        }
      `}</style>
    </div>
  );
}
