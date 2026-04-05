  
                                                                                                  
  ┌──────────────┬─────────────────┬─────────────────────────────────────────────────────────┐
  │   Feature    │   Competitor    │                         Vangard                         │
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤
  │ Story Flow   │ Pro ($5) —      │ Free — core feature: drag-drop canvas + RouteCanvas     │
  │ Graph        │ Mermaid-based   │ with unreachable label detection, call/jump             │    
  │              │                 │ distinction, route highlighting                         │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Code         │ Free            │ Free — context-aware (jump, call, show, hide, scene,    │    
  │ Completion   │                 │ variables, characters, screens)                         │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Snippets     │ Free — 40+      │ Free — 28+ built-in + unlimited user-defined with       │    
  │              │ templates       │ Monaco placeholder support                              │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Game Runner  │ Free            │ Free                                                    │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Asset        │ Pro ($5)        │ Free — image/audio scanning, copy-to-project pipeline   │    
  │ Manager      │                 │                                                         │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Project      │ Free            │ Free — word counts, scene/route/character/variable      │    
  │ Statistics   │ (dashboard)     │ counts, bar charts                                      │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Scene        │ Not present     │ Free — drag-drop sprite/bg layout, generates Ren'Py     │    
  │ Composer     │                 │ code, exports PNG                                       │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ ImageMap     │ Not present     │ Free — visual hotspot editor for imagemap screens       │    
  │ Composer     │                 │                                                         │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ AI Story     │ Not present     │ Free — Gemini/OpenAI/Anthropic integration              │    
  │ Generator    │                 │                                                         │    
  ├──────────────┼─────────────────┼─────────────────────────────────────────────────────────┤    
  │ Visual block │ Not present     │ Free — .rpy files as draggable blocks                   │    
  │  canvas      │                 │                                                         │    
  └──────────────┴─────────────────┴─────────────────────────────────────────────────────────┘    

  ---
  Where the competitor leads (gaps in Vangard)

  Free tier gaps — Monaco/LSP-level editor features we lack:

  ┌──────────────────────────┬──────────┬─────────────────────────────────────────────────────┐   
  │         Feature          │ Priority │                        Notes                        │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Syntax Highlighting      │ High     │ Monaco uses basic tokenization; competitor has full │   
  │ (TextMate grammar)       │          │  grammar + semantic tokens                          │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Diagnostics              │ High     │ We detect undefined labels in analysis but don't    │   
  │                          │          │ surface inline editor squiggles                     │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Hover Documentation      │ Medium   │ We have no hover info on                            │   
  │                          │          │ statements/characters/labels                        │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Go to Definition / Find  │ Medium   │ Not implemented                                     │   
  │ References               │          │                                                     │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ CodeLens (reference      │ Medium   │ Not implemented                                     │   
  │ counts)                  │          │                                                     │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Inlay Hints              │ Low      │ Character display names, word counts inline         │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Code Folding             │ Low      │ Monaco has generic folding; theirs is Ren'Py-aware  │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Signature Help           │ Low      │ Parameter hints for Character() etc.                │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Document Links           │ Low      │ Clickable file paths in strings                     │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Color Picker             │ Low      │ Hex swatches in Character definitions               │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Call Hierarchy           │ Low      │ We have RouteCanvas but no editor-integrated call   │   
  │                          │          │ hierarchy                                           │   
  ├──────────────────────────┼──────────┼─────────────────────────────────────────────────────┤   
  │ Japanese Localization    │ Low      │ English only                                        │   
  └──────────────────────────┴──────────┴─────────────────────────────────────────────────────┘   

  Pro tier gaps:

  ┌──────────────────────┬────────────────────────────────────────────────────────────────────┐   
  │       Feature        │                               Notes                                │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Debugger (DAP)       │ Breakpoints, variable inspection, stack frames — significant       │   
  │                      │ effort                                                             │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Variable Tracker     │ Real-time game variable monitoring during play                     │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Heatmap              │ Playtest path frequency visualization                              │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Translation          │ Untranslated string tracking                                       │   
  │ Dashboard            │                                                                    │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Test Runner          │ Ren'Py testcase discovery/execution                                │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Refactoring          │ Safe rename of labels/characters/screens — high value              │   
  ├──────────────────────┼────────────────────────────────────────────────────────────────────┤   
  │ Live Preview         │ Screenshot-based; we have Scene Composer but not live game preview │   
  └──────────────────────┴────────────────────────────────────────────────────────────────────┘ 