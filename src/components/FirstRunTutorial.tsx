/**
 * @file FirstRunTutorial.tsx
 * @description First-run interactive tutorial with spotlight effect and guided tour
 * Shows once per user (localStorage flag) after creating or opening first project
 * Key features: Custom overlay with spotlight, skippable, 4-5 tour steps
 * Integration: Rendered in App.tsx, triggered on first project open
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { UI_TIMING, Z_INDEX, TUTORIAL_DIMENSIONS } from '@/lib/constants';

const TUTORIAL_STORAGE_KEY = 'renpy-ide-tutorial-completed';

interface TourStep {
  id: string;
  title: string;
  message: string;
  targetSelector: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Getting Started',
    message: "First, let's open or create a project. Click the folder icon in the top-left to get started.",
    targetSelector: '[data-tutorial="project-menu"]',
    position: 'bottom',
  },
  {
    id: 'canvas-types',
    title: 'Three Canvas Types',
    message: 'Ren\'IDE has three ways to visualize your visual novel: Project (organize script files), Flow (trace narrative flow), and Choices (player decisions). Switch between them here.',
    targetSelector: '[data-tutorial="canvas-tabs"]',
    position: 'bottom',
  },
  {
    id: 'story-canvas',
    title: 'Project Canvas',
    message: 'This is your Project Canvas — your visual novel at a glance. Each block is a script file.',
    targetSelector: '[data-tutorial="story-canvas"]',
    position: 'bottom',
  },
  {
    id: 'new-scene',
    title: 'Create Scene',
    message: 'Press N or click here to create a new scene',
    targetSelector: '[data-tutorial="new-scene-button"]',
    position: 'bottom',
  },
  {
    id: 'story-elements',
    title: 'Story Elements',
    message: 'Characters, images, audio, and other story elements live here',
    targetSelector: '[data-tutorial="story-elements"]',
    position: 'left',
  },
  {
    id: 'ready',
    title: "You're Ready!",
    message: "That's it! Press Cmd+G (or Ctrl+G) anytime to jump to a label. Happy storytelling!",
    targetSelector: '', // No target, will be shown as centered modal
    position: 'bottom',
  },
];

interface FirstRunTutorialProps {
  onComplete: () => void;
  forceShow?: boolean;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const FirstRunTutorial: React.FC<FirstRunTutorialProps> = ({ onComplete, forceShow = false }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [messagePosition, setMessagePosition] = useState({ top: 0, left: 0 });

  // Handle skip/complete
  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setShowWelcome(false);
    setCurrentStepIndex(-1);
    onComplete();
  }, [onComplete]);

  const { modalProps: welcomeModalProps, contentRef: welcomeContentRef } = useModalAccessibility({
    isOpen: showWelcome,
    onClose: handleSkip,
    titleId: 'tutorial-welcome-title',
  });

  // Check if tutorial should be shown on app launch
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!tutorialCompleted) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        setShowWelcome(true);
      }, UI_TIMING.TUTORIAL_SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, []); // Run once on mount

  // Handle manual trigger from Help menu
  useEffect(() => {
    if (forceShow) {
      setShowWelcome(true);
      setCurrentStepIndex(-1);
    }
  }, [forceShow]);

  // Start the tour
  const handleStartTour = useCallback(() => {
    setShowWelcome(false);
    setCurrentStepIndex(0);
  }, []);

  // Update spotlight position when step changes
  useEffect(() => {
    if (currentStepIndex < 0 || currentStepIndex >= TOUR_STEPS.length) {
      setSpotlightRect(null);
      return;
    }

    const step = TOUR_STEPS[currentStepIndex];

    // Handle final step with no target (centered message)
    if (!step.targetSelector) {
      setSpotlightRect(null);
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const messageWidth = TUTORIAL_DIMENSIONS.MESSAGE_WIDTH;
      const messageHeight = TUTORIAL_DIMENSIONS.MESSAGE_HEIGHT;
      setMessagePosition({
        top: viewportHeight / 2 - messageHeight / 2,
        left: viewportWidth / 2 - messageWidth / 2,
      });
      return;
    }

    let retryCount = 0;
    const maxRetries = UI_TIMING.TUTORIAL_MAX_RETRIES;

    const updateSpotlight = () => {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = 8;
        setSpotlightRect({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });

        // Calculate message position based on step position preference
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const messageWidth = TUTORIAL_DIMENSIONS.MESSAGE_WIDTH;
        const messageHeight = TUTORIAL_DIMENSIONS.MESSAGE_HEIGHT;

        let top = rect.top;
        let left = rect.left;

        switch (step.position) {
          case 'bottom':
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2 - messageWidth / 2;
            break;
          case 'top':
            top = rect.top - messageHeight - 20;
            left = rect.left + rect.width / 2 - messageWidth / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - messageHeight / 2;
            left = rect.left - messageWidth - 20;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - messageHeight / 2;
            left = rect.right + 20;
            break;
          default:
            top = rect.bottom + 20;
            left = rect.left;
        }

        // Keep message within viewport
        top = Math.max(20, Math.min(top, viewportHeight - messageHeight - 20));
        left = Math.max(20, Math.min(left, viewportWidth - messageWidth - 20));

        setMessagePosition({ top, left });
        retryCount = 0; // Reset retry count on success
      } else {
        // Element not found, try again after a short delay (up to maxRetries)
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(updateSpotlight, UI_TIMING.TUTORIAL_SPOTLIGHT_RETRY_MS);
        } else {
          // Element not found after retries, show message in center without spotlight
          setSpotlightRect(null);
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          const messageWidth = TUTORIAL_DIMENSIONS.MESSAGE_WIDTH;
          const messageHeight = TUTORIAL_DIMENSIONS.MESSAGE_HEIGHT;
          setMessagePosition({
            top: viewportHeight / 2 - messageHeight / 2,
            left: viewportWidth / 2 - messageWidth / 2,
          });
        }
      }
    };

    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [currentStepIndex]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Tour completed
      handleSkip();
    }
  }, [currentStepIndex, handleSkip]);

  // Handle keyboard navigation
  useEffect(() => {
    if (currentStepIndex < 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, handleNext, handleSkip]);

  if (!showWelcome && currentStepIndex < 0) return null;

  // Welcome Modal
  if (showWelcome) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center"
        style={{ zIndex: Z_INDEX.TUTORIAL_OVERLAY }}
        onClick={handleSkip}
        {...welcomeModalProps}
      >
        <div
          ref={welcomeContentRef}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-8 flex flex-col items-center text-center">
            <div className="text-5xl mb-4">👋</div>
            <h2 id="tutorial-welcome-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Welcome to Ren'IDE!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-2">
              Want a quick tour to get started?
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              We'll show you how to create your first project and navigate the interface. It only takes 30 seconds.
            </p>
          </div>
          <footer className="bg-gray-50 dark:bg-gray-700/50 p-4 flex justify-center gap-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSkip}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 text-sm font-bold rounded transition-colors shadow-sm"
            >
              Skip — I'll explore on my own
            </button>
            <button
              onClick={handleStartTour}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded transition-colors shadow-sm"
            >
              Start Tour
            </button>
          </footer>
        </div>
      </div>
    );
  }

  // Tour Step Overlay
  const currentStep = TOUR_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: Z_INDEX.TUTORIAL_OVERLAY }}>
      {/* Semi-transparent overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ zIndex: Z_INDEX.TUTORIAL_OVERLAY }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
          onClick={handleSkip}
        />
      </svg>

      {/* Spotlight border */}
      {spotlightRect && (
        <div
          className="absolute border-4 border-indigo-500 rounded-lg pointer-events-none animate-pulse"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            zIndex: Z_INDEX.TUTORIAL_SPOTLIGHT_BORDER,
          }}
        />
      )}

      {/* Message card */}
      {currentStep && (
        <div
          className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 pointer-events-auto"
          style={{
            top: messagePosition.top,
            left: messagePosition.left,
            width: `${TUTORIAL_DIMENSIONS.MESSAGE_WIDTH}px`,
            zIndex: Z_INDEX.TUTORIAL_MESSAGE,
          }}
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            {currentStep.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
            {currentStep.message}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentStepIndex
                      ? 'bg-indigo-600'
                      : index < currentStepIndex
                      ? 'bg-indigo-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded transition-colors shadow-sm"
              >
                {isLastStep ? 'Start Creating' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirstRunTutorial;
