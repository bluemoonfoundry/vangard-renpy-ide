import React from 'react';
import logo from '../vangard-renide-512x512.png';

interface WelcomeScreenProps {
  onOpenProject: () => void;
  onCreateProject: () => void;
  isElectron: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onOpenProject, 
  onCreateProject, 
  isElectron 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex bg-white dark:bg-gray-900 font-sans">
      {/* Left Side - Hero/Logo */}
      <div className="hidden md:flex w-1/2 bg-indigo-600 flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
        <img src={logo} alt="Vangard Ren'IDE" className="w-64 h-64 mb-8 drop-shadow-2xl object-contain" />
        <h1 className="text-4xl font-bold mb-4 text-center tracking-tight">Ren'Py Visual Editor</h1>
        <p className="text-indigo-100 text-lg text-center max-w-md leading-relaxed">
          Design, visualize, and write your visual novels with a powerful, flow-based interface.
        </p>
        <div className="mt-12 text-indigo-300 text-sm font-mono">v0.1.0 • Local Development Build</div>
      </div>

      {/* Right Side - Actions */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md space-y-8">
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Get Started</h2>
                <p className="text-gray-500 dark:text-gray-400">Select an option to begin your storytelling journey.</p>
            </div>
            
            <div className="space-y-4">
                {isElectron ? (
                    <>
                        <button 
                            onClick={onCreateProject}
                            className="w-full group relative flex items-center p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-200 text-left"
                        >
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Create New Project</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Start a fresh visual novel from scratch</p>
                            </div>
                        </button>

                        <button 
                            onClick={onOpenProject}
                            className="w-full group relative flex items-center p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-200 text-left"
                        >
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Open Project</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Locate an existing project folder</p>
                            </div>
                        </button>
                    </>
                ) : (
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm">
                        This application is designed to run in Electron. Please launch the Electron app to create or open projects.
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;