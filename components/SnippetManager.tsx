import React, { useState } from 'react';

interface Snippet {
  title: string;
  description: string;
  code: string;
}

interface SnippetCategory {
  name: string;
  snippets: Snippet[];
}

const SNIPPETS: SnippetCategory[] = [
  {
    name: "Dialogue & Narration",
    snippets: [
      {
        title: "Standard Dialogue",
        description: "A character speaking a line of dialogue.",
        code: `e "I have something to say."`
      },
      {
        title: "Dialogue with Attributes",
        description: "Show a different character image for this line.",
        code: `e happy "This makes me so happy!"`
      },
      {
        title: "Narration",
        description: "Text displayed to the player, not spoken by a character.",
        code: `"The sun sets over the city."`
      },
      {
        title: "NVL-Mode Dialogue",
        description: "Dialogue that appears over the whole screen, like in a novel.",
        code: `nvl clear\n"This is the first line of NVL-mode text."\ne "And characters can speak here, too."\n"This allows for a lot of text to be on screen at once."`
      },
    ]
  },
  {
    name: "Logic & Control Flow",
    snippets: [
      {
        title: "Simple If/Else",
        description: "Execute different paths based on a condition.",
        code: `if has_met_eileen:\n    e "It's good to see you again!"\nelse:\n    e "Nice to meet you."`
      },
      {
        title: "If/Elif/Else",
        description: "Handle multiple conditions in sequence.",
        code: `if score >= 10:\n    "You got an A!"\nelif score >= 5:\n    "You got a B."\nelse:\n    "You got a C."`
      },
      {
        title: "Choice Menu",
        description: "Present the player with a choice.",
        code: `menu:\n    "What should I do?":\n        "Go to the park.":\n            jump park_scene\n        "Stay home.":\n            jump home_scene`
      },
      {
        title: "Jump to Label",
        description: "Unconditionally move to another part of the story.",
        code: `jump end_of_chapter_one`
      },
      {
        title: "Call Label",
        description: "Temporarily jump to a label, then return when it finishes.",
        code: `call check_inventory\n"Okay, back to it."`
      },
    ]
  },
  {
    name: "Visuals & Effects",
    snippets: [
      {
        title: "Show Image",
        description: "Display a character or image on screen.",
        code: `show eileen happy`
      },
      {
        title: "Show Image with Position",
        description: "Display an image at a specific location.",
        code: `show eileen happy at left`
      },
      {
        title: "Scene with Transition",
        description: "Clear the screen and show a new background with a fade.",
        code: `scene bg park with fade`
      },
      {
        title: "Simple Transition",
        description: "Use a transition between visual changes.",
        code: `with dissolve`
      },
      {
        title: "Pause",
        description: "Wait for a specified number of seconds.",
        code: `pause 1.5`
      },
    ]
  },
    {
    name: "Audio",
    snippets: [
      {
        title: "Play Music",
        description: "Start playing a music track. Use `fadein` for smooth starts.",
        code: `play music "audio/bgm/town_theme.ogg" fadein 1.0`
      },
      {
        title: "Play Sound Effect",
        description: "Play a one-off sound effect.",
        code: `play sound "audio/sfx/door_open.wav"`
      },
      {
        title: "Stop Music",
        description: "Stop the currently playing music. Use `fadeout` for smooth stops.",
        code: `stop music fadeout 2.0`
      },
      {
        title: "Queue Music",
        description: "Play a music track after the current one finishes.",
        code: `queue music "audio/bgm/night_theme.ogg"`
      }
    ]
  },
];

const SnippetManager: React.FC = () => {
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

    const handleCopy = (code: string, title: string) => {
        navigator.clipboard.writeText(code);
        setCopiedSnippet(title);
        setTimeout(() => setCopiedSnippet(null), 2000);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold">Code Snippets</h3>
            {SNIPPETS.map(category => (
                <details key={category.name} open className="group">
                    <summary className="font-semibold text-gray-600 dark:text-gray-400 cursor-pointer list-none flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        {category.name}
                    </summary>
                    <div className="pl-4 mt-2 space-y-3">
                        {category.snippets.map(snippet => (
                            <div key={snippet.title} className="p-3 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold">{snippet.title}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{snippet.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleCopy(snippet.code, snippet.title)}
                                        className={`px-2 py-1 text-xs font-semibold rounded ${copiedSnippet === snippet.title ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-800'}`}
                                    >
                                        {copiedSnippet === snippet.title ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <pre className="bg-gray-800 text-white p-2 rounded text-xs font-mono whitespace-pre-wrap">
                                    <code>{snippet.code}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
};

export default SnippetManager;