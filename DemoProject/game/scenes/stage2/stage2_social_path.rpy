# Stage 2: Investigation - Social/Interview Path
# Witness interviews with Hasper

label stage2_social_path:
    scene bg club_fair with fade

    show h at center with dissolve

    h "Thanks for helping with this. Some people are more willing to talk when it's not 'official.'"

    $ relationship_h += 10
    $ witnesses_interviewed = True

    h "I've identified three key witnesses who were in or near the museum wing that evening."

    mc "Who are they?"

    h "First, Professor Sterling. He was the last person to see the Prism before it vanished."
    h "Second, the night custodian. She reported hearing 'whispers' around midnight."
    h "Third, a student who claims to have seen someone leaving the museum around the same time."

    menu:
        "Interview Professor Sterling first":
            jump stage2_interview_sterling

        "Talk to the night custodian":
            jump stage2_interview_custodian

        "Find the student witness":
            jump stage2_interview_student

label stage2_interview_sterling:
    scene bg library with fade
    show s at center with dissolve

    h "Professor Sterling, we have a few questions about the night the Prism disappeared."

    s "Questions. Always questions. Never understanding."
    s "Very well. I was conducting research in the museum archives until approximately 10 PM."
    s "The Prism was secure when I left. I checked it personally."

    mc "Did you notice anything unusual that evening?"

    s "Everything was unusual. The air felt... heavy. Dense with potential."
    s "And there was a scent. Like ozone before a lightning strike."

    $ clues_found.append("ozone_scent")
    $ evidence_score += 10

    jump stage2_social_clue

label stage2_interview_custodian:
    scene bg club_fair with fade
    show h at left with dissolve

    "Custodian" "I told the authorities everything I know!"

    h "We understand. We just want to hear it in your own words."

    "Custodian" "Around midnight, I was cleaning the west corridor near the museum."
    "Custodian" "That's when I heard them. Whispers. Multiple voices, but I couldn't make out words."
    "Custodian" "I looked around, but there was no one there."

    mc "What direction did the whispers come from?"

    "Custodian" "That's the strange part. They seemed to come from everywhere at once."
    "Custodian" "Then everything went silent. Too silent. No HVAC noise, no building settling. Nothing."

    $ clues_found.append("midnight_whispers")
    $ evidence_score += 10

    jump stage2_social_clue

label stage2_interview_student:
    scene bg club_fair with fade
    show m at right with dissolve

    m "Oh, you're looking for witness testimony? I might have seen something."

    $ met_m = True if not met_m else True

    m "I was doing late-night training in the gym - it's on the same floor as the museum wing."
    m "Around 11:45 PM, I saw someone in the hallway. Tall figure, wearing dark clothing."

    mc "Could you identify them?"

    m "Not clearly. But their walk was... odd. Too smooth, almost gliding."
    m "They went toward the museum entrance, then I lost sight of them."

    $ clues_found.append("gliding_figure")
    $ evidence_score += 10

    jump stage2_social_clue
