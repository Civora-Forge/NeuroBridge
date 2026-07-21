/**
 * Calm Mode
 * 
 * Anxiety-aware system that detects stress and provides supportive guidance.
 * 
 * Triggers:
 * - User exits 2+ times mid-session
 * - 3+ consecutive incorrect responses
 * - Long hesitation time (>8 seconds)
 * 
 * Features:
 * - No timer
 * - Slow transitions
 * - Supportive language
 * - Reduced difficulty
 * - Grounding techniques
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  initializeUserProfile,
  shouldActivateCalmMode,
  recordSessionExit,
  saveUserProfile
} from '@/lib/dyscalculiaAdaptiveEngine';

/**
 * Breathing Exercise Component
 */
const BreathingExercise = ({ onComplete }) => {
  const [breathingCycle, setBreathingCycle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    const cycles = [
      { phase: 'Breathe in...', duration: 3000, scale: 1.5 },
      { phase: 'Hold...', duration: 2000, scale: 1.5 },
      { phase: 'Breathe out...', duration: 3000, scale: 0.8 },
      { phase: 'Hold...', duration: 2000, scale: 0.8 },
    ];

    let currentPhase = 0;
    const interval = setInterval(() => {
      currentPhase = (currentPhase + 1) % cycles.length;
      setBreathingCycle(currentPhase);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const phases = [
    { phase: 'Breathe in...', duration: 3000, label: 'In' },
    { phase: 'Hold...', duration: 2000, label: 'Hold' },
    { phase: 'Breathe out...', duration: 3000, label: 'Out' },
    { phase: 'Hold...', duration: 2000, label: 'Hold' },
  ];

  return (
    <div className="space-y-4">
      {isPlaying ? (
        <div className="space-y-8 text-center p-8">
          {/* Animated Circle */}
          <div className="flex justify-center">
            <div
              className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold text-center transition-all duration-1000 ease-in-out shadow-lg"
              style={{
                transform: breathingCycle % 2 === 0 ? 'scale(0.8)' : 'scale(1.3)',
              }}
            >
              <div className="text-2xl">
                {phases[breathingCycle]?.label}
              </div>
            </div>
          </div>

          <p className="text-lg text-slate-700 font-semibold">
            {phases[breathingCycle]?.phase}
          </p>

          <Button
            onClick={() => {
              setIsPlaying(false);
              onComplete();
            }}
            className="rounded-full bg-teal-600 hover:bg-teal-700 py-2 px-6"
          >
            ✓ I Feel Better
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-6">
          <p className="text-slate-700">
            Let's take a moment to calm your mind and body. Follow the circle as it grows and shrinks.
          </p>
          <Button
            onClick={() => setIsPlaying(true)}
            className="rounded-full bg-teal-600 hover:bg-teal-700"
          >
            Start Exercise
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Grounding Technique (5-4-3-2-1)
 */
const GroundingExercise = ({ onComplete }) => {
  const [selectedSenses, setSelectedSenses] = useState({
    see: 0,
    hear: 0,
    touch: 0,
    smell: 0,
    taste: 0,
  });

  const instructions = [
    { sense: 'see', number: 5, emoji: '👀', label: 'things you SEE' },
    { sense: 'hear', number: 4, emoji: '👂', label: 'things you HEAR' },
    { sense: 'touch', number: 3, emoji: '✋', label: 'things you FEEL (touch)' },
    { sense: 'smell', number: 2, emoji: '👃', label: 'things you SMELL' },
    { sense: 'taste', number: 1, emoji: '👅', label: 'things you TASTE' },
  ];

  const handleIncrement = (sense) => {
    const current = selectedSenses[sense];
    const max = instructions.find(i => i.sense === sense).number;
    if (current < max) {
      setSelectedSenses({ ...selectedSenses, [sense]: current + 1 });
    }
  };

  const allComplete = Object.values(selectedSenses).every((count, idx) => 
    count === instructions[idx]?.number
  );

  return (
    <div className="space-y-4 p-6">
      <p className="text-slate-700">
        This exercise brings you back to the present moment. Think about what you experience with each sense.
      </p>

      <div className="space-y-4">
        {instructions.map((item) => (
          <div key={item.sense} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800">
                {item.emoji} Find {item.number} {item.label}
              </label>
              <span className="text-sm font-semibold text-teal-600">
                {selectedSenses[item.sense]}/{item.number}
              </span>
            </div>

            <div className="flex gap-2">
              {Array.from({ length: item.number }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleIncrement(item.sense)}
                  className={`w-8 h-8 rounded-full font-bold text-white transition-all text-xs ${
                    i < selectedSenses[item.sense]
                      ? 'bg-teal-600'
                      : 'bg-slate-300 opacity-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onComplete}
        disabled={!allComplete}
        className="rounded-full bg-teal-600 hover:bg-teal-700 w-full disabled:opacity-50"
      >
        {allComplete ? '✓ I Feel Grounded' : 'Complete all senses...'}
      </Button>
    </div>
  );
};

/**
 * Supportive Math Mini-Lesson
 */
const CalmMathLesson = ({ onComplete }) => {
  const lessons = [
    {
      title: 'Numbers Are Just Symbols',
      description: 'Math is just a way to show ideas. There\'s no rush to understand everything at once.',
      icon: '🔢',
    },
    {
      title: 'Mistakes Help You Learn',
      description: 'Every error is information. It shows what to practice next. That\'s how learning works!',
      icon: '💡',
    },
    {
      title: 'Your Speed Doesn\'t Matter',
      description: 'Take all the time you need. Understanding is way more important than speed.',
      icon: '⏱️',
    },
    {
      title: 'You Can Do This',
      description: 'You\'ve already learned so much. Each problem you solve makes you stronger.',
      icon: '💪',
    },
  ];

  const [currentLesson, setCurrentLesson] = useState(0);
  const lesson = lessons[currentLesson];

  return (
    <div className="space-y-4 p-6">
      <div className="text-6xl text-center mb-4">{lesson.icon}</div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h4 className="text-xl font-bold text-slate-900 mb-3">{lesson.title}</h4>
        <p className="text-slate-700 leading-relaxed">
          {lesson.description}
        </p>
      </div>

      <div className="flex gap-2 justify-between">
        <Button
          onClick={() => setCurrentLesson(Math.max(0, currentLesson - 1))}
          disabled={currentLesson === 0}
          variant="outline"
          className="disabled:opacity-50"
        >
          ← Previous
        </Button>
        <span className="flex items-center text-sm text-slate-600">
          {currentLesson + 1} / {lessons.length}
        </span>
        <Button
          onClick={() => setCurrentLesson(Math.min(lessons.length - 1, currentLesson + 1))}
          disabled={currentLesson === lessons.length - 1}
          variant="outline"
          className="disabled:opacity-50"
        >
          Next →
        </Button>
      </div>

      {currentLesson === lessons.length - 1 && (
        <Button
          onClick={onComplete}
          className="rounded-full bg-teal-600 hover:bg-teal-700 w-full"
        >
          ✓ Ready to Continue
        </Button>
      )}
    </div>
  );
};

export default function CalmMode() {
  const [userProfile, setUserProfile] = useState(null);
  const [currentExercise, setCurrentExercise] = useState('breathing');
  const [completedExercises, setCompletedExercises] = useState([]);

  useEffect(() => {
    const profile = initializeUserProfile();
    setUserProfile(profile);
  }, []);

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const isCalmModeTriggered = shouldActivateCalmMode(userProfile);

  const handleExerciseComplete = () => {
    // Mark exercise as completed
    if (!completedExercises.includes(currentExercise)) {
      setCompletedExercises([...completedExercises, currentExercise]);
    }

    // Move to next exercise or finish
    const exercises = ['breathing', 'grounding', 'lesson'];
    const nextIdx = exercises.indexOf(currentExercise) + 1;
    
    if (nextIdx < exercises.length) {
      setCurrentExercise(exercises[nextIdx]);
    } else {
      // Reset and go back to dashboard
      const updatedProfile = { ...userProfile, anxiety_flag: false };
      saveUserProfile(updatedProfile);
      setUserProfile(updatedProfile);
    }
  };

  const exercises = [
    { id: 'breathing', label: 'Breathing Exercise', icon: '🌬️' },
    { id: 'grounding', label: 'Grounding Technique', icon: '🌿' },
    { id: 'lesson', label: 'Supportive Lesson', icon: '💡' },
  ];

  const masteredCount = completedExercises.length;

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
            Calm Mode
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
        {/* Alert if triggered */}
        {isCalmModeTriggered && (
          <div className="mb-6">
            <Alert className="bg-amber-50 border-amber-200">
              <Heart className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-800 ml-3">
                <strong>We're Here For You:</strong> We noticed you might be feeling challenged. Let's take a break together with these calming exercises. You're doing great!
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Exercise Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Calming Exercises</h1>
            <Badge variant="outline" className="text-teal-600 border-teal-200">
              {masteredCount}/{exercises.length} completed
            </Badge>
          </div>
          <p className="text-slate-600">
            Take time to reset with supportive exercises. No pressure, no timer—just you and some helpful guidance.
          </p>
        </div>

        {/* Exercises Grid */}
        <div className="space-y-3">
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
                    <p className="text-sm text-slate-600">
                      {exercise.id === 'breathing' && 'Guided breathing to calm your mind'}
                      {exercise.id === 'grounding' && '5-4-3-2-1 sensory grounding technique'}
                      {exercise.id === 'lesson' && 'Supportive affirmations about learning'}
                    </p>
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
        <div className="mt-8">
          <Card className="border-slate-200 overflow-hidden">
            {currentExercise === 'breathing' && (
              <BreathingExercise onComplete={handleExerciseComplete} />
            )}

            {currentExercise === 'grounding' && (
              <GroundingExercise onComplete={handleExerciseComplete} />
            )}

            {currentExercise === 'lesson' && (
              <CalmMathLesson onComplete={handleExerciseComplete} />
            )}
          </Card>
        </div>

        {/* Completion Message */}
        {completedExercises.length === exercises.length && (
          <Card className="mt-8 p-8 bg-slate-50 border-slate-200 text-center">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-2xl font-bold text-teal-600 mb-4">
              You Made It!
            </h3>
            <p className="text-slate-700 mb-6">
              You've taken time to care for yourself. That's the most important math skill: knowing when to rest.
            </p>
            <Link to="/dyscalculia">
              <Button className="rounded-full bg-teal-600 hover:bg-teal-700 px-8">
                Return to Dashboard
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
