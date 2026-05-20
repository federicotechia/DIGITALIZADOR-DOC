import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Code, 
  Table, 
  Copy, 
  Check, 
  Database, 
  Loader2, 
  Calendar, 
  Tag, 
  Trash2,
  FileCheck
} from 'lucide-react';

interface DocumentResultViewProps {
  result: {
    plainText: string;
    json: string;
    csv: string;
  };
  fileName?: string;
  date?: string;
  category?: string;
  isSaved?: boolean;
  isSaving?: boolean;
  onSave?: (category: string) => void;
  onDelete?: () => void;
  canSave?: boolean;
}

export default function DocumentResultView({
  result,
  fileName,
  date,
  category: initialCategory = 'otros',
  isSaved = false,
  isSaving = false,
  onSave,
  onDelete,
  canSave = false
}: DocumentResultViewProps) {
  const [activeTab, setActiveTab] = useState<'plainText' | 'json' | 'csv'>('plainText');
  const [layoutMode, setLayoutMode] = useState<'tabs' | 'grid'>('tabs');
  const [collapsed, setCollapsed] = useState({ plainText: false, json: false, csv: false });
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  const categories = [
    { value: 'facturas', label: 'Facturas' },
    { value: 'remitos', label: 'Remitos' },
    { value: 'presupuestos', label: 'Presupuestos' },
    { value: 'notas', label: 'Notas' },
    { value: 'informes', label: 'Informes' },
    { value: 'otros', label: 'Otros' }
  ];

  const toggleCollapse = (key: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveClick = () => {
    if (onSave) {
      onSave(selectedCategory);
    }
  };

  // Helper safe parser for showing beautiful JSON
  let formattedJson = '';
  try {
    formattedJson = JSON.stringify(JSON.parse(result.json), null, 2);
  } catch (e) {
    formattedJson = result.json || '{}';
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          {fileName && (
            <h3 className="text-base font-bold text-slate-800 truncate max-w-lg flex items-center gap-2">
              <FileCheck size={18} className="text-[#E30613]" /> {fileName}
            </h3>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {date && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {date}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Tag size={12} /> Categoría:{' '}
              <span className="text-[#E30613]">{categories.find(c => c.value === (isSaved ? initialCategory : selectedCategory))?.label || 'Otros'}</span>
            </span>
          </div>
        </div>

        {/* Database Sync Actions */}
        <div className="flex items-center gap-3">
          {!isSaved && canSave ? (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:ring-0 focus:outline-none pr-8 py-1 uppercase tracking-wider"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="bg-[#E30613] hover:bg-[#c10510] text-white px-4 py-2 rounded-lg font-bold text-2xs uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Database size={12} />
                )}
                Guardar en Firebase
              </button>
            </div>
          ) : isSaved ? (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase border border-emerald-200 rounded-lg flex items-center gap-1">
                <Check size={12} /> Guardado en Firebase
              </div>
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 transition-all"
                  title="Eliminar de Firestore"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Visualizer Selector */}
      <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setLayoutMode('tabs')}
            className={`px-6 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${layoutMode === 'tabs' ? 'bg-white shadow-sm text-[#E30613]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Individual
          </button>
          <button 
            onClick={() => setLayoutMode('grid')}
            className={`px-6 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${layoutMode === 'grid' ? 'bg-white shadow-sm text-[#E30613]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Triple
          </button>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase px-4 hidden sm:block">
          Diseño de Precisión • Crucianelli AI
        </div>
      </div>

      {layoutMode === 'tabs' ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col min-h-[500px]"
        >
          {/* Tabs */}
          <div className="flex bg-slate-50 border-b border-slate-200">
            <button 
              onClick={() => setActiveTab('plainText')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'plainText' ? 'bg-white text-[#E30613] border-[#E30613]' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100/50'}`}
            >
              <FileText size={14} /> TEXTO PLANO
            </button>
            <button 
              onClick={() => setActiveTab('json')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'json' ? 'bg-white text-[#E30613] border-[#E30613]' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100/50'}`}
            >
              <Code size={14} /> JSON
            </button>
            <button 
              onClick={() => setActiveTab('csv')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'csv' ? 'bg-white text-[#E30613] border-[#E30613]' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100/50'}`}
            >
              <Table size={14} /> CSV/TSV
            </button>
          </div>

          {/* Tab Content */}
          <div className={`flex-1 relative group overflow-auto custom-scrollbar ${activeTab !== 'plainText' ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="absolute top-4 right-4 flex gap-2 z-10 sm:scale-95 group-hover:scale-100 transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100">
              <button 
                onClick={() => copyToClipboard(activeTab === 'json' ? formattedJson : result[activeTab], activeTab)}
                className={`p-2.5 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'plainText' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
              >
                {copied === activeTab ? (
                  <>
                    <Check size={14} className="text-emerald-400" /> COPIADO
                  </>
                ) : (
                  <>
                    <Copy size={14} /> COPIAR
                  </>
                )}
              </button>
            </div>

            <div className="p-8">
              {activeTab === 'plainText' ? (
                <pre className="font-sans whitespace-pre-wrap text-sm leading-relaxed text-slate-700 select-text">
                  {result.plainText}
                </pre>
              ) : activeTab === 'json' ? (
                <pre className="font-mono text-[13px] text-emerald-400 leading-relaxed overflow-x-auto select-text">
                  {formattedJson}
                </pre>
              ) : (
                <div className="overflow-x-auto">
                  <pre className="font-mono text-[13px] text-red-100 leading-relaxed inline-block min-w-full select-text">
                    {result.csv}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {[
            { key: 'plainText', label: 'Texto Plano', bg: 'bg-white', text: 'text-slate-700 font-sans', code: result.plainText, icon: <FileText size={18} /> },
            { key: 'json', label: 'Formato JSON', bg: 'bg-slate-900', text: 'text-emerald-400 font-mono', code: formattedJson, icon: <Code size={18} /> },
            { key: 'csv', label: 'Hoja CSV', bg: 'bg-slate-900', text: 'text-red-100 font-mono', code: result.csv, icon: <Table size={18} /> }
          ].map((item) => (
            <motion.div 
              key={item.key}
              layout
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 text-[#1D1D1B] font-bold text-[11px] uppercase tracking-widest">
                  <div className="text-[#E30613]">{item.icon}</div>
                  {item.label}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(item.code, item.key)}
                    className="text-[9px] font-bold text-[#E30613] hover:bg-slate-100 p-1.5 rounded transition-all border border-slate-200 flex items-center gap-1"
                  >
                    {copied === item.key ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                    {copied === item.key ? 'COPIADO' : 'COPIAR'}
                  </button>
                  <button 
                    onClick={() => toggleCollapse(item.key as keyof typeof collapsed)}
                    className="text-[9px] font-bold text-slate-400 hover:text-[#E30613] uppercase px-2.5 py-1.5 rounded hover:bg-red-50 transition-all border border-slate-100"
                  >
                    {collapsed[item.key as keyof typeof collapsed] ? 'Abrir' : 'Cerrar'}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {!collapsed[item.key as keyof typeof collapsed] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-6 ${item.key === 'plainText' ? 'bg-white' : 'bg-slate-900'}`}>
                      <pre className={`text-xs whitespace-pre-wrap max-h-[400px] overflow-auto custom-scrollbar select-text ${item.text}`}>
                        {item.code}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
