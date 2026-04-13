# Stage 7: Self Sacrifice Ritual

label stage7_ritual_self:
    scene bg garden with fade

    "You step forward, offering yourself as conduit."

    "The Echo touches your mind. You feel memories being examined."
    "Not taken. Just... observed. Acknowledged."

    "Echo" "You would give freely what was stolen from me."
    "Echo" "This... kindness... I do not deserve it."

    mc "Everyone deserves kindness."

    "A portal opens. Shimmering. Beautiful."

    "Echo" "I will remember you. In my home. In my peace."
    "Echo" "Thank you."

    "The Echo passes through. The portal closes."

    "You forget... something. You're not sure what."
    "But the garden is peaceful. The academy is safe."

    $ mystery_solved = True
    $ friends_saved += 3

    jump stage7_aftermath
