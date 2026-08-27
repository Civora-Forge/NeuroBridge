import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Plus, Trash2, Play, Award, GripVertical, ChevronDown, ChevronRight, Activity, Clock, X } from 'lucide-react';
import { getHierarchies, createHierarchy } from '@/api/ocdApi';
import { getSessions, OCD_SUBTYPES } from '@/support/specialized/ocdStore';

const getDifficultyMeta = (suds) => {
  if (suds < 40) return { label: 'Low', border: 'border-emerald-200/60', strip: 'bg-emerald-400', badge: 'bg-emerald-100/80 text-emerald-700', slider: '#10b981' };
  if (suds < 70) return { label: 'Medium', border: 'border-amber-200/60', strip: 'bg-amber-400', badge: 'bg-amber-100/80 text-amber-700', slider: '#f59e0b' };
  return { label: 'High', border: 'border-rose-200/60', strip: 'bg-rose-400', badge: 'bg-rose-100/80 text-rose-700', slider: '#f43f5e' };
};

function SortableItem({ item, hId, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = getDifficultyMeta(item.estimated_suds);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-white border ${meta.border} rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all duration-300 group ${item.is_completed ? 'opacity-70 bg-slate-50/50' : 'hover:shadow-md hover:-translate-y-0.5'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.strip} rounded-l-2xl`} />
      
      <button
        {...attributes}
        {...listeners}
        className="ml-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-teal-500 transition-colors flex-shrink-0 touch-none p-1 rounded-md hover:bg-teal-50"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.badge}`}>
            <Activity className="w-3 h-3" />
            {meta.label} · SUDS {item.estimated_suds}
          </span>
          {item.is_completed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-700">
              <Award className="w-3 h-3" /> Mastered
            </span>
          )}
        </div>
        <p className={`font-medium text-[15px] leading-snug ${item.is_completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
          {item.description}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {!item.is_completed && (
          <Link
            to={`/ocd/exposure-tracker?hierarchyId=${hId}&taskId=${item.id}`}
            className="group/btn relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
            <Play className="w-4 h-4 relative z-10" fill="currentColor" />
            <span className="hidden sm:inline relative z-10">Start ERP <span className="font-normal opacity-70 ml-1">→</span></span>
          </Link>
        )}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => onRemove(item.id)}
          className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          aria-label="Remove step"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}

function AddStepForm({ onSave, onCancel }) {
  const [desc, setDesc] = useState('');
  const [suds, setSuds] = useState(50);
  const [duration, setDuration] = useState(15);
  const meta = getDifficultyMeta(suds);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    onSave({ description: desc, estimated_suds: suds, duration_minutes: duration });
    setDesc('');
    setSuds(50);
    setDuration(15);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="bg-white border border-teal-100 shadow-sm rounded-2xl p-5 mt-4 space-y-5">
        <div className="flex items-center gap-2 text-teal-600">
          <Plus className="w-4 h-4" />
          <h4 className="text-sm font-bold uppercase tracking-wider">New Exposure Step</h4>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="Describe what you will do during this exposure…"
            className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:bg-white transition-all resize-none border"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Distress Level (SUDS)</label>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${meta.badge}`}>
                {meta.label} · {suds}
              </span>
            </div>
            <div className="relative pt-2 pb-1">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 mb-1" />
              <input
                type="range"
                min={0}
                max={100}
                value={suds}
                onChange={(e) => setSuds(Number(e.target.value))}
                className="w-full h-2.5 appearance-none bg-transparent rounded-full cursor-pointer absolute top-2"
                style={{ accentColor: meta.slider }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-1.5 px-1">
              <span>0 (None)</span>
              <span>50 (Moderate)</span>
              <span>100 (Extreme)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> Target Duration</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24 rounded-xl border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:bg-white transition-all border text-center"
              />
              <span className="text-sm font-medium text-slate-500">minutes</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!desc.trim()}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Add Step
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function HierarchyCard({ h, isExpanded, onToggle, sensors, onDragEnd, onRemoveItem, onAddItem }) {
  const [showAddStep, setShowAddStep] = useState(false);
  const items = h.items ?? [];
  const mastered = items.filter((i) => i.is_completed).length;
  const progress = items.length > 0 ? (mastered / items.length) * 100 : 0;

  const handleSaveStep = (stepData) => {
    onAddItem(h.id, stepData);
    setShowAddStep(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-[24px] shadow-sm overflow-hidden mb-6 border border-slate-200/60 hover:shadow-md transition-all duration-300"
    >
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-teal-400 to-emerald-400" />
      
      <button
        onClick={onToggle}
        className="w-full text-left pl-7 pr-6 py-5 hover:bg-slate-50/50 transition-colors select-none group"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 className="font-black text-slate-800 text-lg leading-snug group-hover:text-teal-700 transition-colors">{h.title}</h3>
              {h.category && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100/50">
                  {h.category}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-sm">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400"
                />
              </div>
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                {mastered} / {items.length} Mastered
              </span>
            </div>
          </div>
          
          <div className={`flex-shrink-0 p-2 rounded-full transition-colors ${isExpanded ? 'bg-teal-50 text-teal-600' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
          >
            <div className="pl-8 pr-6 py-6 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500">No exposure steps yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Start by adding a manageable challenge below.</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => onDragEnd(e, h.id)}
                >
                  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          hId={h.id}
                          onRemove={(itemId) => onRemoveItem(h.id, itemId)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              <AnimatePresence mode="wait">
                {showAddStep ? (
                  <AddStepForm
                    key="add-step-form"
                    onSave={handleSaveStep}
                    onCancel={() => setShowAddStep(false)}
                  />
                ) : (
                  <motion.button
                    key="add-step-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAddStep(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-bold text-teal-600 bg-white border-2 border-dashed border-teal-200 hover:border-teal-400 hover:bg-teal-50 rounded-2xl py-4 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Exposure Step
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="relative bg-white rounded-[24px] shadow-sm border border-slate-100 mb-6 overflow-hidden animate-pulse">
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-slate-200 rounded-l-[24px]" />
      <div className="pl-8 pr-6 py-5">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex gap-2">
              <div className="h-6 bg-slate-200 rounded-full w-48" />
              <div className="h-6 bg-slate-100 rounded-full w-24" />
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="h-2 bg-slate-100 rounded-full w-full max-w-sm" />
              <div className="h-3 bg-slate-200 rounded-full w-20" />
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-full ml-4" />
        </div>
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hierarchies'] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const handleRemoveItem = (hId, itemId) => {
    // Placeholder — connect to deleteHierarchyItem mutation when available
  };

  const handleAddItem = (hId, stepData) => {
    // Placeholder — connect to addHierarchyItem mutation when available
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 pb-24">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/ocd"
            className="p-2.5 bg-white rounded-full shadow-sm hover:shadow hover:bg-teal-50 text-teal-600 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent leading-tight tracking-tight">
              Exposure Hierarchy Builder
            </h1>
            <p className="text-sm md:text-base font-medium text-slate-500 mt-1">
              Build your fear ladder — from manageable steps to bigger challenges
            </p>
          </div>
        </div>

        {/* Staircase Visual Indicator */}
        <div className="flex items-end gap-3 mb-10 bg-white/60 backdrop-blur-md rounded-[24px] px-6 py-5 border border-white shadow-sm">
          <div className="flex items-end gap-1.5">
            {[
              { label: 'Easy', color: 'bg-emerald-400', h: 'h-8' },
              { label: 'Medium', color: 'bg-amber-400', h: 'h-14' },
              { label: 'Hard', color: 'bg-rose-400', h: 'h-20' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5 group">
                <div className={`w-14 md:w-16 ${s.h} ${s.color} rounded-t-xl opacity-90 shadow-sm transition-transform group-hover:-translate-y-1`} />
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="ml-6 border-l-2 border-slate-200/60 pl-6 py-2">
            <p className="text-sm text-slate-600 leading-relaxed">
              Each step pushes you slightly further.<br />
              <span className="font-black text-slate-800">That's the plan. Keep climbing.</span>
            </p>
          </div>
        </div>

        {/* Builder Content */}
        <div className="mb-8">
          <AnimatePresence mode="wait">
            {!showNewHierarchy ? (
              <motion.button
                key="new-hierarchy-btn"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onClick={() => setShowNewHierarchy(true)}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl px-6 py-3.5 font-bold flex items-center gap-2.5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-5 h-5" />
                Build New Hierarchy
              </motion.button>
            ) : (
              <motion.div
                key="new-hierarchy-form"
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="bg-white border-2 border-teal-200/60 rounded-[24px] p-7 shadow-lg shadow-teal-100/50">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-black text-slate-800">Create New Hierarchy</h3>
                    <button
                      onClick={() => setShowNewHierarchy(false)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <form onSubmit={handleCreate} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">What is the core fear or theme?</label>
                      <input
                        type="text"
                        value={newHTitle}
                        onChange={(e) => setNewHTitle(e.target.value)}
                        placeholder="E.g., Contamination fears, Social situations…"
                        className="w-full rounded-xl border border-slate-200 px-5 py-3.5 text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-slate-50 focus:bg-white transition-all shadow-sm"
                        autoFocus
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                      <div className="relative">
                        <select
                          value={newHCategory}
                          onChange={(e) => setNewHCategory(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-5 py-3.5 text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-slate-50 focus:bg-white transition-all shadow-sm appearance-none"
                        >
                          {OCD_SUBTYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                      <button
                        type="button"
                        onClick={() => setShowNewHierarchy(false)}
                        className="text-[15px] text-slate-500 hover:text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newHTitle.trim() || createMutation.isPending}
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl px-6 py-2.5 text-[15px] font-bold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                      >
                        {createMutation.isPending ? 'Creating…' : 'Create Hierarchy'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lists Section */}
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : hierarchies.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-[32px] border-2 border-dashed border-teal-200/60 py-20 flex flex-col items-center gap-5 text-center px-6 shadow-sm"
          >
            <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <span className="text-5xl select-none transform hover:scale-110 transition-transform duration-300" role="img" aria-label="Ladder">🪜</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">No ladders yet</h3>
              <p className="text-slate-500 text-[15px] font-medium max-w-sm mx-auto leading-relaxed">
                Create your first fear hierarchy and start building a structured path through your exposures — one step at a time.
              </p>
            </div>
            <button
              onClick={() => setShowNewHierarchy(true)}
              className="mt-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl px-8 py-4 font-bold shadow hover:shadow-lg transition-all hover:-translate-y-1 flex items-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              Build Your First Ladder
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {hierarchies.map((h) => (
              <HierarchyCard
                key={h.id}
                h={h}
                isExpanded={expandedIds.has(h.id)}
                onToggle={() => toggleExpand(h.id)}
                sensors={sensors}
                onDragEnd={handleDragEnd}
                onRemoveItem={handleRemoveItem}
                onAddItem={handleAddItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
