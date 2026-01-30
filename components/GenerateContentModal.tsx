import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Block, RenpyAnalysisResult } from '../types';

interface GenerateContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertContent: (content: string) => void;
  currentBlockId: string;
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  getCurrentContext: () => string;
  availableModels: string[]; // kept simple: list of model ids
  selectedModel: string;
}

const modelProviderFor = (modelId: string): 'google' | 'openai' | 'anthropic' | 'google-unknown' => {
  const id = (modelId || '').toLowerCase();
  if (id.includes('gpt') || id.includes('openai')) return 'openai';
  if (id.includes('claude') || id.includes('anthropic')) return 'anthropic';
  if (id.includes('gemini') || id.includes('veo')) return 'google';
  return 'google-unknown';
};

const GenerateContentModal: React.FC<GenerateContentModalProps> = ({ 
  isOpen, 
  onClose, 
  onInsertContent, 
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

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  useEffect(() => {
    setModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    // load saved key for current model's provider
    const provider = modelProviderFor(model);
    const load = async () => {
      setApiKeyLoading(true);
      try {
        if (window.electronAPI?.getApiKey) {
          const key = await window.electronAPI.getApiKey(provider);
          setSavedApiKey(key || null);
          setApiKeyInput('');
        } else {
          setSavedApiKey(null);
        }
      } catch (e) {
        console.error('Failed to load API key:', e);
      } finally {
        setApiKeyLoading(false);
      }
    };
    load();
  }, [model]);

  const handleSaveKey = async () => {
    const provider = modelProviderFor(model);
    if (!window.electronAPI?.saveApiKey) {
      setError('Platform does not support saving API keys.');
      return;
    }
    try {
      await window.electronAPI.saveApiKey(provider, apiKeyInput);
      setSavedApiKey(apiKeyInput);
      setApiKeyInput('');
    } catch (e) {
      console.error('Failed to save API key', e);
      setError((e as Error).message || 'Failed to save API key');
    }
  };



  const buildPrompt = () => {
    let finalPrompt = '';

    if (renpyOnly) {
        finalPrompt += "INSTRUCTION: You are an expert Ren'Py script writer. Based on the provided context and the user's request, generate ONLY valid Ren'Py code that can be directly inserted into a script. Do not include any explanatory text or markdown formatting.\n\n";
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
        
        const blockMap = new Map<string, Block>(blocks.map(b => [b.id, b]));
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
    return finalPrompt;
  };

  const normalizeText = (text: string) => {
    let t = text.trim();
    if (t.startsWith('```')) {
      const idx = t.indexOf('\n');
      if (idx > -1) t = t.substring(idx + 1);
      t = t.replace(/```/g, '');
    }
    return t.trim();
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResponse('');

    const provider = modelProviderFor(model);
    const finalPrompt = buildPrompt();

    try {
      let apiKey = savedApiKey || '';

      if (!apiKey && window.electronAPI?.getApiKey) {
        apiKey = (await window.electronAPI.getApiKey(provider)) || '';
      }

      if (provider === 'google' || provider === 'google-unknown') {
        const key = apiKey || (process.env.API_KEY as string | undefined);
        if (!key) throw new Error('Google API key not configured for Gemini.');

        const ai = new GoogleGenAI({ apiKey: key });
        const genResponse = await ai.models.generateContent({ model, contents: finalPrompt });
        const text = normalizeText(genResponse.text || '');
        setResponse(text);
        return;
      }

      if (provider === 'openai') {
        if (!apiKey) throw new Error('OpenAI API key not configured for this machine. Please add it.');
        try {
          // dynamic import to avoid bundling the SDK unnecessarily
          // @ts-ignore
          const OpenAI = (await import('openai')).default || (await import('openai'));
          const client = new OpenAI({ apiKey });
          // try common method names
          let text = '';
          if (client.chat && client.chat.completions && client.chat.completions.create) {
            const resp = await client.chat.completions.create({ model, messages: [{ role: 'user', content: finalPrompt }], max_tokens: 1500 });
            text = resp.choices?.[0]?.message?.content || resp.choices?.[0]?.text || '';
          } else if (client.createChatCompletion) {
            const resp = await client.createChatCompletion({ model, messages: [{ role: 'user', content: finalPrompt }], max_tokens: 1500 });
            text = resp.choices?.[0]?.message?.content || resp.choices?.[0]?.text || '';
          } else if (client.chatCompletions && client.chatCompletions.create) {
            const resp = await client.chatCompletions.create({ model, messages: [{ role: 'user', content: finalPrompt }], max_tokens: 1500 });
            text = resp.choices?.[0]?.message?.content || resp.choices?.[0]?.text || '';
          } else {
            throw new Error('Unsupported OpenAI SDK shape.');
          }
          setResponse(normalizeText(text));
          return;
        } catch (e) {
          console.error('OpenAI request failed:', e);
          throw e;
        }
      }

      if (provider === 'anthropic') {
        if (!apiKey) throw new Error('Anthropic API key not configured for this machine. Please add it.');
        try {
          const { Anthropic, OpenAI: MaybeOpenAI } = await import('@anthropic-ai/sdk').catch(() => ({ Anthropic: null, OpenAI: null }));
          if (Anthropic) {
            const client = new Anthropic({ apiKey });
            // Try different method names depending on SDK
            if (client.createCompletion) {
              const resp: any = await client.createCompletion({ model, prompt: finalPrompt, max_tokens: 1500 });
              const text = resp?.completion || resp?.choices?.[0]?.text || '';
              setResponse(normalizeText(text));
              return;
            } else if (client.completions && client.completions.create) {
              const resp: any = await client.completions.create({ model, prompt: finalPrompt, max_tokens: 1500 });
              const text = resp?.choices?.[0]?.text || '';
              setResponse(normalizeText(text));
              return;
            }
          }

          // fallback: try the generic responses endpoint if provided
          const maybe = await import('@anthropic-ai/sdk').catch(() => null);
          if (maybe && maybe.Anthropic) {
            const client = new maybe.Anthropic({ apiKey });
            if (client.responses && client.responses.create) {
              const resp: any = await client.responses.create({ model, input: finalPrompt });
              const text = resp?.output?.[0]?.content?.[0]?.text || resp?.completion || '';
              setResponse(normalizeText(text));
              return;
            }
          }

          throw new Error('Unsupported Anthropic SDK shape.');
        } catch (e) {
          console.error('Anthropic request failed:', e);
          throw e;
        }
      }

      throw new Error('Unsupported model provider.');
    } catch (e) {
      console.error('AI generation failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading, includeContext, renpyOnly, getCurrentContext, analysisResult, blocks, currentBlockId, model, savedApiKey]);

  const handleCopyAndInsert = () => {
    onInsertContent(response);
    onClose();
  };

  const handleClose = () => {
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

          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">Provider: <strong>{modelProviderFor(model)}</strong></div>
            {apiKeyLoading ? (
              <div className="text-sm text-gray-500">Checking API key...</div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder={savedApiKey ? 'Key saved' : 'Enter API key'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  className="p-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                />
                <button
                  onClick={handleSaveKey}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  {savedApiKey ? 'Update Key' : 'Add Key'}
                </button>
              </div>
            )}
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