import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Block, RenpyAnalysisResult } from '../types';

interface GenerateContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertContent: (content: string) => void;
  apiKey?: string;
  currentBlockId: string;
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  getCurrentContext: () => string;
  availableModels: string[];
  selectedModel: string;
}

const GenerateContentModal: React.FC<GenerateContentModalProps> = ({ 
  isOpen, 
  onClose, 
  onInsertContent, 
  apiKey,
  currentBlockId,
  blocks,
  analysisResult,
  getCurrentContext,
  availableModels,
  selectedModel
}) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [renpyOnly, setRenpyOnly] = useState(true);
  const [model, setModel] = useState(selectedModel);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      if (!apiKey) {
        throw new Error("Gemini API key is not configured. Please set it in the Settings panel.");
      }

      let finalPrompt = '';

      if (renpyOnly) {
          finalPrompt += "INSTRUCTION: You are an expert Ren'Py script writer. Based on the provided context and the user's request, generate ONLY valid Ren'Py code that can be directly inserted into a script. Do not include any explanatory text, markdown formatting like ```renpy, or anything other than the raw Ren'Py code itself.\n\n";
      }

      if (includeContext) {
          const currentBlockPartialContent = getCurrentContext();

          const reverseAdj = new Map<string, Set<string>>();
          analysisResult.links.forEach(link => {
              if (!reverseAdj.has(link.targetId)) {
                  reverseAdj.set(link.targetId, new Set());
              }
              reverseAdj.get(link.targetId)!.add(link.sourceId);
          });

          const ancestors = new Set<string>();
          const queue: string[] = [currentBlockId];
          const visited = new Set<string>();

          while (queue.length > 0) {
              const nodeId = queue.shift()!;
              if (visited.has(nodeId)) continue;
              visited.add(nodeId);
              
              if (nodeId !== currentBlockId) {
                  ancestors.add(nodeId);
              }

              const predecessors = reverseAdj.get(nodeId) || [];
              predecessors.forEach(p => {
                  if (!visited.has(p)) {
                      queue.push(p);
                  }
              });
          }
          
          const blockMap = new Map(blocks.map(b => [b.id, b]));
          const ancestorContent = Array.from(ancestors)
              .map(id => {
                  const block = blockMap.get(id);
                  return block ? `### START FILE: ${block.filePath || block.id}.rpy ###\n${block.content}\n### END FILE: ${block.filePath || block.id}.rpy ###` : '';
              })
              .filter(Boolean)
              .join('\n\n');

          if (ancestorContent) {
              finalPrompt += `### PREVIOUS SCRIPT CONTEXT ###\n${ancestorContent}\n### END PREVIOUS SCRIPT CONTEXT ###\n\n`;
          }
          if (currentBlockPartialContent) {
              finalPrompt += `### CURRENT SCRIPT CONTEXT (up to cursor) ###\n${currentBlockPartialContent}\n### END CURRENT SCRIPT CONTEXT ###\n\n`;
          }
      }

      finalPrompt += `### USER REQUEST ###\n${prompt}\n### END USER REQUEST ###`;

      const ai = new GoogleGenAI({ apiKey });
      const genResponse = await ai.models.generateContent({
        model: model,
        contents: finalPrompt,
      });

      // Clean up response to remove potential markdown code blocks
      let resultText = genResponse.text.trim();
      if (resultText.startsWith('```renpy')) {
        resultText = resultText.substring(7);
      } else if (resultText.startsWith('```')) {
        resultText = resultText.substring(3);
      }
      if (resultText.endsWith('```')) {
        resultText = resultText.substring(0, resultText.length - 3);
      }

      setResponse(resultText.trim());
    } catch (e) {
      console.error("Gemini API request failed:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading, apiKey, includeContext, renpyOnly, getCurrentContext, analysisResult, blocks, currentBlockId, model]);

  const handleCopyAndInsert = () => {
    onInsertContent(response);
    onClose();
  };

  const handleClose = () => {
    // Reset state on close
    setPrompt('');
    setResponse('');
    setError(null);
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">Generate Content with AI</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </header>
        <main className="p-6 flex-grow overflow-y-auto space-y-4">
          <div>
            <label htmlFor="gemini-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Prompt
            </label>
            <textarea
              id="gemini-prompt"
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., Write a short, emotional dialogue between two characters seeing each other for the first time in years."
              className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={includeContext}
                        onChange={() => setIncludeContext(!includeContext)}
                        className="h-4 w-4 rounded focus:ring-indigo-500" 
                        style={{ accentColor: 'rgb(79 70 229)' }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 select-none">
                        Include script context
                    </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={renpyOnly}
                        onChange={() => setRenpyOnly(!renpyOnly)}
                        className="h-4 w-4 rounded focus:ring-indigo-500"
                        style={{ accentColor: 'rgb(79 70 229)' }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 select-none">
                        Return Ren'Py code only
                    </span>
                </label>
            </div>
            <div className="flex items-center gap-2">
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                    Model
                </label>
                <select
                    id="model-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="p-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Generated Response
            </label>
            <div className="w-full min-h-[150px] p-3 rounded bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap text-sm">
              {isLoading && (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </div>
              )}
              {error && <p className="text-red-500">{error}</p>}
              {response && <p>{response}</p>}
              {!isLoading && !error && !response && <p className="text-gray-400 dark:text-gray-500">The AI's response will appear here.</p>}
            </div>
          </div>
        </main>
        <footer className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-lg flex justify-end items-center space-x-4">
          <button
            onClick={handleClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded transition duration-200"
          >
            {response ? "Close" : "Cancel"}
          </button>
          {response && (
             <button
                onClick={handleCopyAndInsert}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Copy & Insert
              </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Generating..." : (response || error) ? "Regenerate" : "Generate"}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default GenerateContentModal;