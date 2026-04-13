# Stage 4: Committing to a Theory

label stage4_theory_coexist:
    $ theory = "coexistence"
    "You commit to finding a way for the Echo and academy to coexist."
    jump stage4_decision

label stage4_theory_binding:
    $ theory = "humane_binding"
    "You decide to research a more ethical binding solution."
    jump stage4_decision

label stage4_theory_exit:
    $ theory = "dimensional_exit"
    "You choose to help the Echo return to its home dimension."
    jump stage4_decision

label stage4_theory_destroy:
    $ theory = "destruction"
    "You resolve to find a way to end the Echo's existence."
    jump stage4_decision

label stage4_decision:
    scene bg academy_gate with fade

    "Your theory chosen, the path forward becomes clearer."
    "But before you can act, everything changes."

    "A massive energy surge ripples through the academy."

    show h at center with dissolve

    h "What was that?!"

    "Your phone buzzes with emergency alerts."

    y "The disturbances are escalating. Multiple locations simultaneously."

    $ current_stage = 5

    "Stage 4 complete. Theory formed. But now crisis escalates."

    jump stage5_begin
