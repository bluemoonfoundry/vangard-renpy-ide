# -- Persistent Data & Flags --
# These variables will track the player's progress.
default persistent.mc_name = "Alex"

# Character relationships (0-100)
default relationship_h = 0
default relationship_l = 0
default relationship_m = 0
default relationship_y = 0
default relationship_k = 0
default relationship_s = 0

# Investigation progress
default investigation_path = "none"  # library, tech, social, occult
default clues_found = []
default evidence_score = 0
default theory = "none"  # theft, curse, possession, conspiracy

# Story flags
default met_h = False
default met_l = False
default met_m = False
default met_y = False
default met_k = False
default met_s = False

# Stage progress
default current_stage = 1
default artifact_knowledge = 0
default supernatural_witnessed = False
default primary_ally = "none"
default team_or_solo = "undecided"

# Specific event flags
default library_searched = False
default tech_analysis_done = False
default witnesses_interviewed = False
default occult_research_done = False
default garden_investigated = False
default crisis_handled = False
default culprit_identified = "unknown"

# Ending determinants
default ending_type = "unknown"
default friends_saved = 0
default mystery_solved = False
