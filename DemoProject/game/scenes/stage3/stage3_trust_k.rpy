# Stage 3: Building Trust - Kenji Route

label stage3_trust_k:
    scene bg art_room with fade

    show k at center with dissolve

    k "You came. Good. I need someone who won't dismiss what I'm about to show you."

    "Kenji unveils a series of paintings."

    k "I've been painting these for months. Before the Prism disappeared."
    k "I didn't understand them then. I do now."

    "The paintings depict a figure - part human, part something else - bound in chains of light."

    $ relationship_k += 20

    k "This is the entity. I've been seeing it in my dreams, in my visions."
    k "It showed me its true form. Its pain. Its rage."

    $ clues_found.append("entity_appearance")

    menu:
        "Has it been communicating with you?":
            k "In a sense. It doesn't use words. It uses... impressions. Emotions. Concepts."
            k "It's desperate. It's been bound unjustly, or so it believes."
            k "And it wants to tell its story."
            $ relationship_k += 15

        "Is it dangerous?":
            k "Very. But not necessarily evil."
            k "Imagine being imprisoned for centuries. Conscious but powerless."
            k "What would that do to you? To anyone?"
            $ relationship_k += 10

    k "I've been researching binding rituals. Not to create one - but to understand one."
    k "If we're going to deal with this entity, we need to speak its language."

    $ primary_ally = "kenji"

    jump stage3_partnership
