import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import PeptideSuggestionsApp from './PeptideSuggestionsApp';
import LoadingSpinner from './LoadingSpinner';
import { User, LogOut, History, Settings } from 'lucide-react';

const MainApp = () => {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('suggestions'); // 'suggestions', 'profile', 'history'
  const [showUserMenu, setShowUserMenu] = useState(false);

  
  if (loading) {
    return <LoadingSpinner />;
  }

  
  if (!isAuthenticated) {
    return <LoginForm onSuccess={() => setCurrentView('suggestions')} />;
  }

  // Handle logout
  const handleLogout = () => {
    logout();
    setCurrentView('suggestions');
    setShowUserMenu(false);
  };

  // Navigation header for authenticated users
  const NavigationHeader = () => (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">🧬</span>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-900">Peptide Suggestions</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-8">
            <button
              onClick={() => setCurrentView('suggestions')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'suggestions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Suggestions
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'history'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <History className="w-4 h-4 inline mr-1" />
              History
            </button>
           
          </nav>

          
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="ml-2 text-gray-700 font-medium">
                  {user?.firstName || user?.email}
                </span>
              </div>
            </button>

          
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                  Signed in as<br />
                  <span className="font-medium text-gray-900">{user?.email}</span>
                </div>
                <button
                  onClick={() => {
                    setCurrentView('profile');
                    setShowUserMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="w-4 h-4 inline mr-2" />
                  Account Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 inline mr-2" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="flex justify-around py-2">
          <button
            onClick={() => setCurrentView('suggestions')}
            className={`flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors ${
              currentView === 'suggestions'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-lg mb-1">🧬</span>
            Suggestions
          </button>
          <button
            onClick={() => setCurrentView('history')}
            className={`flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors ${
              currentView === 'history'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-5 h-5 mb-1" />
            History
          </button>
       
        </div>
      </div>
    </header>
  );

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'suggestions':
        return <PeptideSuggestionsApp />;
      case 'history':
        return <SuggestionHistory />;
      default:
        return <PeptideSuggestionsApp />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      
    
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {renderCurrentView()}
      </main>
    </div>
  );
};

// Simple Suggestion History Component
const SuggestionHistory = () => {
  const { getSuggestionHistory } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const result = await getSuggestionHistory(20);
        if (result.success) {
          setHistory(result.suggestions);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError('Failed to load suggestion history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [getSuggestionHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
        <p className="text-gray-500">
          Your suggestion history will appear here after you start getting recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Suggestion History</h2>
        <p className="text-gray-600">View your previous peptide recommendations and track your health journey.</p>
      </div>

      <div className="space-y-4">
        {history.map((item, index) => (
          <div key={item.id || index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {item.healthGoal.charAt(0).toUpperCase() + item.healthGoal.slice(1).replace('_', ' ')} Goal
                </h3>
                <p className="text-sm text-gray-500">
                  Age: {item.age} • {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {item.suggestions.map((suggestion, suggestionIndex) => (
                <div key={suggestionIndex} className="border-l-4 border-blue-200 pl-4">
                  <h4 className="font-medium text-gray-900">{suggestion.name}</h4>
                  <p className="text-sm text-gray-600">{suggestion.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainApp;