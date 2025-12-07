import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, X } from 'lucide-react';

interface MagicSearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  hasSearched?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

const TYPEWRITER_EXAMPLES = [
  "서울 거주 30대 남성",
  "주 1회 이상 운동하는 직장인",
  "최신 아이폰을 사용하는 20대 여성"
];

export const MagicSearchBar = ({
  query,
  setQuery,
  onSearch,
  isLoading = false,
  hasSearched = false,
  suggestions = [],
  onSuggestionClick
}: MagicSearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const typewriterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  // Typewriter Effect for Placeholder
  useEffect(() => {
    if (hasSearched || query || isFocused) {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
      setTypewriterText('');
      currentIndexRef.current = 0;
      return;
    }

    const currentExample = TYPEWRITER_EXAMPLES[currentExampleIndex];
    currentIndexRef.current = typewriterText.length;

    const type = () => {
      if (!isDeleting) {
        // Typing
        if (currentIndexRef.current < currentExample.length) {
          setTypewriterText(currentExample.slice(0, currentIndexRef.current + 1));
          currentIndexRef.current++;
          typewriterTimeoutRef.current = setTimeout(type, 100);
        } else {
          // Finished typing, wait then start deleting
          typewriterTimeoutRef.current = setTimeout(() => {
            setIsDeleting(true);
            type();
          }, 2000);
        }
      } else {
        // Deleting
        if (currentIndexRef.current > 0) {
          setTypewriterText(currentExample.slice(0, currentIndexRef.current - 1));
          currentIndexRef.current--;
          typewriterTimeoutRef.current = setTimeout(type, 50);
        } else {
          // Finished deleting, move to next example
          setIsDeleting(false);
          setCurrentExampleIndex((prev) => (prev + 1) % TYPEWRITER_EXAMPLES.length);
          typewriterTimeoutRef.current = setTimeout(type, 300);
        }
      }
    };

    typewriterTimeoutRef.current = setTimeout(type, 100);

    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, [typewriterText, currentExampleIndex, isDeleting, hasSearched, query, isFocused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch();
  };

  return (
    <div className={`w-full transition-all duration-500 ${hasSearched ? 'mt-6' : 'mt-[30vh]'}`}>
      {!hasSearched && (
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight mb-3">
            무엇을 찾고 계신가요?
          </h1>
          <p className="text-slate-500 text-lg">AI가 복잡한 조건도 한 번에 찾아드립니다.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative group">
        {/* Glow Effect */}
        {isFocused && (
          <div className="absolute inset-0 bg-gradient-to-r from-violet-200 to-pink-200 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
        )}

        <div className={`relative flex items-center bg-white/70 backdrop-blur-xl border ${
          isFocused 
            ? 'border-indigo-300 ring-4 ring-indigo-500/20 shadow-2xl shadow-indigo-500/20' 
            : 'border-slate-200 shadow-2xl shadow-indigo-500/20'
        } rounded-full hover:shadow-2xl hover:shadow-indigo-500/30 hover:border-indigo-200 transition-all duration-300 p-3 h-16`}>
          <div className="pl-4 pr-2 text-violet-500">
            {isLoading ? (
              <div className="animate-spin">
                <Sparkles size={20} />
              </div>
            ) : (
              <Sparkles size={20} />
            )}
          </div>
          <div className="flex-1 relative">
            {!query && !isFocused && (
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <span className="text-slate-400 text-lg font-sans">
                  {typewriterText}
                  <span className="inline-block w-0.5 h-5 bg-violet-500 ml-1 animate-pulse" />
                </span>
              </div>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder=""
              className="w-full bg-transparent border-none outline-none text-slate-800 text-lg h-full font-sans"
              disabled={isLoading}
            />
          </div>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mr-2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white p-3 rounded-full transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            <Search size={20} />
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !hasSearched && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center animate-fade-in">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(suggestion);
                  if (onSuggestionClick) onSuggestionClick(suggestion);
                }}
                className="px-4 py-2 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-full text-sm text-slate-700 hover:bg-white hover:border-violet-300 hover:text-violet-600 transition-all duration-200 shadow-sm hover:shadow-md"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

