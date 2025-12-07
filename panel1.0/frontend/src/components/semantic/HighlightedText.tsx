import React from 'react';

interface HighlightedTextProps {
  text: string;
  keywords: string[];
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const HighlightedText: React.FC<HighlightedTextProps> = ({ text, keywords }) => {
  if (!text || !keywords || keywords.length === 0) {
    return <>{text}</>;
  }

  const uniqueKeywords = Array.from(
    new Set(
      keywords
        .map((kw) => kw?.trim())
        .filter((kw): kw is string => !!kw && kw.length > 0)
    )
  );

  if (uniqueKeywords.length === 0) {
    return <>{text}</>;
  }

  const pattern = new RegExp(`(${uniqueKeywords.map(escapeRegex).join('|')})`, 'gi');
  const lowerKeywords = uniqueKeywords.map((kw) => kw.toLowerCase());
  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = lowerKeywords.includes(part.toLowerCase());
        if (isMatch) {
          return (
            <span
              key={`${part}-${index}`}
              className="bg-violet-100 text-violet-700 font-semibold px-1 rounded-md mx-0.5"
            >
              {part}
            </span>
          );
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </span>
  );
};

