# Stage 6: Team Formation

label stage6_team_formation:
    scene bg club_fair with fade

    show h at left
    show l at center
    show y at right
    with dissolve

    h "Alright. We do this together."

    show m at left
    show k at right
    with dissolve

    m "Count me in. I'm not letting this thing destroy our academy."
    k "The Echo and I... we understand each other now. I can help bridge the gap."

    $ relationship_h += 15
    $ relationship_l += 15
    $ relationship_m += 15
    $ relationship_y += 15
    $ relationship_k += 15

    "Your team assembled, each member brings unique strengths."

    jump stage6_team_strategy
