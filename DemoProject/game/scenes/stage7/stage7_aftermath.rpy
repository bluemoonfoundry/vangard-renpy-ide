# Stage 7: Immediate Aftermath

label stage7_aftermath:
    scene bg academy_gate with fade

    "The immediate crisis is over."

    "The garden stabilizes. The disturbances cease."

    if mystery_solved:
        "The academy is safe. The Echo is at peace."
    else:
        "But questions remain. The Echo is still out there."

    $ current_stage = 8

    "Stage 7 complete. The confrontation resolved. Now for the aftermath."

    jump stage8_begin
