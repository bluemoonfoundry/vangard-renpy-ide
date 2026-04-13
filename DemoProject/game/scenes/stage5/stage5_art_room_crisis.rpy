# Stage 5: Art Room Crisis - Living Paintings

label stage5_art_room_crisis:
    scene bg art_room with fade

    "Kenji's paintings have come alive. Figures move within frames."

    show k at center with dissolve

    k "They're not attacking. They're... showing me something."

    "The painted figures act out scenes. The binding ceremony. The Echo's imprisonment."

    $ friends_saved += 1
    $ relationship_k += 20
    $ clues_found.append("binding_ceremony_details")

    k "The Echo is using my art to communicate its history."
    k "Look - there. That's not Nathaniel Aether performing the binding."
    k "It's someone else. Someone who looks like..."

    menu:
        "Professor Sterling?":
            k "No. But someone from his bloodline. The Weaver himself."
            $ evidence_score += 15

        "The missing student?":
            k "Possibly. The timelines... they're overlapping."
            $ evidence_score += 10

    "The paintings fade back to normal, but their message remains."

    jump stage5_emergency_meeting
