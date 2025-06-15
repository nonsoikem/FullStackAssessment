import React, { useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Calendar, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const PeptideSuggestionsApp = () => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const [formData, setFormData] = useState({
    age: '',
    healthGoal: ''
  });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const healthGoalOptions = [
    { value: '', label: 'Select your health goal' },
    { value: 'energy', label: 'Energy & Vitality' },
    { value: 'sleep', label: 'Better Sleep' },
    { value: 'focus', label: 'Mental Focus' },
    { value: 'recovery', label: 'Recovery & Repair' },
    { value: 'weight_management', label: 'Weight Management' },
    { value: 'immune_support', label: 'Immune Support' }
  ];

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.age || !formData.healthGoal) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.age < 18 || formData.age > 120) {
      setError('Age must be between 18 and 120');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await makeAuthenticatedRequest('/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          age: parseInt(formData.age),
          healthGoal: formData.healthGoal
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuggestions(data.suggestions);
        setSuccess(true);
      } else {
        setError(data.error?.message || 'Failed to get suggestions. Please try again.');
      }
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Unable to connect to server. Please make sure the backend is running on port 3001.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ age: '', healthGoal: '' });
    setSuggestions([]);
    setError('');
    setSuccess(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Welcome Message for Authenticated Users */}
        {user && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <User className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-gray-700">
                Welcome back, <span className="font-medium text-blue-600">{user.firstName || user.email}</span>! 
                Get your personalized recommendations below.
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🧬 Peptide Suggestions
          </h1>
          <p className="text-gray-600">
            {user 
              ? 'Get personalized peptide recommendations based on your health goals' 
              : 'Get peptide recommendations based on your health goals'
            }
          </p>
        </div>

 
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="space-y-6">
         
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                placeholder="Enter your age"
                min="18"
                max="120"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                disabled={loading}
              />
            </div>

           
            <div>
              <label htmlFor="healthGoal" className="block text-sm font-medium text-gray-700 mb-2">
                Health Goal
              </label>
              <select
                id="healthGoal"
                name="healthGoal"
                value={formData.healthGoal}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                disabled={loading}
              >
                {healthGoalOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

        
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

        
            {success && suggestions.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-green-700">
                  Great! We've generated {suggestions.length} personalized recommendations for you.
                  {user && ' These have been saved to your account history.'}
                </p>
              </div>
            )}

           
            <div className="flex gap-4">
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Get Suggestions
                  </>
                )}
              </button>

              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        {suggestions.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Your Recommendations
              </h2>
              {user && (
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-1" />
                  Saved to your history
                </div>
              )}
            </div>

            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {suggestion.name}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {suggestion.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeptideSuggestionsApp;