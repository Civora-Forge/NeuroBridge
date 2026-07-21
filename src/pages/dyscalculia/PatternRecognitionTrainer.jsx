/**
 * Pattern Recognition Trainer
 * 
 * Build pattern detection skills through visual and numerical exercises
 * - Missing number in sequence
 * - Visual block growth patterns
 * - Shape-number matching
 * - Skip counting
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  recordResponse,
  saveUserProfile,
  initializeUserProfile,
  getAdaptiveRecommendations
} from '@/lib/dyscalculiaAdaptiveEngine';

/**
 * Missing Number Exercise
 */
const MissingNumberExercise = ({ userProfile, setUserProfile }) => {
  const sequences = [
    { numbers: [1, 2, 3, 4, null, 6, 7, 8], difficulty: 'beginner' },
    { numbers: [2, 4, 6, 8, null, 12, 14], difficulty: 'beginner' },
    { numbers: [5, 10, 15, 20, null, 30], difficulty: 'intermediate' },
    { numbers: [1, 1, 2, 3, 5, 8, null, 21], difficulty: 'advanced', label: 'Fibonacci' },
    { numbers: [3, 6, 9, 12, null, 18, 21], difficulty: 'intermediate' },
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);

  const sequence = sequences[currentIdx];
  const missingIdx = sequence.numbers.findIndex(n => n === null);
  const correctAnswer = sequence.difficulty === 'advanced' ? 13 : 
    sequence.numbers[missingIdx - 1] + (sequence.numbers[missingIdx + 1] - sequence.numbers[missingIdx - 1]) / 2;

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === correctAnswer;
    
    let updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Missing number: pattern with answer ${correctAnswer}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      setCorrect(correct + 1);
      setFeedback('✅ Perfect! You found the pattern!');
      setTimeout(() => {
        setUserAnswer('');
        setFeedback('');
        setCurrentIdx((currentIdx + 1) % sequences.length);
      }, 1500);
    } else {
      setFeedback(`❌ The answer is ${correctAnswer}. Look at the pattern again!`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <p className="text-slate-700 font-semibold">Find the missing number:</p>

      {/* Sequence Display */}
      <div className="bg-slate-100 p-6 rounded-lg border border-slate-200">
        <div className="flex gap-3 justify-center flex-wrap">
          {sequence.numbers.map((num, idx) => (
            <React.Fragment key={idx}>
              {num === null ? (
                <div className="w-12 h-12 bg-amber-400 rounded-lg flex items-center justify-center text-2xl font-bold text-amber-900 border-2 border-amber-500">
                  ?
                </div>
              ) : (
                <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center text-2xl font-bold text-white">
                  {num}
                </div>
              )}
              {idx < sequence.numbers.length - 1 && <div className="flex items-center">→</div>}
            </React.Fragment>
          ))}
        </div>

        {/* Pattern Hint */}
        <div className="mt-4 text-center text-sm text-slate-700">
          <p>What's the pattern? (+1? +2? ×2?)</p>
        </div>
      </div>

      {/* Answer Input */}
      <div className="flex gap-3">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Enter the missing number..."
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700"
          disabled={!userAnswer}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="text-sm text-slate-600">
        ✓ Correct: <strong>{correct}/{sequences.length}</strong>
      </div>
    </div>
  );
};

/**
 * Block Growth Pattern Exercise
 */
const BlockGrowthExercise = ({ userProfile, setUserProfile }) => {
  const patterns = [
    { stage: 1, blocks: 1 },
    { stage: 2, blocks: 3 },
    { stage: 3, blocks: 6 },
    { stage: 4, blocks: 10 },
    { stage: 5, blocks: null },
  ];

  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);

  const correctAnswer = 15; // Next triangular number

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === correctAnswer;
    
    let updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Block growth pattern: ${correctAnswer}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      setCorrect(correct + 1);
      setFeedback('✅ Great pattern recognition!');
      setTimeout(() => {
        setUserAnswer('');
        setFeedback('');
      }, 1500);
    } else {
      setFeedback(`❌ The pattern shows ${correctAnswer} blocks at stage 5`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <p className="text-slate-700 font-semibold">Watch how the blocks grow. What comes next?</p>

      {/* Visual Pattern */}
      <div className="space-y-4 bg-slate-100 p-6 rounded-lg border border-slate-200">
        {patterns.map((pattern) => (
          <div key={pattern.stage} className="flex items-center gap-4">
            <div className="w-16 font-semibold text-slate-900 text-sm">Stage {pattern.stage}</div>
            <div className="flex gap-1 flex-wrap">
              {pattern.blocks ? (
                Array.from({ length: pattern.blocks }).map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 bg-teal-600 rounded border border-teal-700 hover:scale-110 transition-transform"
                  />
                ))
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-teal-600">?</div>
                  <span className="text-sm text-slate-700">(How many?)</span>
                </div>
              )}
            </div>
            {pattern.blocks && (
              <div className="text-sm font-semibold text-slate-900 ml-auto">
                {pattern.blocks}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="bg-amber-50 p-4 rounded border-l-4 border-amber-500 text-sm text-amber-900">
        💡 <strong>Hint:</strong> Look at the differences between stages. Do they grow by the same amount each time?
      </div>

      {/* Answer Input */}
      <div className="flex gap-3">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="How many blocks at stage 5?"
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700"
          disabled={!userAnswer}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="text-sm text-slate-600">
        ✓ Problems solved: <strong>{correct}</strong>
      </div>
    </div>
  );
};

/**
 * Shape-Number Matching
 */
const ShapeNumberMatching = ({ userProfile, setUserProfile }) => {
  const shapes = [
    { id: 'triangle', sides: 3, name: 'Triangle' },
    { id: 'square', sides: 4, name: 'Square' },
    { id: 'pentagon', sides: 5, name: 'Pentagon' },
    { id: 'hexagon', sides: 6, name: 'Hexagon' },
  ];

  const generateProblem = () => {
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    return randomShape;
  };

  const [currentShape, setCurrentShape] = useState(generateProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === currentShape.sides;
    
    let updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      1500,
      `Shape-number: ${currentShape.name} has ${currentShape.sides} sides`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      setCorrect(correct + 1);
      setFeedback('✅ Correct!');
      setTimeout(() => {
        setUserAnswer('');
        setFeedback('');
        setCurrentShape(generateProblem());
      }, 1000);
    } else {
      setFeedback(`❌ A ${currentShape.name} has ${currentShape.sides} sides`);
    }
  };

  const renderShape = (shape) => {
    switch (shape.id) {
      case 'triangle':
        return (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <polygon points="50,10 90,90 10,90" fill="currentColor" />
          </svg>
        );
      case 'square':
        return (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <rect x="20" y="20" width="60" height="60" fill="currentColor" />
          </svg>
        );
      case 'pentagon':
        return (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <polygon points="50,10 90,39 73,90 27,90 10,39" fill="currentColor" />
          </svg>
        );
      case 'hexagon':
        return (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <polygon points="50,5 93,29 93,77 50,100 7,77 7,29" fill="currentColor" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <p className="text-slate-700 font-semibold">How many sides does this shape have?</p>

      {/* Shape Display */}
      <div className="flex justify-center">
        <div className="text-teal-600">
          {renderShape(currentShape)}
        </div>
      </div>

      <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-center">
        <p className="text-lg font-bold text-slate-900">
          {currentShape.name}
        </p>
        <p className="text-sm text-slate-600 mt-2">
          Count the straight edges
        </p>
      </div>

      {/* Answer Input */}
      <div className="flex gap-3">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Number of sides..."
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
          min="1"
          max="8"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700"
          disabled={!userAnswer}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="text-sm text-slate-600">
        ✓ Correct: <strong>{correct}</strong>
      </div>
    </div>
  );
};

/**
 * Skip Counting
 */
const SkipCounting = ({ userProfile, setUserProfile }) => {
  const sequences = [
    { step: 2, start: 0, title: 'Count by 2s', colors: 'blue' },
    { step: 5, start: 0, title: 'Count by 5s', colors: 'green' },
    { step: 10, start: 0, title: 'Count by 10s', colors: 'purple' },
    { step: 3, start: 0, title: 'Count by 3s', colors: 'orange' },
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);

  const sequence = sequences[currentIdx];
  const pattern = Array.from({ length: 6 }, (_, i) => sequence.start + i * sequence.step);
  const nextNumber = pattern[pattern.length - 1] + sequence.step;

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === nextNumber;
    
    let updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Skip counting by ${sequence.step}: ${nextNumber}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      setCorrect(correct + 1);
      setFeedback('✅ Perfect skip counting!');
      setTimeout(() => {
        setUserAnswer('');
        setFeedback('');
        setCurrentIdx((currentIdx + 1) % sequences.length);
      }, 1500);
    } else {
      setFeedback(`❌ The next number is ${nextNumber}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <p className="text-slate-700 font-semibold">{sequence.title}</p>

      {/* Sequence Display */}
      <div className="bg-slate-100 p-6 rounded-lg border border-slate-200">
        <div className="flex gap-2 justify-center flex-wrap mb-4">
          {pattern.map((num, idx) => (
            <React.Fragment key={idx}>
              <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center text-lg font-bold text-white">
                {num}
              </div>
              {idx < pattern.length - 1 && <div className="flex items-center text-2xl text-teal-600">→</div>}
            </React.Fragment>
          ))}
          <div className="flex items-center">→</div>
          <div className="w-12 h-12 bg-amber-400 rounded-lg flex items-center justify-center text-lg font-bold text-amber-900 border-2 border-amber-500">
            ?
          </div>
        </div>

        <p className="text-center text-sm text-slate-700">
          Each number increases by <strong>{sequence.step}</strong>
        </p>
      </div>

      {/* Answer Input */}
      <div className="flex gap-3">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="What's the next number?"
          className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700"
          disabled={!userAnswer}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {feedback}
        </div>
      )}

      <div className="text-sm text-slate-600">
        ✓ Correct: <strong>{correct}/{sequences.length}</strong>
      </div>
    </div>
  );
};

/**
 * Main Component
 */
export default function PatternRecognitionTrainer() {
  const [userProfile, setUserProfile] = useState(null);
  const [currentExercise, setCurrentExercise] = useState('missing');
  const [completedExercises, setCompletedExercises] = useState([]);

  useEffect(() => {
    const profile = initializeUserProfile();
    setUserProfile(profile);
  }, []);

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const exercises = [
    { id: 'missing', label: 'Missing Number', icon: '🔍', description: 'Find the missing number in sequences' },
    { id: 'growth', label: 'Block Growth', icon: '🧩', description: 'Identify visual growing patterns' },
    { id: 'shape', label: 'Shape Matching', icon: '🎨', description: 'Count sides and edges in shapes' },
    { id: 'skip', label: 'Skip Counting', icon: '🔢', description: 'Practice counting by different intervals' },
  ];

  const masteredCount = completedExercises.length;

  const handleExerciseComplete = (exerciseId) => {
    if (!completedExercises.includes(exerciseId)) {
      setCompletedExercises([...completedExercises, exerciseId]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/dyscalculia" className="inline-flex items-center text-teal-600 hover:text-teal-700">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Link>
          <Button className="rounded-full bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm">
            Pattern Trainer
          </Button>
          <div className="w-20"></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-8">
          {['Overview', 'Exercises', 'Tips'].map((tab) => (
            <button
              key={tab}
              className="py-3 px-1 text-sm font-medium text-slate-600 border-b-2 border-transparent hover:border-teal-600 hover:text-teal-600"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Exercise Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Pattern Exercises</h1>
            <Badge variant="outline" className="text-teal-600 border-teal-200">
              {masteredCount}/{exercises.length} completed
            </Badge>
          </div>
          <p className="text-slate-600">
            Build pattern detection skills with visual and numerical exercises. Master each pattern type to unlock your mathematical intuition.
          </p>
        </div>

        {/* Exercise Cards */}
        <div className="space-y-3 mb-8">
          {exercises.map((exercise) => (
            <Card
              key={exercise.id}
              className={`p-4 border cursor-pointer transition-all ${
                currentExercise === exercise.id
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setCurrentExercise(exercise.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{exercise.icon}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{exercise.label}</h3>
                    <p className="text-sm text-slate-600">{exercise.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {completedExercises.includes(exercise.id) && (
                    <span className="text-green-600 text-lg">✓</span>
                  )}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentExercise(exercise.id);
                    }}
                    className="rounded-full bg-teal-600 hover:bg-teal-700"
                  >
                    Start
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Active Exercise Content */}
        <div>
          <Card className="border-slate-200 overflow-hidden">
            {currentExercise === 'missing' && (
              <MissingNumberExercise userProfile={userProfile} setUserProfile={setUserProfile} />
            )}

            {currentExercise === 'growth' && (
              <BlockGrowthExercise userProfile={userProfile} setUserProfile={setUserProfile} />
            )}

            {currentExercise === 'shape' && (
              <ShapeNumberMatching userProfile={userProfile} setUserProfile={setUserProfile} />
            )}

            {currentExercise === 'skip' && (
              <SkipCounting userProfile={userProfile} setUserProfile={setUserProfile} />
            )}
          </Card>
        </div>

        {/* Info Section */}
        {masteredCount === exercises.length && (
          <Card className="mt-8 p-8 bg-slate-50 border-slate-200 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-teal-600 mb-4">
              Pattern Master!
            </h3>
            <p className="text-slate-700 mb-6">
              Congratulations! You've mastered all pattern recognition exercises. Your mathematical intuition is growing stronger.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
