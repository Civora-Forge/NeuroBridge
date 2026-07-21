/**
 * Dyscalculia Dashboard
 * 
 * Main hub for dyscalculia-friendly tools with clean, organized interface
 */

import React, { useState } from 'react';
import {
  CircleDot,
  Footprints,
  ShoppingCart,
  HeartPulse,
  Shapes,
  Play,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TABS = [
  { key: 'tools', label: 'Number Tools' },
  { key: 'practice', label: 'Practice Sessions' },
  { key: 'progress', label: 'Progress' },
];

const tools = [
  {
    to: '/dyscalculia/number-sense',
    icon: CircleDot,
    title: 'Number Sense Engine',
    description: 'Convert abstract numbers into visual magnitude representations',
    targetText: 'Recommended · 15 min',
  },
  {
    to: '/dyscalculia/step-practice',
    icon: Footprints,
    title: 'Guided Step Practice',
    description: 'Break calculations into micro-steps to reduce working memory load',
    targetText: 'Beginner · 20 min',
  },
  {
    to: '/dyscalculia/real-life-math',
    icon: ShoppingCart,
    title: 'Real-Life Math Simulator',
    description: 'Build practical numerical confidence with everyday scenarios',
    targetText: 'Practical · 25 min',
  },
  {
    to: '/dyscalculia/calm-mode',
    icon: HeartPulse,
    title: 'Calm Mode',
    description: 'Anxiety-aware system that adjusts presentation with supportive guidance',
    targetText: 'Support · 10 min',
  },
  {
    to: '/dyscalculia/patterns',
    icon: Shapes,
    title: 'Pattern Recognition Trainer',
    description: 'Build pattern detection skills with sequences and visual exercises',
    targetText: 'Intermediate · 15 min',
  },
];

export default function DyscalculiaDashboard() {
  const [activeTab, setActiveTab] = useState('tools');
  const [expandedSection, setExpandedSection] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          {/* Tab Navigation */}
          <div className="flex gap-1 py-4">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === key
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 md:px-8 py-8">
        {activeTab === 'tools' && (
          <div className="space-y-6">
            {/* Main Tools Section */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <div className="p-6">
                {/* Section Header */}
                <button
                  onClick={() => setExpandedSection(!expandedSection)}
                  className="flex items-center justify-between w-full mb-4"
                >
                  <div className="flex items-center gap-3">
                    {expandedSection ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                    <h2 className="text-lg font-semibold text-slate-900">
                      Number Learning Tools
                    </h2>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                      Visual Math
                    </Badge>
                  </div>
                  <span className="text-sm text-slate-500">
                    0/{tools.length} completed
                  </span>
                </button>

                {/* Tools List */}
                {expandedSection && (
                  <div className="space-y-3">
                    {tools.map((tool, index) => (
                      <div
                        key={tool.to}
                        className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          {/* Icon */}
                          <div className="flex-shrink-0 mt-1">
                            <tool.icon className="h-5 w-5 text-slate-400" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-slate-900 mb-1">
                              {tool.title}
                            </h3>
                            <p className="text-sm text-slate-500 mb-2">
                              {tool.targetText}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Link to={tool.to}>
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-6"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        </Link>
                      </div>
                    ))}

                    {/* Add Tool Link */}
                    <button className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mt-4">
                      + Add custom practice
                    </button>
                  </div>
                )}
              </div>
            </Card>

            {/* New Section Button */}
            <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors text-sm font-medium">
              + New practice category
            </button>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This tool supports number sense development between sessions. It does not replace professional support. If you are experiencing significant math anxiety or learning difficulties, contact your educator or therapist.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'practice' && (
          <Card className="bg-white border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-slate-500">Practice sessions coming soon...</p>
          </Card>
        )}

        {activeTab === 'progress' && (
          <Card className="bg-white border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-slate-500">Progress tracking coming soon...</p>
          </Card>
        )}
      </div>
    </div>
  );
}
