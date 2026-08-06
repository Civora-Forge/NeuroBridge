import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Activity, 
  Clock, 
  Play, 
  Award, 
  CheckCircle2, 
  X, 
  ArrowLeft,
  Info,
  ListPlus
} from 'lucide-react';
import { 
  getHierarchy, 
  saveHierarchy, 
  getSessions, 
  OCD_SUBTYPES 
} from '@/support/specialized/ocdStore';

const TEMPLATES = {
  Contamination: [
    { title: 'Touching a public doorknob and waiting 5 mins to wash', suds: 40, duration: 5 },
    { title: 'Touching a public trash can and eating a snack', suds: 75, duration: 15 },
  ],
  Checking: [
    { title: 'Leaving home without checking the stove', suds: 60, duration: 30 },
    { title: 'Sending an email without rereading it', suds: 45, duration: 5 },
  ],
  IntrusiveThoughts: [
    { title: 'Writing down the intrusive thought on paper', suds: 50, duration: 10 },
    { title: 'Reading a news article related to the thought topic', suds: 65, duration: 15 },
  ]
};

const getSudsColor = (suds) => {
  if (suds < 40) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
  if (suds < 70) return 'text-amber-700 bg-amber-100 border-amber-200';
  return 'text-rose-700 bg-rose-100 border-rose-200';
};

const getSudsFill = (suds) => {
  if (suds < 40) return 'bg-emerald-500';
  if (suds < 70) return 'bg-amber-500';
  return 'bg-rose-500';
};

export default function ExposureHierarchyBuilder() {
  const [hierarchies, setHierarchies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  
  // New Hierarchy Form
  const [showNewHierarchy, setShowNewHierarchy] = useState(false);
  const [newHTitle, setNewHTitle] = useState('');
  const [newHSubtype, setNewHSubtype] = useState(OCD_SUBTYPES?.[0] || 'Contamination');
  
  // New Item Form State (per hierarchy)
  const [addingToH, setAddingToH] = useState(null); // hierarchyId
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemSuds, setNewItemSuds] = useState(50);
  const [newItemDuration, setNewItemDuration] = useState(15);
  
  // Quick Add panel
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    const loadedH = getHierarchy() || [];
    setHierarchies(loadedH);
    setSessions(getSessions() || []);
  }, []);

  const saveAndSet = (updated) => {
    saveHierarchy(updated);
    setHierarchies(updated);
  };

  const toggleExpand = (id) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleCreateHierarchy = (e) => {
    e.preventDefault();
    if (!newHTitle.trim()) return;
    
    const newH = {
      id: Date.now().toString(),
      title: newHTitle.trim(),
      subtype: newHSubtype,
      items: [],
      createdAt: new Date().toISOString()
    };
    
    saveAndSet([...hierarchies, newH]);
    setNewHTitle('');
    setShowNewHierarchy(false);
    setExpandedIds(prev => new Set(prev).add(newH.id));
  };

  const handleAddItem = (hierarchyId) => {
    if (!newItemTitle.trim()) return;
    
    const updated = hierarchies.map(h => {
      if (h.id === hierarchyId) {
        const item = {
          id: Date.now().toString(),
          title: newItemTitle.trim(),
          suds: Number(newItemSuds),
          duration: Number(newItemDuration),
          mastered: false
        };
        // Sort items by SUDS ascending
        const nextItems = [...(h.items || []), item].sort((a, b) => a.suds - b.suds);
        return { ...h, items: nextItems };
      }
      return h;
    });
    
    saveAndSet(updated);
    setAddingToH(null);
    setNewItemTitle('');
    setNewItemSuds(50);
    setNewItemDuration(15);
  };
  
  const handleQuickAdd = (templateItem) => {
    if (hierarchies.length === 0) {
      alert("Please create a hierarchy first.");
      return;
    }
    setAddingToH(hierarchies[0].id);
    setNewItemTitle(templateItem.title);
    setNewItemSuds(templateItem.suds);
    setNewItemDuration(templateItem.duration);
    setExpandedIds(prev => new Set(prev).add(hierarchies[0].id));
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleDeleteHierarchy = (hierarchyId) => {
    if (!window.confirm("Are you sure you want to delete this hierarchy?")) return;
    saveAndSet(hierarchies.filter(h => h.id !== hierarchyId));
  };

  const handleDeleteItem = (hierarchyId, itemId) => {
    const updated = hierarchies.map(h => {
      if (h.id === hierarchyId) {
        return { ...h, items: h.items.filter(i => i.id !== itemId) };
      }
      return h;
    });
    saveAndSet(updated);
  };

  // Stats
  const stats = useMemo(() => {
    let totalItems = 0;
    let masteredCount = 0;
    hierarchies.forEach(h => {
      (h.items || []).forEach(i => {
        totalItems++;
        if (i.mastered) masteredCount++;
      });
    });
    return { totalH: hierarchies.length, totalItems, masteredCount };
  }, [hierarchies]);

  const getItemSessionCount = (hierarchyId, itemId) => {
    return sessions.filter(s => s.hierarchyId === hierarchyId && s.itemId === itemId).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Navigation */}
        <Link 
          to="/ocd" 
          className="inline-flex items-center text-teal-700 hover:text-teal-800 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to OCD Center
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Exposure Hierarchy Builder</h1>
          <p className="text-slate-600 mb-6 text-lg">
            Build your fear ladder — ordered from least to most anxiety-provoking.
          </p>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="neuro-card p-4 rounded-xl border border-teal-100 bg-white shadow-sm flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-teal-600">{stats.totalH}</span>
              <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider mt-1">Hierarchies</span>
            </div>
            <div className="neuro-card p-4 rounded-xl border border-teal-100 bg-white shadow-sm flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-teal-600">{stats.totalItems}</span>
              <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider mt-1">Total Steps</span>
            </div>
            <div className="neuro-card p-4 rounded-xl border border-emerald-100 bg-emerald-50 shadow-sm flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-emerald-600">{stats.masteredCount}</span>
              <span className="text-xs text-emerald-600 uppercase font-semibold tracking-wider mt-1">Mastered</span>
            </div>
          </div>
        </div>

        {/* Tips Panel */}
        <div className="bg-white rounded-xl border border-teal-200 p-5 mb-8 shadow-sm">
          <h3 className="font-semibold text-teal-800 flex items-center gap-2 mb-3">
            <Info className="w-5 h-5" />
            Tips for Building Your Hierarchy
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">•</span>
              <span>Start with <strong>SUDS 30-40</strong> (manageable anxiety). Don't start at the very top.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">•</span>
              <span>Aim for each step to be <strong>10-15 points higher</strong> than the last.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">•</span>
              <span><strong>Master an item</strong> (typically 3 sessions with post-SUDS &lt; 30) before moving up.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">•</span>
              <span className="italic text-slate-500">This tool supports ERP between therapy sessions — it does not replace clinical care.</span>
            </li>
          </ul>
        </div>

        {/* Quick Add Panel */}
        <div className="mb-8">
          <button 
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center gap-2 text-teal-700 font-medium hover:text-teal-800 transition-colors"
          >
            <ListPlus className="w-5 h-5" />
            {showQuickAdd ? 'Hide Starter Templates' : 'Show Starter Templates'}
          </button>
          
          <AnimatePresence>
            {showQuickAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {Object.entries(TEMPLATES).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                      <h4 className="font-semibold text-sm text-slate-800 mb-2">{category.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      <div className="space-y-2">
                        {items.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickAdd(item)}
                            className="w-full text-left text-xs bg-slate-50 hover:bg-teal-50 p-2 rounded border border-slate-100 hover:border-teal-200 transition-colors"
                          >
                            <div className="font-medium text-slate-700 truncate">{item.title}</div>
                            <div className="text-slate-500 mt-1 flex gap-2">
                              <span>SUDS: {item.suds}</span>
                              <span>•</span>
                              <span>{item.duration}m</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hierarchies List */}
        <div className="space-y-4 mb-8">
          {hierarchies.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ListPlus className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No hierarchies yet</h3>
              <p className="text-slate-500 mb-4">Add your first hierarchy below to start building your fear ladder.</p>
            </div>
          ) : (
            hierarchies.map((h) => {
              const items = h.items || [];
              const mastered = items.filter(i => i.mastered).length;
              const total = items.length;
              const progress = total === 0 ? 0 : (mastered / total) * 100;
              const isExpanded = expandedIds.has(h.id);

              return (
                <div key={h.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Hierarchy Card Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors select-none flex items-center justify-between"
                    onClick={() => toggleExpand(h.id)}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-slate-800 truncate">{h.title}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                          {h.subtype}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{mastered}/{total} mastered</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteHierarchy(h.id); }}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Hierarchy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-100">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100"
                      >
                        <div className="p-4 bg-slate-50/50">
                          {items.length === 0 ? (
                            <p className="text-center text-sm text-slate-500 py-4">No steps added yet.</p>
                          ) : (
                            <div className="space-y-3 mb-4">
                              {items.map((item, idx) => (
                                <div 
                                  key={item.id} 
                                  className={`relative bg-white border rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-all ${
                                    item.mastered ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-teal-300'
                                  }`}
                                >
                                  {/* Step Badge */}
                                  <div className="hidden md:flex flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 items-center justify-center font-bold text-sm">
                                    {idx + 1}
                                  </div>
                                  
                                  {/* Main Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between md:block">
                                      <h4 className={`font-semibold text-base mb-1 ${item.mastered ? 'text-slate-600' : 'text-slate-800'}`}>
                                        <span className="md:hidden mr-2 text-slate-400">{idx + 1}.</span>
                                        {item.title}
                                      </h4>
                                      <button 
                                        onClick={() => handleDeleteItem(h.id, item.id)}
                                        className="md:hidden p-1 text-slate-400 hover:text-rose-500"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border ${getSudsColor(item.suds)}`}>
                                        <Activity className="w-3 h-3" />
                                        SUDS {item.suds}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {item.duration} min
                                      </span>
                                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1 ml-2">
                                        {getItemSessionCount(h.id, item.id)} sessions
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-3 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-t-0">
                                    {item.mastered ? (
                                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex-1 md:flex-none justify-center">
                                        <Award className="w-4 h-4" />
                                        <span className="text-sm font-bold">Mastered</span>
                                      </div>
                                    ) : (
                                      <Link
                                        to={`/ocd/exposure-tracker?hierarchyId=${h.id}&itemId=${item.id}`}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                                      >
                                        <Play className="w-4 h-4" fill="currentColor" />
                                        Start ERP
                                      </Link>
                                    )}
                                    <button 
                                      onClick={() => handleDeleteItem(h.id, item.id)}
                                      className="hidden md:flex p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Delete Step"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Item Inline Form */}
                          {addingToH === h.id ? (
                            <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-teal-800">Add Exposure Step</h4>
                                <button 
                                  onClick={() => setAddingToH(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">Exposure Task</label>
                                  <input 
                                    type="text" 
                                    value={newItemTitle}
                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                    placeholder="e.g. Touching a public doorknob without washing hands"
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 px-3 py-2 border"
                                    autoFocus
                                  />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <div className="flex justify-between mb-1">
                                      <label className="block text-sm font-medium text-slate-700">Expected SUDS (0-100)</label>
                                      <span className={`text-sm font-bold ${getSudsColor(newItemSuds).split(' ')[0]}`}>
                                        {newItemSuds}
                                      </span>
                                    </div>
                                    <input 
                                      type="range" 
                                      min="0" max="100" step="5"
                                      value={newItemSuds}
                                      onChange={(e) => setNewItemSuds(e.target.value)}
                                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${getSudsFill(newItemSuds)} bg-opacity-20`}
                                      style={{ accentColor: newItemSuds < 40 ? '#10b981' : newItemSuds < 70 ? '#f59e0b' : '#f43f5e' }}
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                      <span>0 (Calm)</span>
                                      <span>100 (Panic)</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="flex justify-between mb-1">
                                      <label className="block text-sm font-medium text-slate-700">Duration (mins)</label>
                                      <span className="text-sm font-bold text-slate-700">{newItemDuration} m</span>
                                    </div>
                                    <input 
                                      type="range" 
                                      min="1" max="60" step="1"
                                      value={newItemDuration}
                                      onChange={(e) => setNewItemDuration(e.target.value)}
                                      className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer"
                                      style={{ accentColor: '#0d9488' }}
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                      <span>1m</span>
                                      <span>60m</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex justify-end gap-3 pt-2">
                                  <button
                                    onClick={() => setAddingToH(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddItem(h.id)}
                                    disabled={!newItemTitle.trim()}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Step
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingToH(h.id);
                                setNewItemTitle('');
                                setNewItemSuds(50);
                                setNewItemDuration(15);
                              }}
                              className="w-full py-3 border-2 border-dashed border-teal-200 rounded-xl text-teal-600 font-semibold hover:bg-teal-50 hover:border-teal-300 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-5 h-5" />
                              Add Exposure Step
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Hierarchy Button / Form */}
        <div className="mt-8">
          {showNewHierarchy ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-xl border border-teal-200 shadow-lg"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-4">Create New Hierarchy</h3>
              <form onSubmit={handleCreateHierarchy} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hierarchy Title</label>
                  <input 
                    type="text"
                    value={newHTitle}
                    onChange={(e) => setNewHTitle(e.target.value)}
                    placeholder="e.g. Social Settings, Contamination, Driving..."
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 px-4 py-2 border"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Theme</label>
                  <select 
                    value={newHSubtype}
                    onChange={(e) => setNewHSubtype(e.target.value)}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 px-4 py-2 border bg-white"
                  >
                    {(Array.isArray(OCD_SUBTYPES) ? OCD_SUBTYPES : [
                      'Contamination', 'Checking', 'Symmetry/Ordering', 
                      'Intrusive Thoughts', 'Harm', 'Scrupulosity', 'Other'
                    ]).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewHierarchy(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newHTitle.trim()}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    Create Hierarchy
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowNewHierarchy(true)}
              className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-6 h-6" />
              New Exposure Hierarchy
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
