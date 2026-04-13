# The Vanishing Artifact - Demo Story Structure

## Overview
A complex branching narrative mystery visual novel designed to showcase all features of Vangard Ren'Py IDE.

**Total Files**: 72 .rpy files across 8 stages
**Story Type**: Mystery/Supernatural Investigation
**Estimated Playtime**: 60-90 minutes (varies by path)
**Endings**: 8 distinct endings based on player choices

## Characters

- **h (Hasper)** - Female student council president, organized diplomat
- **l (Liam)** - Male librarian assistant, quiet historian
- **m (Maya)** - Female athletic captain, brave and energetic
- **y (Yuki)** - Female tech genius, hacker extraordinaire
- **k (Kenji)** - Male mysterious artist with occult knowledge
- **s (Professor Sterling)** - Male middle-aged professor, cryptic and knowing

## Stage Structure

### Stage 1: Discovery (8 files)
**Location**: `scenes/stage1/`
**Purpose**: Introduce mystery, meet characters, choose investigation approach

**Key Branching Points**:
- Initial discovery method (3 paths)
- Who to trust first (3 options)
- Investigation specialization choice (4 paths: library, tech, social, occult)

**Files**:
- `stage1_arrival.rpy` - Entry point
- `stage1_announcement.rpy` - Official version
- `stage1_rumors.rpy` - Student gossip path
- `stage1_library_notice.rpy` - Meet Liam
- `stage1_meet_h.rpy` - Hasper introduction
- `stage1_meet_s.rpy` - Professor Sterling
- `stage1_choice.rpy` - Major investigation path choice
- `stage1_evening.rpy` - Convergence point

**Demonstrates**: File-level canvas, character introductions, menu choices, variable tracking

---

### Stage 2: Investigation Paths (9 files)
**Location**: `scenes/stage2/`
**Purpose**: Deep dive into chosen investigation method, gather evidence

**Key Branching Points**:
- Four distinct investigation paths with unique content
- Path-specific clues and character interactions
- Cross-path discoveries that converge

**Files**:
- `stage2_begin.rpy` - Path dispatcher
- `stage2_library_path.rpy` - Historical research with Liam
- `stage2_tech_path.rpy` - Digital forensics with Yuki
- `stage2_social_path.rpy` - Witness interviews with Hasper
- `stage2_occult_path.rpy` - Supernatural investigation with Kenji
- `stage2_library_clue.rpy` - Path-specific discovery
- `stage2_tech_clue.rpy` - Path-specific discovery
- `stage2_social_clue.rpy` - Path-specific discovery
- `stage2_converge.rpy` - All paths lead to garden

**Demonstrates**: Complex branching with reconvergence, conditional content, evidence system

---

### Stage 3: Relationship Building (9 files)
**Location**: `scenes/stage3/`
**Purpose**: Deepen character bonds, unlock secrets, choose primary ally

**Key Branching Points**:
- Choose which character to bond with (5 options)
- Each character reveals unique secret
- Primary ally selection affects later stages

**Files**:
- `stage3_begin.rpy` - Relationship choice
- `stage3_trust_h.rpy` - Hasper route (dreams)
- `stage3_trust_l.rpy` - Liam route (27-year cycle)
- `stage3_trust_y.rpy` - Yuki route (entity in network)
- `stage3_trust_k.rpy` - Kenji route (psychometry)
- `stage3_trust_m.rpy` - Maya route (enhanced strength)
- `stage3_partnership.rpy` - Ally confirmation
- `stage3_revelation.rpy` - Secret reveals
- `stage3_night.rpy` - Convergence and setup

**Demonstrates**: Character-driven narrative, relationship tracking, conditional dialogue

---

### Stage 4: First Revelation (9 files)
**Location**: `scenes/stage4/`
**Purpose**: Learn true nature of artifact, form theory about solution

**Key Branching Points**:
- Questions to ask the Echo (3 paths)
- Theory formation (4 options: coexistence, binding, exit, destruction)
- Suspect identification

**Files**:
- `stage4_begin.rpy` - Midnight meeting
- `stage4_artifact_history.rpy` - Truth about the Prism
- `stage4_garden_event.rpy` - Echo manifestation
- `stage4_echo_liberation.rpy` - Who freed it?
- `stage4_echo_desire.rpy` - What does it want?
- `stage4_echo_effects.rpy` - Understanding disturbances
- `stage4_suspect_s.rpy` - Sterling's confession
- `stage4_analyze_clues.rpy` - Theory formation
- `stage4_decision.rpy` - Commit to approach

**Demonstrates**: Major plot revelation, theory tracking, moral choices

---

### Stage 5: Crisis Escalation (8 files)
**Location**: `scenes/stage5/`
**Purpose**: Supernatural events intensify, save friends in danger

**Key Branching Points**:
- Which location to help first (3 crisis locations)
- Protect vs. pursue choice
- Crisis resolution methods based on earlier choices

**Files**:
- `stage5_begin.rpy` - Crisis dispatcher
- `stage5_gym_crisis.rpy` - Maya in spatial loop
- `stage5_computer_lab_crisis.rpy` - Yuki vs. digital chaos
- `stage5_art_room_crisis.rpy` - Kenji's living paintings
- `stage5_emergency_meeting.rpy` - Assessment
- `stage5_protect_path.rpy` - Safety first approach
- `stage5_pursue_path.rpy` - Direct confrontation approach
- `stage5_phenomenon.rpy` - Time distortions

**Demonstrates**: Action sequences, time pressure, consequence tracking (friends saved)

---

### Stage 6: Alliance & Evidence (9 files)
**Location**: `scenes/stage6/`
**Purpose**: Form final team, gather conclusive evidence

**Key Branching Points**:
- Team vs. solo decision
- Evidence gathering approach (3 paths)
- Final clue discovery

**Files**:
- `stage6_begin.rpy` - Team decision
- `stage6_team_formation.rpy` - Assemble allies
- `stage6_solo_investigation.rpy` - Independent path
- `stage6_team_strategy.rpy` - Coordinated planning
- `stage6_final_clue_library.rpy` - Echo cannot be destroyed
- `stage6_final_clue_tech.rpy` - Dimensional coordinates
- `stage6_final_clue_occult.rpy` - Echo is refugee
- `stage6_evidence_compiled.rpy` - All pieces together
- `stage6_preparation.rpy` - Ready for finale

**Demonstrates**: Team mechanics, evidence compilation, multiple valid solutions

---

### Stage 7: Confrontation (10 files)
**Location**: `scenes/stage7/`
**Purpose**: Face the Echo, resolve the mystery

**Key Branching Points**:
- Approach to Echo (help, negotiate, challenge)
- Sacrifice type (self, Sterling, shared, none)
- Resolution method (ritual, integration, battle)

**Files**:
- `stage7_begin.rpy` - Final confrontation setup
- `stage7_help_echo.rpy` - Compassionate approach
- `stage7_negotiate_binding.rpy` - Compromise solution
- `stage7_challenge_echo.rpy` - Forceful approach
- `stage7_ritual_self.rpy` - Player sacrifices memory
- `stage7_ritual_sterling.rpy` - Professor sacrifices himself
- `stage7_ritual_shared.rpy` - Team shares burden
- `stage7_integration.rpy` - Echo becomes part of academy
- `stage7_battle.rpy` - Combat resolution
- `stage7_aftermath.rpy` - Immediate results

**Demonstrates**: Climactic choices, multiple resolutions, consequence application

---

### Stage 8: Resolution (10 files)
**Location**: `scenes/stage8/`
**Purpose**: Multiple endings based on accumulated choices

**Endings**:
1. **Self Sacrifice** - Hero loses memories but saves all
2. **Sterling Sacrifice** - Professor gives himself, loses past
3. **Shared Perfect** - Team solution, minimal cost, best ending
4. **Integration** - Echo becomes academy consciousness
5. **Battle Victory** - Forced containment, pyrrhic win
6. **Battle Defeat** - Failed confrontation, ongoing problem
7. **Bittersweet** - Imperfect but acceptable resolution
8. **Default** - Varies based on specific choice combinations

**Files**:
- `stage8_begin.rpy` - Ending dispatcher
- `stage8_ending_self_sacrifice.rpy` - Heroic ending
- `stage8_ending_sterling_sacrifice.rpy` - Professor's sacrifice ending
- `stage8_ending_shared_perfect.rpy` - Best ending
- `stage8_ending_integration.rpy` - Coexistence ending
- `stage8_ending_battle_victory.rpy` - Pyrrhic victory
- `stage8_ending_battle_defeat.rpy` - Failure ending
- `stage8_ending_bittersweet.rpy` - Mixed resolution
- `stage8_epilogue_solo.rpy` - Solo path epilogue
- `stage8_epilogue_team.rpy` - Team path epilogue

**Demonstrates**: Ending variety, consequence culmination, player stats display

---

## Key Variables Tracked

**Relationships** (0-100 scale):
- `relationship_h`, `relationship_l`, `relationship_m`, `relationship_y`, `relationship_k`, `relationship_s`

**Progress Tracking**:
- `investigation_path` - Which investigation route chosen
- `clues_found` - List of discovered clues
- `evidence_score` - Cumulative investigation success
- `theory` - Player's theory about solution
- `primary_ally` - Chosen partner
- `team_or_solo` - Final approach method
- `friends_saved` - Number of characters helped (0-5)
- `mystery_solved` - Boolean success indicator
- `ending_type` - Final ending achieved

**Story Flags**:
- Multiple boolean flags for events witnessed, locations searched, characters met

---

## Canvas Visualization Features

### Story Canvas (File-Level)
- **8 distinct clusters** representing story stages
- **Interconnected files** within each cluster
- **Cross-cluster jumps** showing stage transitions
- **Color-coded** by character presence (role tinting)
- **Multiple convergence points** where paths reunite

### Route Canvas (Label-Level)
- **Deep branching** within each stage
- **Multiple valid paths** through the story
- **Menu nodes** with visible choice consequences
- **Conditional jumps** based on variables
- **Dead ends** (battle defeat) and optimal paths

### Choice Canvas (Player Experience)
- **Decision trees** clearly visible
- **Choice guards** showing conditions (`if` badges)
- **Consequence tracking** visible through variable changes
- **Multiple endpoints** showing ending variety

---

## IDE Feature Demonstration

This demo is specifically designed to showcase:

### Visual Canvases
✅ Complex file organization (8 clustered stages)
✅ Dense inter-file connections (jump, call)
✅ Menu choices with multiple options
✅ Conditional branching (`if` statements)
✅ Character filtering (each character appears in multiple files)
✅ Role tinting (files colored by character presence)

### Code Editor
✅ Syntax highlighting for Ren'Py
✅ IntelliSense for jumps (70+ label targets)
✅ IntelliSense for characters (6 defined)
✅ IntelliSense for variables (20+ tracked)
✅ Code navigation (jump to definition)
✅ Split pane editing

### Story Elements
✅ **Characters**: 6 fully defined with colors and roles
✅ **Variables**: 20+ tracked variables with find usages
✅ **Images**: Background references for all 7 locations
✅ **Menus**: Dozens of choice points with conditions
✅ **Screens**: Custom screen definitions referenced

### Diagnostics
✅ Can detect missing jumps if labels are removed
✅ Tracks undefined variables if removed
✅ Shows unreachable code if paths are broken
✅ Character usage tracking (dialogue count)

### Asset Management
✅ All 7 background images used across stages
✅ All 6 character sprites referenced
✅ Consistent image naming (bg, cg prefixes)

### Project Statistics
✅ **Word count**: ~15,000+ words
✅ **Dialogue lines**: 300+ lines
✅ **Branching complexity**: High (8 stages × 8+ branches)
✅ **Multiple endings**: 8 distinct outcomes
✅ **Character distribution**: Balanced across all 6 characters

---

## Playthrough Recommendations

### For Demo Video:

**Path 1: Optimal Team Ending** (shows cooperation)
- Stage 1: Library investigation
- Stage 2: Work with Liam
- Stage 3: Bond with Hasper
- Stage 4: Help Echo theory
- Stage 5: Protect friends
- Stage 6: Form team
- Stage 7: Shared sacrifice
- Stage 8: Perfect ending

**Path 2: Solo Struggle** (shows consequences)
- Stage 1: Occult investigation
- Stage 2: Work with Kenji
- Stage 3: Bond with Kenji
- Stage 4: Destroy Echo theory
- Stage 5: Pursue Echo
- Stage 6: Go solo
- Stage 7: Battle confrontation
- Stage 8: Pyrrhic victory or defeat

**Path 3: Tech-Focused** (shows investigation depth)
- Stage 1: Tech investigation
- Stage 2: Work with Yuki
- Stage 3: Bond with Yuki
- Stage 4: Dimensional exit theory
- Stage 5: Computer lab crisis
- Stage 6: Tech clue focus
- Stage 7: Integration solution
- Stage 8: Integration ending

---

## Technical Notes

- **No circular jumps**: All paths eventually converge to stage transitions
- **Variable safety**: All conditionals have fallback paths
- **Character consistency**: Each character's personality remains consistent
- **Background coverage**: All 7 backgrounds used multiple times
- **Balanced branches**: No stage has a "dead branch" without content

---

## Future Enhancements

If expanding the demo:
- Add audio cues for supernatural events
- Create custom screens for evidence compilation
- Add character sprite variations (emotions)
- Include minigames for investigation (optional)
- Expand endings to 12+ with more permutations
- Add New Game+ with knowledge carryover
