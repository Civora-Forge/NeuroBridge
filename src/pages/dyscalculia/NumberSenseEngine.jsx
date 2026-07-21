/**
 * Number Sense Engine
 * 
 * Convert abstract numbers into visual magnitude representations.
 * Displays dot clusters, block stacking, and number line animations.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  recordResponse,
  saveUserProfile,
  initializeUserProfile,
  shouldEnableVisualAids,
  getAdaptiveRecommendations,
  setPreferredRepresentation
} from '@/lib/dyscalculiaAdaptiveEngine';

// Sample math problems with progressive difficulty
const MATH_PROBLEMS = {
  beginner: [
    { problem: '2 + 1', answer: 3, num1: 2, num2: 1, operation: '+' },
    { problem: '3 + 2', answer: 5, num1: 3, num2: 2, operation: '+' },
    { problem: '4 + 1', answer: 5, num1: 4, num2: 1, operation: '+' },
    { problem: '5 + 3', answer: 8, num1: 5, num2: 3, operation: '+' },
  ],
  intermediate: [
    { problem: '8 + 5', answer: 13, num1: 8, num2: 5, operation: '+' },
    { problem: '12 + 7', answer: 19, num1: 12, num2: 7, operation: '+' },
    { problem: '15 - 4', answer: 11, num1: 15, num2: 4, operation: '-' },
    { problem: '10 - 3', answer: 7, num1: 10, num2: 3, operation: '-' },
  ],
  advanced: [
    { problem: '25 + 18', answer: 43, num1: 25, num2: 18, operation: '+' },
    { problem: '30 - 12', answer: 18, num1: 30, num2: 12, operation: '-' },
    { problem: '24 + 13', answer: 37, num1: 24, num2: 13, operation: '+' },
  ],
};

/**
 * Dot Cluster Visualization
 */
const DotVisualization = ({ num1, num2, operation }) => {
  const renderDots = (count, label) => (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center bg-blue-50 p-4 rounded-lg max-w-xs">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="w-5 h-5 bg-blue-500 rounded-full shadow-md hover:scale-110 transition-transform"
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-around items-start gap-4">
        {renderDots(num1, `${num1} dots`)}
        <div className="flex items-center mt-8 text-3xl font-bold text-blue-600">
          {operation}
        </div>
        {renderDots(num2, `${num2} dots`)}
      </div>
      <div className="text-center bg-green-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700">Total:</p>
        <p className="text-4xl font-bold text-green-600">
          {operation === '+' ? num1 + num2 : Math.max(0, num1 - num2)}
        </p>
      </div>
    </div>
  );
};

/**
 * Block Stacking Visualization
 */
const BlockVisualization = ({ num1, num2, operation }) => {
  const result = operation === '+' ? num1 + num2 : Math.max(0, num1 - num2);

  const renderBlockStack = (count, label, color) => (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>
      <div className="flex flex-col-reverse gap-2 items-center">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`w-12 h-8 ${color} rounded-md shadow-md border-2 border-gray-300 transition-all hover:scale-105`}
            style={{
              animation: `slideUp 0.3s ease-out ${i * 50}ms both`
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="flex justify-around items-end gap-4">
        {renderBlockStack(num1, `${num1} blocks`, 'bg-blue-400')}
        <div className="flex items-center mb-8 text-3xl font-bold text-blue-600">
          {operation}
        </div>
        {renderBlockStack(num2, `${num2} blocks`, 'bg-purple-400')}
      </div>

      <div className="text-center bg-green-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700">Combined height:</p>
        <p className="text-4xl font-bold text-green-600">{result}</p>
      </div>
    </div>
  );
};

/**
 * Number Line Visualization
 */
const NumberLineVisualization = ({ num1, num2, operation }) => {
  const maxNum = operation === '+' ? num1 + num2 : num1;
  const jumpDistance = operation === '+' ? num2 : -num2;

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-6">Step by step:</p>
        
        {/* Number line */}
        <div className="mb-8">
          <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
            <span>0</span>
            <span>{maxNum + 5}</span>
          </div>
          
          <div className="relative h-12 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center">
            {/* Tick marks */}
            {Array.from({ length: maxNum + 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-6 w-0.5 bg-gray-400"
                style={{ left: `${(i / (maxNum + 5)) * 100}%` }}
              />
            ))}

            {/* Starting position marker */}
            <div
              className="absolute w-8 h-8 bg-blue-500 rounded-full shadow-lg border-2 border-blue-700 flex items-center justify-center text-white font-bold z-20"
              style={{ left: `${(num1 / (maxNum + 5)) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {num1}
            </div>

            {/* Jump arrow and distance */}
            <div
              className="absolute h-1 bg-green-500 transition-all"
              style={{
                left: `${(num1 / (maxNum + 5)) * 100}%`,
                width: `${(Math.abs(jumpDistance) / (maxNum + 5)) * 100}%`,
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            />

            {/* Ending position marker */}
            <div
              className="absolute w-8 h-8 bg-green-500 rounded-full shadow-lg border-2 border-green-700 flex items-center justify-center text-white font-bold z-20"
              style={{
                left: `${(operation === '+' ? num1 + num2 : Math.max(0, num1 - num2)) / (maxNum + 5) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              {operation === '+' ? num1 + num2 : Math.max(0, num1 - num2)}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <p className="text-sm text-gray-700 mb-2">
            Start at <strong>{num1}</strong>, {operation === '+' ? 'jump forward' : 'jump backward'} <strong>{Math.abs(num2)}</strong> spaces
          </p>
          <p className="text-2xl font-bold text-green-600">
            = {operation === '+' ? num1 + num2 : Math.max(0, num1 - num2)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Main Component
 */
export default function NumberSenseEngine() {
  const [userProfile, setUserProfile] = useState(null);
  const [difficulty, setDifficulty] = useState('beginner');
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [representation, setRepresentation] = useState('dots');
  const [showSymbolic, setShowSymbolic] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const [problemCount, setProblemCount] = useState(0);

  useEffect(() => {
    const profile = initializeUserProfile();
    setUserProfile(profile);
    setRepresentation(profile.preferred_representation);
    
    // Pick random problem
    const problems = MATH_PROBLEMS[difficulty];
    setCurrentProblem(problems[Math.floor(Math.random() * problems.length)]);
    setStartTime(Date.now());
  }, [difficulty]);

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === currentProblem.answer;
    const responseTimeMs = Date.now() - startTime;

    // Update profile
    let updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      responseTimeMs,
      currentProblem.problem
    );
    updatedProfile = setPreferredRepresentation(updatedProfile, representation);
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    // Update local counters
    setProblemCount(problemCount + 1);
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }

    // Show feedback
    if (isCorrect) {
      setFeedback('✅ Correct! Great work!');
    } else {
      setFeedback(`❌ Not quite. The answer is ${currentProblem.answer}`);
    }

    // Move to next problem after delay
    setTimeout(() => {
      const problems = MATH_PROBLEMS[difficulty];
      setCurrentProblem(problems[Math.floor(Math.random() * problems.length)]);
      setUserAnswer('');
      setFeedback('');
      setStartTime(Date.now());
    }, 2000);
  };

  if (!userProfile || !currentProblem) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const recommendations = getAdaptiveRecommendations(userProfile);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center gap-6">
            <button type="button" className="rounded-full bg-teal-600 px-6 py-2 text-sm font-medium text-white shadow-sm">
              Number Tools
            </button>
            <span className="text-sm font-medium text-slate-600">Practice Sessions</span>
            <span className="text-sm font-medium text-slate-600">Progress</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/dyscalculia" className="inline-flex items-center text-slate-600 hover:text-slate-900 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Number Tools
          </Link>
          <p className="text-sm text-slate-500">{correctCount}/{problemCount} correct</p>
        </div>

        <Card className="bg-white border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">Number Sense Engine</h1>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                Visual Math
              </Badge>
            </div>
            <span className="text-sm text-slate-500">
              {problemCount > 0 ? `${Math.round((correctCount / problemCount) * 100)}% accuracy` : 'No attempts yet'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 mb-6">
            <div className="text-center mb-6">
              {showSymbolic && (
                <div className="text-5xl font-bold text-slate-900 mb-3">
                  {currentProblem.problem}
                </div>
              )}
              <p className="text-slate-600">What is the answer?</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              {representation === 'dots' && (
                <DotVisualization num1={currentProblem.num1} num2={currentProblem.num2} operation={currentProblem.operation} />
              )}
              {representation === 'blocks' && (
                <BlockVisualization num1={currentProblem.num1} num2={currentProblem.num2} operation={currentProblem.operation} />
              )}
              {representation === 'number_line' && (
                <NumberLineVisualization num1={currentProblem.num1} num2={currentProblem.num2} operation={currentProblem.operation} />
              )}
            </div>

            <div className="flex gap-2 justify-center mb-6 flex-wrap">
              <Button
                onClick={() => setRepresentation('dots')}
                className={representation === 'dots' ? 'bg-teal-600 hover:bg-teal-700 rounded-full px-5' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-full px-5'}
              >
                🔵 Dots
              </Button>
              <Button
                onClick={() => setRepresentation('blocks')}
                className={representation === 'blocks' ? 'bg-teal-600 hover:bg-teal-700 rounded-full px-5' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-full px-5'}
              >
                ⬜ Blocks
              </Button>
              <Button
                onClick={() => setRepresentation('number_line')}
                className={representation === 'number_line' ? 'bg-teal-600 hover:bg-teal-700 rounded-full px-5' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-full px-5'}
              >
                📏 Number Line
              </Button>
            </div>

            <div className="flex gap-3 mb-4 flex-col sm:flex-row">
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Enter your answer"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 text-xl"
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-8"
              >
                Check Answer
              </Button>
            </div>

            {feedback && (
              <div className={`text-center text-lg font-bold p-4 rounded-lg ${
                feedback.includes('✅')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {feedback}
              </div>
            )}
          </div>
        </Card>

        <Card className="bg-white border border-slate-200 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Difficulty</p>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <p className="text-sm text-slate-600 mb-2">Visual Aids</p>
              <button
                onClick={() => setShowSymbolic(!showSymbolic)}
                className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200 inline-flex items-center justify-center gap-2"
              >
                {showSymbolic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showSymbolic ? 'Shown' : 'Hidden'}
              </button>
            </div>

            <div>
              <p className="text-sm text-slate-600 mb-2">Accuracy</p>
              <div className="text-lg font-bold text-teal-700">
                {problemCount > 0 ? `${Math.round((correctCount / problemCount) * 100)}%` : '-'}
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-600 mb-2">Avg Time</p>
              <div className="text-lg font-bold text-slate-700">
                {userProfile.hesitation_time > 0 ? `${Math.round(userProfile.hesitation_time / 1000)}s` : '-'}
              </div>
            </div>
          </div>
        </Card>

        {recommendations.visual_aids_enabled && (
          <Card className="p-5 bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm">
              <strong>Tip:</strong> Visual representations help build number sense. Try dots, blocks, and number line views to find what works best.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
