# Stage 7: Sterling Sacrifice Ritual

label stage7_ritual_sterling:
    scene bg garden with fade

    show s at center with dissolve

    s "This responsibility has been passed down through generations."
    s "The Weaver's guilt. The Weaver's duty."
    s "It ends with me."

    "Professor Sterling performs the ritual with practiced precision."

    "The Echo watches, understanding dawning."

    "Echo" "You are... kin. Blood of the Weaver."
    "Echo" "The one who bound me."

    s "And the one who now frees you. Go home."

    "The portal opens. The Echo passes through."
    "Sterling collapses, aged suddenly, memories fading."

    $ mystery_solved = True
    $ relationship_s += 30

    jump stage7_aftermath
