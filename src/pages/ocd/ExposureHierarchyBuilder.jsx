import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, Plus, Trash2, Activity, Clock, Play, Award, X, ArrowLeft, Info, ListPlus, GripVertical } from 'lucide-react';
import { getHierarchies, createHierarchy } from '@/api/ocdApi';
import { getSessions, OCD_SUBTYPES } from '@/support/specialized/ocdStore'; // Kept for backward compatibility of other features for now

const TEMPLATES = {
  Contamination: [
    { title: 'Touching a public doorknob and waiting 5 mins to wash', suds: 40, duration: 5 },
    { title: 'Touching a public trash can and eating a snack', suds: 75, duration: 15 },
  ],
  Checking: [
    { title: 'Leaving home without checking the stove', suds: 60, duration: 30 },
    { title: 'Sending an email without rereading it', suds: 45, duration: 5 },
  ],
};

const getSudsColor = (suds) => {
  if (suds < 40) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
  if (suds < 70) return 'text-amber-700 bg-amber-100 border-amber-200';
  return 'text-rose-700 bg-rose-100 border-rose-200';
};

function SortableItem({ item, hId, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`relative bg-white border rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-all ${item.is_completed ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-teal-300'}`}>
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-teal-600">
        <GripVertical size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between md:block">
          <h4 className={`font-semibold text-base mb-1 ${item.is_completed ? 'text-slate-600' : 'text-slate-800'}`}>{item.description}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border ${getSudsColor(item.estimated_suds)}`}>
            <Activity className="w-3 h-3" /> SUDS {item.estimated_suds}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-100 md:border-t-0">
        {item.is_completed ? (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex-1 md:flex-none justify-center">
            <Award className="w-4 h-4" /> <span className="text-sm font-bold">Mastered</span>
          </div>
        ) : (
          <Link to={`/ocd/exposure-tracker?hierarchyId=${hId}&taskId=${item.id}`} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <Play className="w-4 h-4" fill="currentColor" /> Start ERP
          </Link>
        )}
        <button onClick={() => onRemove(item.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export default function ExposureHierarchyBuilder() {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [showNewHierarchy, setShowNewHierarchy] = useState(false);
  const [newHTitle, setNewHTitle] = useState('');
  const [newHCategory, setNewHCategory] = useState(OCD_SUBTYPES?.[0] || 'Contamination');

  const { data: hierarchies = [], isLoading } = useQuery({ queryKey: ['hierarchies'], queryFn: getHierarchies });
  
  const createMutation = useMutation({
    mutationFn: createHierarchy,
    onSuccess: () => queryClient.invalidateQueries(['hierarchies']),
  });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event, hId) => {
    // Basic implementation for drag-and-drop state update. Should ideally persist to backend.
  };

  const toggleExpand = (id) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newHTitle.trim()) return;
    createMutation.mutate({ title: newHTitle, category: newHCategory });
    setNewHTitle('');
    setShowNewHierarchy(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/ocd" className="inline-flex items-center text-teal-700 hover:text-teal-800 font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to OCD Center
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Smart Exposure Hierarchy</h1>
          <p className="text-slate-600 mb-6 text-lg">AI-powered fear ladder generation and tracking.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-teal-600 font-medium">Loading hierarchies...</div>
        ) : (
          <div className="space-y-4 mb-8">
            {hierarchies.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <ListPlus className="w-8 h-8 text-teal-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No hierarchies yet</h3>
                <p className="text-slate-500 mb-4">Create your first hierarchy to let AI generate exposure steps.</p>
              </div>
            ) : (
              hierarchies.map((h) => (
                <div key={h.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors select-none flex items-center justify-between" onClick={() => toggleExpand(h.id)}>
                    <div><h3 className="text-lg font-bold text-slate-800">{h.title}</h3><span className="text-sm text-slate-500">{h.category}</span></div>
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      {expandedIds.has(h.id) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedIds.has(h.id) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100">
                        <div className="p-4 bg-slate-50/50">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, h.id)}>
                            <SortableContext items={h.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-3">
                                {h.tasks.map((task) => (
                                  <SortableItem key={task.id} item={task} hId={h.id} onRemove={() => {}} />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-8">
          {showNewHierarchy ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-xl border border-teal-200 shadow-lg">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Create Smart Hierarchy</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hierarchy Title</label>
                  <input type="text" value={newHTitle} onChange={(e) => setNewHTitle(e.target.value)} placeholder="e.g. Social Settings..." className="w-full rounded-lg border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 px-4 py-2 border" autoFocus required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Theme (AI will generate tasks based on this)</label>
                  <select value={newHCategory} onChange={(e) => setNewHCategory(e.target.value)} className="w-full rounded-lg border-slate-300 shadow-sm px-4 py-2 border bg-white">
                    {OCD_SUBTYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowNewHierarchy(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                  <button type="submit" disabled={!newHTitle.trim() || createMutation.isPending} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold">{createMutation.isPending ? 'Generating...' : 'Generate AI Hierarchy'}</button>
                </div>
              </form>
            </motion.div>
          ) : (
            <button onClick={() => setShowNewHierarchy(true)} className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 shadow-sm">
              + New AI Hierarchy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
