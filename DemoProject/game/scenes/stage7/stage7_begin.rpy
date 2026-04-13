# Stage 7: Confrontation - Begin
# Face the Echo and make final choice

label stage7_begin:
    scene bg garden with fade

    "The garden pulses with otherworldly energy."

    "Echo" "You return. Prepared. Understanding."

    "The Echo's form is clearer now. Almost human. Almost."

    menu:
        "Offer to help the Echo return home":
            jump stage7_help_echo

        "Attempt to negotiate a binding that respects its consciousness":
            jump stage7_negotiate_binding

        "Challenge the Echo's right to destabilize our world":
            jump stage7_challenge_echo
