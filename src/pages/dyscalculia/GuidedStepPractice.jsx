/**
 * Guided Step Practice
 * 
 * Break calculations into micro-steps to reduce working memory load.
 * Users must follow step-by-step guidance without skipping.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  recordResponse,
  saveUserProfile,
  initializeUserProfile,
  determineScaffoldLevel
} from '@/lib/dyscalculiaAdaptiveEngine';

// Problem definitions with step-by-step breakdowns
const PRACTICE_PROBLEMS = {
  beginner: [
    {
      problem: '24 + 12',
      tens: 2,
      ones: 4,
      addTens: 1,
      addOnes: 2,
      answer: 36,
      difficulty: 'beginner'
    },
    {
      problem: '13 + 15',
      tens: 1,
      ones: 3,
      addTens: 1,
      addOnes: 5,
      answer: 28,
      difficulty: 'beginner'
    },
  ],
  intermediate: [
    {
      problem: '38 + 24',
      tens: 3,
      ones: 8,
      addTens: 2,
      addOnes: 4,
      answer: 62,
      difficulty: 'intermediate'
    },
    {
      problem: '47 + 35',
      tens: 4,
      ones: 7,
      addTens: 3,
      addOnes: 5,
      answer: 82,
      difficulty: 'intermediate'
    },
    {
      problem: '52 - 28',
      tens: 5,
      ones: 2,
      subtractTens: 2,
      subtractOnes: 8,
      answer: 24,
      difficulty: 'intermediate',
      isBorrow: true
    },
  ],
  advanced: [
    {
      problem: '156 + 234',
      hundreds: 1,
      tens: 5,
      ones: 6,
      addHundreds: 2,
      addTens: 3,
      addOnes: 4,
      answer: 390,
      difficulty: 'advanced'
    },
  ],
};

// Step definitions for guidance
const getSteps = (problem) => {
  const { problem: problemStr, isBorrow } = problem;
  
  if (problemStr.includes('+')) {
    return [
      {
        step: 1,
        instruction: 'Focus on the ONES place (right side)',
        highlight: 'ones',
        question: `What is ${problem.ones} + ${problem.addOnes}?`,
        answer: problem.ones + problem.addOnes,
      },
      {
        step: 2,
        instruction: 'Focus on the TENS place (middle)',
        highlight: 'tens',
        question: `What is ${problem.tens} + ${problem.addTens}?`,
        answer: problem.tens + problem.addTens,
      },
      {
        step: 3,
        instruction: 'Combine both results',
        highlight: 'result',
        question: `What is the final answer?`,
        answer: problem.answer,
      },
    ];
  } else {
    // Subtraction steps
    return [
      {
        step: 1,
        instruction: 'Focus on the ONES place (right side)',
        highlight: 'ones',
        question: `Can we do ${problem.ones} - ${problem.subtractOnes}? ${isBorrow ? '(We might need to borrow!)' : ''}`,
        answer: problem.ones - problem.subtractOnes,
      },
      {
        step: 2,
        instruction: 'Focus on the TENS place (middle)',
        highlight: 'tens',
        question: `What is ${problem.tens} - ${problem.subtractTens}?`,
        answer: problem.tens - problem.subtractTens,
      },
      {
        step: 3,
        instruction: 'Combine both results',
        highlight: 'result',
        question: `What is the final answer?`,
        answer: problem.answer,
      },
    ];
  }
};

/**
 * Visual Block Display for digit place value
 */
const BlockDisplay = ({ value, place, highlight }) => {
  return (
    <div className={`text-center p-4 rounded-lg transition-all ${
      highlight === place
        ? 'bg-teal-50 border-2 border-teal-500 scale-105'
        : 'bg-slate-100 border border-slate-300'
    }`}>
      <p className="text-sm font-semibold text-slate-700 mb-2">
        {place === 'ones' ? '👉 ONES' : place === 'tens' ? '👉 TENS' : '👉 HUNDREDS'}
      </p>
      <div className="text-4xl font-bold text-teal-700">
        {value}
      </div>
      {place === 'ones' && <p className="text-xs text-slate-600 mt-2">ones place</p>}
      {place === 'tens' && <p className="text-xs text-slate-600 mt-2">tens place</p>}
      {place === 'hundreds' && <p className="text-xs text-slate-600 mt-2">hundreds place</p>}
    </div>
  );
};

/**
 * Main Component
 */
export default function GuidedStepPractice() {
  const [userProfile, setUserProfile] = useState(null);
  const [difficulty, setDifficulty] = useState('beginner');
  const [currentProblem, setCurrentProblem] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [skippedSteps, setSkippedSteps] = useState(0);
  const [correctSteps, setCorrectSteps] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [completedProblems, setCompletedProblems] = useState(0);

  useEffect(() => {
    const profile = initializeUserProfile();
    setUserProfile(profile);
    
    // Pick random problem based on difficulty
    const problems = PRACTICE_PROBLEMS[difficulty];
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    setCurrentProblem(randomProblem);
    setCurrentStepIndex(0);
    setUserAnswer('');
    setShowHint(false);
    setStartTime(Date.now());
  }, [difficulty]);

  if (!userProfile || !currentProblem) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const steps = getSteps(currentProblem);
  const currentStep = steps[currentStepIndex];
  const scaffoldLevel = determineScaffoldLevel(userProfile);

  const handleSubmitStep = () => {
    if (!userAnswer) return;

    const isCorrect = parseInt(userAnswer) === currentStep.answer;
    const responseTimeMs = Date.now() - startTime;

    if (isCorrect) {
      setCorrectSteps(correctSteps + 1);
      setFeedback('✅ Perfect! You got it right!');

      // Update profile on correct step
      let updatedProfile = recordResponse(userProfile, true, responseTimeMs, `${currentProblem.problem} - Step ${currentStepIndex + 1}`);
      setUserProfile(updatedProfile);
      saveUserProfile(updatedProfile);

      // Move to next step or complete
      if (currentStepIndex < steps.length - 1) {
        setTimeout(() => {
          setCurrentStepIndex(currentStepIndex + 1);
          setUserAnswer('');
          setFeedback('');
          setShowHint(false);
          setStartTime(Date.now());
        }, 1500);
      } else {
        // Problem complete!
        setFeedback('🎉 Problem complete!');
        setTimeout(() => {
          const problems = PRACTICE_PROBLEMS[difficulty];
          const randomProblem = problems[Math.floor(Math.random() * problems.length)];
          setCurrentProblem(randomProblem);
          setCurrentStepIndex(0);
          setUserAnswer('');
          setFeedback('');
          setShowHint(false);
          setStartTime(Date.now());
          setCompletedProblems(completedProblems + 1);
        }, 2000);
      }
    } else {
      // Incorrect answer
      let updatedProfile = recordResponse(userProfile, false, responseTimeMs, `${currentProblem.problem} - Step ${currentStepIndex + 1}`);
      setUserProfile(updatedProfile);
      saveUserProfile(updatedProfile);
      
      setFeedback(`❌ Not quite. The answer is ${currentStep.answer}. Let me show you...`);
      setShowHint(true);
    }
  };

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
          <div className="text-right text-sm text-slate-600">
            <p>Completed: <strong>{completedProblems}</strong></p>
            <p>Correct steps: <strong>{correctSteps}</strong></p>
          </div>
        </div>

        <Card className="bg-white border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">Guided Step Practice</h1>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                Scaffolded
              </Badge>
            </div>
            <span className="text-sm text-slate-500">{currentStepIndex + 1}/{steps.length} steps</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-center mb-6">
              <h2 className="text-sm text-slate-600 mb-2">Today's Problem</h2>
              <div className="text-5xl font-bold text-slate-900">{currentProblem.problem}</div>
              <p className="text-slate-600 mt-3">Solve this step by step. Don't skip ahead!</p>
            </div>

            <div className="flex items-center justify-center gap-2 mb-8">
              {steps.map((_, idx) => (
                <React.Fragment key={idx}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    idx < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : idx === currentStepIndex
                      ? 'bg-teal-600 text-white scale-110'
                      : 'bg-slate-300 text-slate-700'
                  }`}>
                    {idx < currentStepIndex ? '✓' : idx + 1}
                  </div>
                  {idx < steps.length - 1 && <div className="w-8 h-1 bg-slate-300" />}
                </React.Fragment>
              ))}
            </div>

            <Card className="p-6 bg-white border border-slate-200 mb-6">
              <div className="mb-6">
                <div className="bg-teal-50 border-l-4 border-teal-600 p-4 rounded mb-6">
                  <h3 className="text-xl font-bold text-teal-900">
                    Step {currentStep.step}: {currentStep.instruction}
                  </h3>
                </div>

                {currentStep.highlight === 'ones' && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <BlockDisplay value={currentProblem.ones} place="ones" highlight={currentStep.highlight} />
                    {currentProblem.addOnes !== undefined && (
                      <BlockDisplay value={currentProblem.addOnes} place="add" highlight={currentStep.highlight} />
                    )}
                  </div>
                )}

                {currentStep.highlight === 'tens' && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <BlockDisplay value={currentProblem.tens} place="tens" highlight={currentStep.highlight} />
                    {currentProblem.addTens !== undefined && (
                      <BlockDisplay value={currentProblem.addTens} place="add" highlight={currentStep.highlight} />
                    )}
                  </div>
                )}

                {currentStep.highlight === 'result' && (
                  <div className="bg-green-100 p-6 rounded-lg text-center mb-6">
                    <p className="text-slate-700 mb-3">You've completed all the steps!</p>
                    <div className="text-5xl font-bold text-green-600">{currentProblem.answer}</div>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
                <p className="text-lg font-semibold text-amber-900 text-center">{currentStep.question}</p>
              </div>

              {showHint && (
                <Alert className="bg-amber-50 border-amber-300 mb-6">
                  <HelpCircle className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-amber-800 ml-3">
                    <strong>Hint:</strong> Let me show you: {currentProblem.ones} + {currentProblem.addOnes} on a visual block might help visualize the combining.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 mb-6 flex-col sm:flex-row">
                <input
                  type="number"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitStep()}
                  placeholder="Type your answer..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 text-xl font-semibold"
                  autoFocus
                />
                <Button
                  onClick={handleSubmitStep}
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-8 font-semibold"
                >
                  <ChevronRight className="w-5 h-5" />
                  Check
                </Button>
              </div>

              {feedback && (
                <div className={`text-center text-lg font-bold p-4 rounded-lg ${
                  feedback.includes('✅')
                    ? 'bg-green-100 text-green-700'
                    : feedback.includes('🎉')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {feedback}
                </div>
              )}
            </Card>
          </div>
        </Card>

        <Card className="bg-white border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-sm text-slate-600 mb-2">Support Level</p>
              <div className="px-3 py-2 bg-slate-100 rounded-lg font-semibold text-slate-700 capitalize">
                {scaffoldLevel === 1 ? 'Minimal' : scaffoldLevel === 2 ? 'Moderate' : 'Full Support'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-amber-50 border border-amber-200">
          <h3 className="font-bold text-amber-900 mb-3">Step-by-Step Benefits</h3>
          <ul className="space-y-2 text-amber-800 text-sm">
            <li>✓ Breaks big problems into small, manageable pieces</li>
            <li>✓ Reduces working memory overload</li>
            <li>✓ Builds confidence through success at each step</li>
            <li>✓ No skipping - you complete each step in order</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
