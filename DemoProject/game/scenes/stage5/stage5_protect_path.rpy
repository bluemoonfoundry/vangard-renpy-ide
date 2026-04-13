# Stage 5: Protection Path

label stage5_protect_path:
    scene bg academy_gate with fade

    "You prioritize getting everyone to safety first."

    show m at center with dissolve

    m "I'll coordinate evacuation. Get everyone to the outer grounds."

    $ friends_saved += 2
    $ team_or_solo = "team"

    "Working together, you establish safe zones and guide students away from anomalies."

    "But even as you protect, you know this is temporary."
    "The Echo must be dealt with."

    $ current_stage = 6

    jump stage6_begin
