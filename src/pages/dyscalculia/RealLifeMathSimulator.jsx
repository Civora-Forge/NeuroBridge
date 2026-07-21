/**
 * Real-Life Math Simulator
 *
 * Build practical numerical confidence with real-world scenarios:
 * - Grocery total calculator
 * - Change calculator
 * - Time reading
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShoppingCart,
  Coins,
  Clock,
  Play,
  CheckCircle,
  ChevronDown,
  AlertCircle,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  recordResponse,
  saveUserProfile,
  initializeUserProfile,
} from '@/lib/dyscalculiaAdaptiveEngine';

const formatPrice = (price) => {
  if (Number.isInteger(price)) {
    return price;
  }

  return Number(price).toFixed(2);
};

/**
 * Grocery Total Calculator
 */
const GroceryCalculator = ({ userProfile, setUserProfile, onMastered }) => {
  const items = [
    { name: 'Milk', price: 28 },
    { name: 'Bread', price: 15 },
    { name: 'Eggs', price: 42 },
    { name: 'Cheese', price: 65 },
    { name: 'Apples', price: 35 },
    { name: 'Juice', price: 48 },
  ];

  const [selectedItems, setSelectedItems] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [userTotal, setUserTotal] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(0);
  const [showDetailBreak, setShowDetailBreak] = useState(false);

  const getItemPrice = (idx) => {
    const customValue = customPrices[idx];

    if (customValue === undefined || customValue === null || customValue === '') {
      return items[idx].price;
    }

    const parsed = Number(customValue);

    if (Number.isNaN(parsed) || parsed < 0) {
      return items[idx].price;
    }

    return parsed;
  };

  const correctTotal = selectedItems.reduce((sum, idx) => sum + getItemPrice(idx), 0);

  const handleAddItem = (idx) => {
    if (!selectedItems.includes(idx)) {
      setSelectedItems([...selectedItems, idx]);
    }
  };

  const handleRemoveItem = (idx) => {
    setSelectedItems(selectedItems.filter((itemIdx) => itemIdx !== idx));
  };

  const handlePriceChange = (idx, value) => {
    setCustomPrices((prev) => ({
      ...prev,
      [idx]: value,
    }));
  };

  const handleSubmit = () => {
    if (!userTotal) return;

    const enteredTotal = Number(userTotal);
    if (Number.isNaN(enteredTotal)) return;

    const isCorrect = Math.abs(enteredTotal - correctTotal) < 0.01;

    const updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Grocery total: ${correctTotal}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      onMastered('grocery');
      setCorrect(correct + 1);
      setFeedback('✅ Perfect! Great shopping math!');
      setTimeout(() => {
        setSelectedItems([]);
        setUserTotal('');
        setFeedback('');
        setShowDetailBreak(false);
      }, 1500);
    } else {
      setFeedback(`❌ Not quite. The total is ₹${formatPrice(correctTotal)}`);
      setShowDetailBreak(true);
    }
  };

  return (
    <Card className="bg-white border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Grocery Shopping</h3>
          <p className="text-sm text-slate-500">Select items and calculate the cart total.</p>
        </div>
        <span className="text-sm text-slate-500">{correct} solved</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">Item Price Editor</p>
          <p className="text-xs text-slate-500">Leave blank to use default price</p>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const selected = selectedItems.includes(idx);
            const itemPrice = getItemPrice(idx);

            return (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">Default: ₹{item.price}</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrices[idx] ?? ''}
                    onChange={(e) => handlePriceChange(idx, e.target.value)}
                    placeholder={`${item.price}`}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-600"
                  />
                  <span className="w-20 text-right text-sm font-semibold text-slate-700">₹{formatPrice(itemPrice)}</span>
                  <Button
                    onClick={() => (selected ? handleRemoveItem(idx) : handleAddItem(idx))}
                    size="sm"
                    className={selected ? 'rounded-full bg-slate-200 text-slate-800 hover:bg-slate-300' : 'rounded-full bg-teal-600 text-white hover:bg-teal-700'}
                  >
                    {selected ? 'Remove' : 'Add'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedItems.length > 0 && (
        <Card className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <h4 className="font-semibold text-slate-900 mb-3">Your Basket</h4>
          <div className="space-y-2 mb-4">
            {selectedItems.map((idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
                <span className="font-medium text-slate-800">{items[idx].name}</span>
                <span className="font-semibold text-slate-900">₹{formatPrice(getItemPrice(idx))}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-300 bg-white p-3">
            <p className="text-sm text-slate-600 mb-1">Calculation</p>
            <p className="font-semibold text-slate-900">
              {selectedItems.map((idx) => formatPrice(getItemPrice(idx))).join(' + ')} = ?
            </p>
          </div>
        </Card>
      )}

      {showDetailBreak && selectedItems.length > 0 && (
        <Alert className="bg-amber-50 border-amber-300 mb-6">
          <AlertDescription className="text-amber-800">
            Let me show you step by step:
            <div className="mt-3 space-y-1">
              {selectedItems.map((idx, stepIndex) => (
                <div key={idx} className="text-sm">
                  Step {stepIndex + 1}: {items[idx].name} = ₹{formatPrice(getItemPrice(idx))}
                </div>
              ))}
              <div className="font-bold text-amber-900 mt-2">
                Total: ₹{formatPrice(correctTotal)}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <input
          type="number"
          step="0.01"
          value={userTotal}
          onChange={(e) => setUserTotal(e.target.value)}
          placeholder="Enter total..."
          disabled={selectedItems.length === 0}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700 text-white px-8"
          disabled={selectedItems.length === 0 || !userTotal}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {feedback}
        </div>
      )}
    </Card>
  );
};

/**
 * Change Calculator
 */
const ChangeCalculator = ({ userProfile, setUserProfile, onMastered }) => {
  const scenarios = [
    { cost: 47, paid: 100, name: 'Small snack' },
    { cost: 135, paid: 200, name: 'Lunch' },
    { cost: 67, paid: 100, name: 'Groceries' },
    { cost: 234, paid: 500, name: 'Books' },
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [userChange, setUserChange] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState(0);

  const current = scenarios[currentIdx];
  const correctChange = current.paid - current.cost;

  const handleSubmit = () => {
    if (!userChange) return;

    const enteredChange = Number(userChange);
    if (Number.isNaN(enteredChange)) return;

    const isCorrect = Math.abs(enteredChange - correctChange) < 0.01;

    const updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Change: ₹${current.paid} - ₹${current.cost}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      onMastered('change');
      setCorrectAnswers(correctAnswers + 1);
      setFeedback('✅ Correct change!');
      setTimeout(() => {
        setUserChange('');
        setFeedback('');
        setCurrentIdx((currentIdx + 1) % scenarios.length);
      }, 1500);
    } else {
      setFeedback(`❌ Change should be ₹${correctChange}`);
    }
  };

  return (
    <Card className="bg-white border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-900">Making Change</h3>
        <span className="text-sm text-slate-500">{correctAnswers}/{scenarios.length} correct</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
        <p className="text-sm text-slate-600 mb-4"><strong>Scenario:</strong> {current.name}</p>
        <div className="space-y-2 mb-4">
          <div className="flex justify-between rounded-lg border border-slate-200 bg-white p-3">
            <span className="font-medium text-slate-700">Item cost</span>
            <span className="text-xl font-bold text-slate-900">₹{current.cost}</span>
          </div>
          <div className="flex justify-between rounded-lg border border-slate-200 bg-white p-3">
            <span className="font-medium text-slate-700">You paid</span>
            <span className="text-xl font-bold text-slate-900">₹{current.paid}</span>
          </div>
        </div>
        <p className="text-sm text-slate-600">Calculate: ₹{current.paid} - ₹{current.cost}</p>
      </div>

      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <input
          type="number"
          value={userChange}
          onChange={(e) => setUserChange(e.target.value)}
          placeholder="Enter change amount..."
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700 text-white px-8"
          disabled={!userChange}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {feedback}
        </div>
      )}
    </Card>
  );
};

/**
 * Time Reading
 */
const TimeReading = ({ userProfile, setUserProfile, onMastered }) => {
  const timeScenarios = [
    { hour: 3, minute: 15, text: 'Afternoon snack time' },
    { hour: 9, minute: 30, text: 'Mid-morning' },
    { hour: 6, minute: 45, text: 'Dinner time' },
    { hour: 11, minute: 50, text: 'Almost noon' },
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState(0);

  const current = timeScenarios[currentIdx];
  const correctTime = `${current.hour}:${String(current.minute).padStart(2, '0')}`;

  const handleSubmit = () => {
    if (!userAnswer) return;

    const isCorrect = userAnswer === correctTime;

    const updatedProfile = recordResponse(
      userProfile,
      isCorrect,
      2000,
      `Time: ${correctTime}`
    );
    setUserProfile(updatedProfile);
    saveUserProfile(updatedProfile);

    if (isCorrect) {
      onMastered('time');
      setCorrectAnswers(correctAnswers + 1);
      setFeedback('✅ Perfect time reading!');
      setTimeout(() => {
        setUserAnswer('');
        setFeedback('');
        setCurrentIdx((currentIdx + 1) % timeScenarios.length);
      }, 1500);
    } else {
      setFeedback(`❌ The time is ${correctTime}`);
    }
  };

  return (
    <Card className="bg-white border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-900">Time Reading</h3>
        <span className="text-sm text-slate-500">{correctAnswers}/{timeScenarios.length} correct</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 mb-6">
        <p className="text-center text-slate-600 mb-5">{current.text}</p>

        <div className="flex justify-center mb-6">
          <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-sm">
            <circle cx="100" cy="100" r="90" fill="white" stroke="#0f172a" strokeWidth="3" />

            {[...Array(12)].map((_, index) => {
              const angle = (index * 30 - 90) * Math.PI / 180;
              const x1 = 100 + 75 * Math.cos(angle);
              const y1 = 100 + 75 * Math.sin(angle);
              const x2 = 100 + 85 * Math.cos(angle);
              const y2 = 100 + 85 * Math.sin(angle);
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              );
            })}

            <line
              x1="100"
              y1="100"
              x2={100 + 40 * Math.cos((current.hour % 12 + current.minute / 60 - 3) * Math.PI / 6)}
              y2={100 + 40 * Math.sin((current.hour % 12 + current.minute / 60 - 3) * Math.PI / 6)}
              stroke="#0f172a"
              strokeWidth="6"
              strokeLinecap="round"
            />

            <line
              x1="100"
              y1="100"
              x2={100 + 55 * Math.cos((current.minute - 15) * Math.PI / 30)}
              y2={100 + 55 * Math.sin((current.minute - 15) * Math.PI / 30)}
              stroke="#0d9488"
              strokeWidth="4"
              strokeLinecap="round"
            />

            <circle cx="100" cy="100" r="5" fill="#0f172a" />
          </svg>
        </div>

        <p className="text-center text-slate-600">What time does the clock show? (HH:MM)</p>
      </div>

      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="HH:MM"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-center text-lg focus:outline-none focus:border-teal-600"
        />
        <Button
          onClick={handleSubmit}
          className="rounded-full bg-teal-600 hover:bg-teal-700 text-white px-8"
          disabled={!userAnswer}
        >
          Check
        </Button>
      </div>

      {feedback && (
        <div className={`text-center text-lg font-bold p-3 rounded-lg ${
          feedback.includes('✅')
            ? 'bg-green-100 text-green-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {feedback}
        </div>
      )}
    </Card>
  );
};

/**
 * Main Component
 */
export default function RealLifeMathSimulator() {
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('grocery');
  const [masteredScenarios, setMasteredScenarios] = useState([]);

  useEffect(() => {
    const profile = initializeUserProfile();
    setUserProfile(profile);
  }, []);

  const markScenarioMastered = (scenarioKey) => {
    setMasteredScenarios((prev) => {
      if (prev.includes(scenarioKey)) {
        return prev;
      }

      return [...prev, scenarioKey];
    });
  };

  if (!userProfile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const scenarios = [
    {
      key: 'grocery',
      title: 'Grocery Shopping',
      subtitle: 'Practical · 15 min',
      icon: ShoppingCart,
      duration: '15 min',
      tag: 'Recommended'
    },
    {
      key: 'change',
      title: 'Making Change',
      subtitle: 'Beginner · 10 min',
      icon: Coins,
      duration: '10 min',
      tag: 'Cash Skills'
    },
    {
      key: 'time',
      title: 'Time Reading',
      subtitle: 'Intermediate · 12 min',
      icon: Clock,
      duration: '12 min',
      tag: 'Daily Routines'
    },
  ];

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
        <Link
          to="/dyscalculia"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Number Tools
        </Link>

        <Card className="bg-white border border-slate-200 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <ChevronDown className="h-4 w-4 text-slate-400" />
              <h2 className="text-3xl font-bold text-slate-900">Real-Life Math Simulator</h2>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                Practical Math
              </Badge>
            </div>
            <span className="text-sm text-slate-500">{masteredScenarios.length}/3 mastered</span>
          </div>

          <div className="p-4 space-y-3">
            {scenarios.map((scenario) => {
              const Icon = scenario.icon;
              const isActive = activeTab === scenario.key;
              const isMastered = masteredScenarios.includes(scenario.key);

              return (
                <div
                  key={scenario.key}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? 'border-teal-200 bg-teal-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {isMastered ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-base font-semibold text-slate-900">{scenario.title}</p>
                      <p className="text-sm text-slate-500">{scenario.tag} · {scenario.duration}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setActiveTab(scenario.key)}
                    className="rounded-full bg-teal-600 hover:bg-teal-700 text-white px-7"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                </div>
              );
            })}

            <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 px-2 pt-1">
              <Plus className="h-4 w-4" />
              Add custom scenario
            </button>
          </div>
        </Card>

        {activeTab === 'grocery' && (
          <GroceryCalculator
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onMastered={markScenarioMastered}
          />
        )}

        {activeTab === 'change' && (
          <ChangeCalculator
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onMastered={markScenarioMastered}
          />
        )}

        {activeTab === 'time' && (
          <TimeReading
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onMastered={markScenarioMastered}
          />
        )}

        <Card className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4" />
            This tool supports real-world math practice between sessions. It does not replace professional support.
          </div>
        </Card>
      </div>
    </div>
  );
}
