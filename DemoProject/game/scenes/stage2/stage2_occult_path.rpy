# Stage 2: Investigation - Occult/Supernatural Path
# Mystical investigation with Kenji

label stage2_occult_path:
    scene bg art_room with fade

    "The art room is dimly lit, covered in paintings that seem to shift in the shadows."

    show k at center with dissolve

    k "You came. Good. Most people are too afraid to consider the truth."

    $ met_k = True if not met_k else True
    $ relationship_k += 10
    $ occult_research_done = True

    k "The Celestial Prism isn't a treasure. It's a prison."
    k "And what was imprisoned is now free."

    mc "How do you know this?"

    k "Because I can feel it. The entity is old, powerful, and very, very angry."
    k "It's been bound for 179 years. Imagine being conscious but powerless for two centuries."

    $ artifact_knowledge += 25
    $ clues_found.append("entity_conscious")

    menu:
        "What does this entity want?":
            k "What all imprisoned beings want. Freedom. Revenge. Recognition."
            k "It was bound by Nathaniel Aether because he feared its power."
            k "Now it's loose, and it's looking for something."
            $ clues_found.append("entity_searching")

        "How do we stop it?":
            k "Stop it? First, we must understand it."
            k "I've been researching binding rituals and protective wards."
            k "But we need to know the entity's true name to have any power over it."
            $ clues_found.append("need_true_name")

    k "Come with me. I need to show you something."

    scene bg garden with fade

    k "Look at the plants here. They've withered overnight."
    k "The entity feeds on life force. Slowly, subtly, but inevitably."

    "You notice the garden that was vibrant yesterday now shows signs of decay."

    $ clues_found.append("life_drain")
    $ evidence_score += 15
    $ supernatural_witnessed = True

    k "If we don't act soon, the entire academy will become a husk."

    jump stage2_occult_clue
