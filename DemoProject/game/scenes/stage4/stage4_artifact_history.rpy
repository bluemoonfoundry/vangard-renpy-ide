# Stage 4: The True History of the Artifact

label stage4_artifact_history:
    scene bg library with fade

    show s at center with dissolve

    s "The Celestial Prism was never just an artifact."
    s "179 years ago, Nathaniel Aether and an entity known as the Weaver created it."

    $ artifact_knowledge += 30

    s "But they didn't create an object. They created a prison."
    s "A sentient being - the Echo - was bound within. Not because it was evil."
    s "But because it was too powerful. Too different. Too dangerous to exist freely."

    $ clues_found.append("echo_name")

    show k at right with dissolve

    k "The Echo. That's what I've been sensing."

    s "Indeed. And now the Echo is free. Weakened, but growing stronger."

    menu:
        "Why was the Echo imprisoned?":
            s "Fear. The Echo existed between dimensions, seeing past, present, and possible futures."
            s "Nathaniel feared what it knew. What it might reveal."
            $ artifact_knowledge += 15

        "Who released it?":
            s "That... is the question we must answer tonight."
            jump stage4_suspect_unknown

        "How do we stop it?":
            s "Perhaps we shouldn't. Perhaps the true crime was the binding itself."
            $ theory = "unjust_imprisonment"

    jump stage4_garden_event
